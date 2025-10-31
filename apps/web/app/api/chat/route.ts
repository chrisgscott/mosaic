import { createClient } from '@/lib/supabase/server';
import { streamText, convertToModelMessages, createIdGenerator, type UIMessage } from 'ai';
import { getModelForDepth } from '@/lib/ai/gateway';
import { getPrompt } from '@/lib/ai/prompts';
import { POST as searchAPI } from "@/app/api/search/route";
import type { SearchResult } from "@/app/api/search/route";

/**
 * RAG Chat API - Following Vercel AI SDK Pattern
 * 
 * Documentation: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 * 
 * Flow:
 * 1. Receive last message + chatId from client
 * 2. Load previous messages from database
 * 3. Run search with latest query
 * 4. Stream response with RAG context
 * 5. Save all messages (including new response) to database
 */

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

    // Parse request body - client sends message, chatId, and optional model
    const { message, chatId, model }: { message: UIMessage; chatId: string; model?: string } = await request.json();

    if (!message || !chatId) {
      return new Response(
        JSON.stringify({ error: "Message and chatId are required" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load previous messages from database
    const { data: dbMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error('Failed to load messages');
    }

    // Convert database messages to UIMessage format
    const previousMessages: UIMessage[] = (dbMessages || []).map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(msg.created_at),
    }));

    // Append new message to previous messages
    const messages = [...previousMessages, message];

    // Extract query from latest message for search
    const query = message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Message must contain text" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chat] Processing query: "${query}"`);

    // Run full search pipeline
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

    // Build RAG context from search results
    const context = results
      .map((result, idx) => {
        return `[${idx + 1}] ${result.content}\n(Source: ${result.document_name}, Chunk ${result.chunk_index})`;
      })
      .join('\n\n---\n\n');

    // Get chat prompt from settings with context substitution
    const systemPrompt = await getPrompt('chat', { context });

    // Use provided model or default to standard
    const selectedModel = model || 'standard';
    
    // Stream response using AI SDK
    const result = streamText({
      model: getModelForDepth(selectedModel),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      temperature: 0.3,
    });

    // Consume stream to ensure completion even if client disconnects
    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Generate server-side IDs for persistence
      generateMessageId: createIdGenerator({
        prefix: 'msg',
        size: 16,
      }),
      onFinish: async ({ messages: allMessages }) => {
        // Save all messages to database
        try {
          // Delete existing messages for this session
          await supabase
            .from('chat_messages')
            .delete()
            .eq('session_id', chatId);

          // Insert all messages (including new response)
          const messagesToSave = allMessages.map((msg) => ({
            session_id: chatId,
            role: msg.role,
            content: msg.parts
              .filter(p => p.type === 'text')
              .map(p => p.text)
              .join(''),
            metadata: msg.role === 'assistant' ? {
              sources: results.map(r => ({
                document_name: r.document_name,
                chunk_index: r.chunk_index,
              })),
            } : {},
          }));

          await supabase.from('chat_messages').insert(messagesToSave);

          console.log(`[Chat] Saved ${messagesToSave.length} messages to session ${chatId}`);
        } catch (error) {
          console.error('[Chat] Failed to save messages:', error);
          // Don't fail the chat if saving fails
        }
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
