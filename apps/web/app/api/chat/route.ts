import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { generateStreamingAnswer } from "@/lib/ai/answer-generator";
import { POST as searchAPI } from "@/app/api/search/route";
import type { SearchResult } from "@/app/api/search/route";

/**
 * RAG Chat API with Streaming
 * 
 * Flow:
 * 1. Receive user query
 * 2. Use full search API (HyDE, Multi-Query, Reranking, Graph Search)
 * 3. Generate streaming answer using retrieved context
 * 4. Return answer with source citations
 * 
 * This ensures chat respects all system settings and uses the same
 * sophisticated RAG pipeline as the search page.
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const {
      query,
      depth = 'standard',
      match_threshold = 0.5,
      match_count = 10,
      graph_hops = 1,
      conversationHistory = [],
    } = body;

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ error: "Query parameter is required and must be a string" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chat] Processing query: "${query}" (depth: ${depth})`);

    // Step 1: Use the full search API to get results
    // This respects all system settings: HyDE, Multi-Query, Reranking, Graph Search
    const searchRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        query,
        match_threshold,
        match_count,
        graph_hops,
      }),
    });

    const searchResponse = await searchAPI(searchRequest);
    
    if (!searchResponse.ok) {
      const error = await searchResponse.json();
      return new Response(
        JSON.stringify({ error: "Search failed", details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const results: SearchResult[] = searchData.results || [];
    
    console.log(`[Chat] Search completed in ${searchData.processing_time_ms}ms`);
    console.log(`[Chat] Found ${results.length} relevant chunks`);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No relevant information found",
          message: "I couldn't find any relevant information in your documents to answer this question.",
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Generate streaming answer
    const streamResult = await generateStreamingAnswer({
      query,
      searchResults: results,
      depth,
      includeSourceCitations: true,
      conversationHistory,
    });

    // Step 4: Return streaming response with sources metadata
    const sources = results.map((result) => ({
      chunkId: result.chunk_id,
      documentId: result.document_id,
      documentName: result.document_name,
      chunkIndex: result.chunk_index,
      relevanceScore: result.rerank_score || result.similarity || 0,
    }));

    // Create a custom stream that includes sources in the first chunk
    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        // Send sources as the first event
        const sourcesEvent = `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`;
        controller.enqueue(encoder.encode(sourcesEvent));

        // Stream the answer text
        const reader = streamResult.textStream.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Send completion event
              const doneEvent = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
              controller.enqueue(encoder.encode(doneEvent));
              controller.close();
              break;
            }

            // Forward text chunks
            const textEvent = `data: ${JSON.stringify({ type: 'text', content: value })}\n\n`;
            controller.enqueue(encoder.encode(textEvent));
          }
        } catch (error) {
          console.error('[Chat] Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
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
