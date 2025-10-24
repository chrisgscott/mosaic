'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MarkdownResponse } from '@/components/ai/markdown-response';
import { Send, Loader2, Bot } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Chat Page - Vercel AI SDK Implementation
 * 
 * Uses useChat hook for automatic:
 * - Message state management
 * - Streaming responses
 * - Error handling
 * - Loading states
 * - Optimistic updates
 * 
 * Documentation: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
 */
export default function ChatPage() {
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create a new session when component mounts
  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' }),
        });
        
        if (response.ok) {
          const { session } = await response.json();
          setSessionId(session.id);
          console.log('[Chat] Created session:', session.id);
        }
      } catch (error) {
        console.error('[Chat] Failed to create session:', error);
      }
    };

    createSession();
  }, []);

  // useChat hook handles all chat state and streaming automatically
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        session_id: sessionId,
      },
    }),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || status !== 'ready') return;

    // sendMessage automatically handles everything
    sendMessage({ text: input.trim() });
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Standard Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Chat</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <Card className="p-8 text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Welcome to RAG Chat</h2>
              <p className="text-muted-foreground mb-4">
                Ask questions about your documents and get accurate answers with source citations.
              </p>
              <div className="grid gap-2 max-w-md mx-auto text-left">
                <div className="text-sm">
                  <strong>Example questions:</strong>
                </div>
                <div className="text-sm text-muted-foreground">
                  • &ldquo;What are the main findings in the research paper?&rdquo;
                </div>
                <div className="text-sm text-muted-foreground">
                  • &ldquo;Summarize the key points from the meeting notes&rdquo;
                </div>
                <div className="text-sm text-muted-foreground">
                  • &ldquo;How does X relate to Y?&rdquo;
                </div>
              </div>
            </Card>
          )}

          {messages.map((message) => {
            // Extract text from message parts
            const textContent = message.parts
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join('');

            return (
              <div key={message.id} className="space-y-4">
                <div className="flex gap-3 p-4 rounded-lg bg-background">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {message.role === 'user' ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2 overflow-hidden">
                    <div className="text-sm font-medium">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <MarkdownResponse 
                      content={textContent} 
                      isStreaming={status === 'streaming' && message.id === messages[messages.length - 1]?.id}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {status === 'submitted' && (
            <div className="flex gap-3 p-4 rounded-lg bg-background">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium">Assistant</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching through your documents...
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-destructive">Error</div>
                <div className="text-sm text-muted-foreground">
                  Something went wrong. Please try again.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (messages.length > 0) {
                      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
                      if (lastUserMessage) {
                        const text = lastUserMessage.parts
                          .filter(p => p.type === 'text')
                          .map(p => p.text)
                          .join('');
                        sendMessage({ text });
                      }
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your documents..."
                disabled={status !== 'ready'}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={status !== 'ready' || !input.trim()}>
                {status === 'submitted' || status === 'streaming' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <div className="text-xs text-muted-foreground mt-2">
              Answers are generated from your uploaded documents. Press Enter to send.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
