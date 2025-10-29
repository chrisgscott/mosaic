import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from "@/lib/auth/admin-check";
import { createClient } from '@/lib/supabase/server';
import { ChatClient } from '@/components/chat-client';
import type { UIMessage } from 'ai';

/**
 * Chat Session Page - Loads existing session and displays chat
 * 
 * Following Vercel AI SDK pattern:
 * https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 */
export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/auth/login');
  }

  const { id } = await params;

  // Load session
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (sessionError || !session) {
    notFound();
  }

  // Load messages for this session
  const { data: messages, error: messagesError } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new Error('Failed to load messages');
  }

  // Convert database messages to UIMessage format
  const initialMessages: UIMessage[] = (messages || []).map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    parts: [{ type: 'text' as const, text: msg.content }],
    createdAt: new Date(msg.created_at),
  }));

  return <ChatClient id={id} initialMessages={initialMessages} />;
}
