import { redirect } from 'next/navigation';
import { requireAdmin } from "@/lib/auth/admin-check";
import { createClient } from '@/lib/supabase/server';

/**
 * Chat Root Page - Creates new session and redirects
 * 
 * Following Vercel AI SDK pattern:
 * https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 * 
 * Flow:
 * 1. User visits /chat
 * 2. Create new session in database
 * 3. Redirect to /chat/[id] with session ID in URL
 */
export default async function ChatPage() {
  // Check admin access
  const { user } = await requireAdmin();

  const supabase = await createClient();

  // Create new chat session
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: user.id,
      title: 'New Chat',
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error('Failed to create chat session');
  }

  // Redirect to chat page with session ID
  redirect(`/admin/chat/${session.id}`);
}
