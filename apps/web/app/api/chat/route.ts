import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { getModelForDepth } from '@/lib/ai/gateway';
import { getPrompt } from '@/lib/ai/prompts';
import { POST as searchAPI } from "@/app/api/search/route";
import type { SearchResult } from "@/app/api/search/route";

/**
 * RAG Chat API - Vercel AI SDK Implementation
 * 
 * Uses official Vercel AI SDK patterns:
 * - streamText() for streaming responses
 * - convertToModelMessages() for message conversion
 * - toUIMessageStreamResponse() for proper streaming format
 * 
 * Flow:
 * 1. Receive UIMessage[] from useChat hook
 * 2. Extract latest query and run full search pipeline
 * 3. Build RAG context from search results
 * 4. Stream response using AI Gateway
 * 5. Return UIMessageStream with sources
 * 
 * Documentation: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
 */

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body - AI SDK sends UIMessage[]
    const { messages }: { messages: UIMessage[] } = await request.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract the latest user message for search
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ');

    if (!query) {
      return new Response(
        JSON.stringify({ error: "No text content in message" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chat] Processing query: "${query}"`);

    // Step 1: Run full search pipeline (HyDE, Multi-Query, Reranking, Graph Search)
    const searchRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        query,
        match_threshold: 0.5,
        match_count: 10,
        graph_hops: 1,
      }),
    });

    const searchResponse = await searchAPI(searchRequest as unknown as Request);
    
    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      throw new Error(`Search failed: ${error.message}`);
    }

    const searchData = await searchResponse.json();
    const results: SearchResult[] = searchData.results || [];
    
    console.log(`[Chat] Found ${results.length} relevant chunks`);

    // Step 2: Build RAG context from search results
    const context = results
      .map((result, idx) => {
        return `[${idx + 1}] ${result.content}\n(Source: ${result.document_name}, Chunk ${result.chunk_index})`;
      })
      .join('\n\n---\n\n');

    // Get chat prompt from settings with context substitution
    const systemPrompt = await getPrompt('chat', { context });

    // Step 3: Stream response using AI SDK
    const result = streamText({
      model: getModelForDepth('standard'),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      temperature: 0.3,
      onFinish: ({ usage }) => {
        console.log(`[Chat] Tokens used: ${usage.inputTokens} input, ${usage.outputTokens} output`);
      },
    });

    // Step 4: Return UIMessageStream response
    // TODO: Add sources metadata using streaming data (future enhancement)
    // See: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[Chat] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Optional: GET endpoint for testing
export async function GET() {
  return new Response(
    JSON.stringify({
      message: "RAG Chat API",
      usage: "POST /api/chat with { query: string, depth?: 'quick' | 'standard' | 'detailed' }",
      status: "ready",
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
