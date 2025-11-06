import { createClient } from '@/lib/supabase/server';
import { streamText, convertToModelMessages, createIdGenerator, stepCountIs, type UIMessage, generateText } from 'ai';
import { getModelForDepth, type ModelDepth } from '@/lib/ai/gateway';
import { getPrompt } from '@/lib/ai/prompts';
import { searchTools, searchToolsWithWeb } from "@/lib/ai/tools-fixed";
import { addProgress } from './[id]/progress/route';

// Progress event type
export type ProgressEvent = {
  message: string;
  status: 'in-progress' | 'completed';
  timestamp: string;
};

/**
 * Tool-Based RAG Chat API - Following Vercel AI SDK Pattern
 * 
 * Documentation: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 * 
 * Flow:
 * 1. Receive last message + chatId from client
 * 2. Load previous messages from database
 * 3. Stream response with AI-powered tool selection
 * 4. AI decides when to search and which tool to use
 * 5. Tools handle search with progress visibility
 * 6. Save all messages (including new response) to database
 * 
 * Tools Available:
 * - search_documents: Comprehensive search (90% of queries)
 * - quick_search: Fast semantic-only search
 * - deep_graph_search: Extended relationship exploration
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

    // Parse request body - client sends message, chatId, optional model, and webSearchEnabled
    const { message, chatId, model, webSearchEnabled }: { 
      message: UIMessage | { text: string }; 
      chatId: string; 
      model?: string;
      webSearchEnabled?: boolean;
    } = await request.json();

    console.log('[Chat] Request params:', { chatId, model, webSearchEnabled });

    if (!message || !chatId) {
      return new Response(
        JSON.stringify({ error: "Message and chatId are required" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert message format if needed
    let uiMessage: UIMessage;
    if ('text' in message) {
      // Convert { text: string } to UIMessage format
      uiMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        parts: [{ type: 'text' as const, text: message.text }],
        // createdAt is not supported in UIMessage interface
      };
    } else {
      uiMessage = message;
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
    const messages = [...previousMessages, uiMessage];

    // Extract query from latest message for search
    const query = uiMessage.parts
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

    // Add initial progress to SSE stream
    addProgress(chatId, 'Analyzing your question', 'completed');

    // Get chat prompt (now includes tool guidance)
    const systemPrompt = await getPrompt('chat', { 
      context: '', // Context will be provided by tools
    });

    // Use provided model or default to standard
    const selectedModel = model || 'standard';
    
    // Store session ID globally for tool access
    (global as typeof global & { currentChatSessionId?: string }).currentChatSessionId = chatId;

    // Deep research models require OpenAI's native tools (web_search_preview, mcp, file_search)
    // Our custom tools aren't compatible, so disable them for deep research
    const isDeepResearch = selectedModel === 'deepResearch';
    
    // Select tools based on web search toggle (unless deep research)
    const selectedTools = isDeepResearch ? undefined : (webSearchEnabled ? searchToolsWithWeb : searchTools);
    
    if (isDeepResearch) {
      console.log('[Chat] Deep research model - tools disabled (uses internal reasoning)');
    } else {
      console.log(`[Chat] Using tools: ${Object.keys(selectedTools || {}).join(', ')}`);
    }

    // Stream response using AI SDK with tools
    const result = streamText({
      model: await getModelForDepth(selectedModel as ModelDepth),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      tools: selectedTools,
      temperature: 0.3,
      stopWhen: isDeepResearch ? undefined : stepCountIs(5), // Deep research doesn't need multi-step
    });

    // Consume stream to ensure completion even if client disconnects
    result.consumeStream();

    addProgress(chatId, 'Generating response', 'completed');

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Generate server-side IDs for persistence
      generateMessageId: createIdGenerator({
        prefix: 'msg',
        size: 16,
      }),
      onFinish: async ({ messages: allMessages, responseMessage }) => {
        // Save all messages to database
        try {
          // Delete existing messages for this session
          await supabase
            .from('chat_messages')
            .delete()
            .eq('session_id', chatId);

          // Extract sources from tool calls in the assistant message
          const sources: Array<{
            number: string;
            title: string;
            url: string;
            description: string;
            quote: string;
            score?: number;
            chunk_id: string;
            document_id: string;
            chunk_index: number;
          }> = [];

          // Check if responseMessage has tool calls and extract results
          if (responseMessage && responseMessage.parts) {
            responseMessage.parts.forEach((part) => {
              // Check if this is a tool part with output (AI SDK v5 format)
              const toolPart = part as unknown as { 
                type: string; 
                output?: { results?: unknown[] };
                state?: string;
              };
              
              // Tool parts have type like "tool-search_documents" and output with results
              if (toolPart.type?.startsWith('tool-') && 
                  toolPart.state === 'output-available' && 
                  toolPart.output?.results) {
                // Extract search results from tool output
                const searchResults = toolPart.output.results;
                searchResults.slice(0, 10).forEach((result: unknown) => {
                  const r = result as {
                    // Document search fields
                    document_name?: string;
                    document_id?: string;
                    chunk_id?: string;
                    chunk_index?: number;
                    content?: string;
                    rerank_score?: number;
                    // Web search fields
                    title?: string;
                    url?: string;
                    description?: string;
                    quote?: string;
                    score?: number;
                    source?: string;
                  };
                  
                  // Check if this is a web search result (has 'source' field or external URL)
                  const isWebResult = r.source === 'web' || (r.url && !r.url.startsWith('/'));
                  
                  if (isWebResult) {
                    // Web search result
                    sources.push({
                      number: (sources.length + 1).toString(),
                      title: r.title || 'Web Result',
                      url: r.url || '#',
                      description: r.description || '',
                      quote: r.quote || r.description?.substring(0, 200) || '',
                      score: r.score,
                      chunk_id: 'web',
                      document_id: 'web',
                      chunk_index: 0,
                    });
                  } else {
                    // Document search result
                    sources.push({
                      number: (sources.length + 1).toString(),
                      title: r.document_name || 'Unknown',
                      url: `/admin/documents/${r.document_id}#chunk-${r.chunk_id}`,
                      description: `Chunk ${r.chunk_index || 0}`,
                      quote: r.content?.substring(0, 200) + (r.content && r.content.length > 200 ? '...' : '') || '',
                      score: r.rerank_score,
                      chunk_id: r.chunk_id || '',
                      document_id: r.document_id || '',
                      chunk_index: r.chunk_index || 0,
                    });
                  }
                });
              }
            });
          }
          
          console.log(`[Chat] Extracted ${sources.length} sources from tool results`);

          // Get the current max message_index for this session
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select('message_index')
            .eq('session_id', chatId)
            .order('message_index', { ascending: false })
            .limit(1)
            .single();

          const startIndex = (lastMessage?.message_index ?? -1) + 1;

          // Insert all messages (including new response) with sequential indices
          const messagesToSave = allMessages.map((msg, idx) => ({
            session_id: chatId,
            role: msg.role,
            content: msg.parts
              .filter(p => p.type === 'text')
              .map(p => p.text)
              .join(''),
            message_index: startIndex + idx,
            metadata: msg.role === 'assistant' ? {
              sources, // Include full source metadata for inline citations
            } : {},
          }));

          await supabase.from('chat_messages').insert(messagesToSave);

          console.log(`[Chat] Saved ${messagesToSave.length} messages to session ${chatId}`);

          // Generate session title after first user message (async, non-blocking)
          if (startIndex === 0) {
            generateSessionTitle(chatId, allMessages[0].parts.filter(p => p.type === 'text').map(p => p.text).join(''))
              .catch(err => console.error('[Chat] Failed to generate title:', err));
          }
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

/**
 * Generate a concise title for a chat session based on the first user message
 * Uses gpt-4.1-nano for fast, cheap title generation
 */
async function generateSessionTitle(sessionId: string, firstMessage: string): Promise<void> {
  try {
    const supabase = await createClient();
    const quickModel = await getModelForDepth('quick');

    const { text: title } = await generateText({
      model: quickModel,
      prompt: `Generate a concise, descriptive title (3-6 words) for a chat conversation that starts with this user message. Return ONLY the title, no quotes or extra text.\n\nUser message: ${firstMessage.substring(0, 500)}`,
    });

    // Clean up title (remove quotes, trim, capitalize)
    const cleanTitle = title
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .trim()
      .substring(0, 100); // Max 100 chars

    // Update session title
    await supabase
      .from('chat_sessions')
      .update({ title: cleanTitle })
      .eq('id', sessionId);

    console.log(`[Chat] Generated title for session ${sessionId}: "${cleanTitle}"`);
  } catch (error) {
    console.error('[Chat] Error generating session title:', error);
    // Don't throw - title generation is non-critical
  }
}
