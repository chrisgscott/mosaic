'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Message } from '@/components/ai/message';
import { Sources } from '@/components/ai/sources';
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    chunkIndex: number;
    relevanceScore: number;
  }>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setLoadingStatus('Searching through your documents...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          depth: 'standard',
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'sources') {
                assistantMessage.sources = data.sources;
                setLoadingStatus('Generating answer...');
              } else if (data.type === 'text') {
                assistantMessage.content += data.content;
                setStreamingContent(assistantMessage.content);
              } else if (data.type === 'done') {
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamingContent('');
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setLoadingStatus('');
      inputRef.current?.focus();
    }
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

          {messages.map((message) => (
            <div key={message.id} className="space-y-4">
              {message.role === 'user' ? (
                <Message role="user" content={message.content} />
              ) : (
                <>
                  <div className="flex gap-3 p-4 rounded-lg bg-background">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2 overflow-hidden">
                      <div className="text-sm font-medium">Assistant</div>
                      <MarkdownResponse content={message.content} />
                    </div>
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <Sources sources={message.sources} />
                  )}
                </>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {isLoading && streamingContent && (
            <div className="space-y-4">
              <div className="flex gap-3 p-4 rounded-lg bg-background">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-2 overflow-hidden">
                  <div className="text-sm font-medium">Assistant</div>
                  <MarkdownResponse content={streamingContent} isStreaming />
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 p-4 rounded-lg bg-background">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium">Assistant</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingStatus || 'Processing...'}
                </div>
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
                disabled={isLoading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
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
