import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

/**
 * GET /api/chat/[id]/messages
 * Fetch all messages for a chat session (used to reload messages with sources after streaming)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: chatId } = await params;

    // Fetch messages from database ordered by message_index
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', chatId)
      .order('message_index', { ascending: true });

    if (error) {
      console.error('[Messages API] Error fetching messages:', error);
      return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Convert to UIMessage format
    const uiMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: new Date(msg.created_at),
      // Pass sources and progress as data (not metadata, since this is from DB)
      data: {
        ...(msg.metadata?.sources ? { sources: msg.metadata.sources } : {}),
        ...(msg.metadata?.progress ? { progress: msg.metadata.progress } : {}),
      },
    }));

    return Response.json({ messages: uiMessages });
  } catch (error) {
    console.error('[Messages API] Unexpected error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
