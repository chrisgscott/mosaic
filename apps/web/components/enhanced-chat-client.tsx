'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useProgressStream } from '@/hooks/use-progress-stream';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ui/shadcn-io/ai/conversation';
import { Loader } from '@/components/ui/shadcn-io/ai/loader';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/shadcn-io/ai/message';
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ui/shadcn-io/ai/prompt-input';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ui/shadcn-io/ai/reasoning';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ui/shadcn-io/ai/source';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { type FormEventHandler, useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ProgressEvent } from '@/app/api/chat/route';

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older dates, show the actual date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Define citation type
export interface Citation {
  number: string;
  title: string;
  url: string;
  description?: string;
  quote?: string;
}

// Define our enhanced message interface
type EnhancedChatMessage = UIMessage & {
  reasoning?: string;
  sources?: Citation[];
  progress?: ProgressEvent[];
  isStreaming?: boolean;
  createdAt?: Date;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    state: 'call' | 'result' | 'partial-call';
    result?: any;
  }>;
};

// Available models - using our semantic model keys
const models = [
  { id: 'quick', name: 'Quick (GPT-4.1 Nano)' },
  { id: 'standard', name: 'Standard (GPT-4o Mini)' },
  { id: 'detailed', name: 'Detailed (GPT-4.1)' },
  { id: 'deepResearch', name: 'Deep Research (o4 Mini)' },
  { id: 'summary', name: 'Summary (GPT-4.1 Mini)' },
];

/**
 * Enhanced Chat Client Component
 * 
 * Features:
 * - Professional ChatGPT-style interface
 * - Model selection dropdown
 * - Reasoning sections (collapsible "thinking")
 * - Source citations with auto-counting
 * - Streaming without scroll jumping
 * - Mobile-optimized with touch targets
 * - Keyboard shortcuts (Enter to send, Shift+Enter for newlines)
 * - Screen reader friendly
 */
export function EnhancedChatClient({
  id,
  initialMessages = [],
  sessionTitle = 'New Chat',
  createdAt,
  updatedAt,
}: {
  id: string;
  initialMessages?: UIMessage[];
  sessionTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  const [selectedModel, setSelectedModel] = useState('standard'); // Default to standard model
  const [currentTitle, setCurrentTitle] = useState(sessionTitle);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt);
  
  // SSE progress stream for real-time updates
  const { currentStep } = useProgressStream(id);
  
  // useChat hook with session persistence
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id, // Session ID for persistence
    messages: initialMessages, // Load initial messages from database
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Send only the last message to reduce payload
      prepareSendMessagesRequest({ messages, id }) {
        return {
          body: {
            message: messages[messages.length - 1],
            chatId: id,
            model: selectedModel,
          },
        };
      },
    }),
    // After streaming completes and sources are saved to DB, reload messages
    async onFinish({ message }) {
      // Only reload if this is an assistant message (not user message echo)
      if (message.role !== 'assistant') return;
      
      console.log('[EnhancedChat] Stream finished, reloading messages from DB...');
      
      // Small delay to ensure backend onFinish has completed saving to DB
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // Fetch updated messages from DB (includes sources)
        const messagesResponse = await fetch(`/api/chat/${id}/messages`);
        if (messagesResponse.ok) {
          const { messages: updatedMessages } = await messagesResponse.json();
          // Update the chat with messages that include sources
          setMessages(updatedMessages);
          console.log('[EnhancedChat] Messages reloaded with sources');
        }

        // Fetch updated session metadata (title, updatedAt)
        const sessionResponse = await fetch(`/api/chat/sessions/${id}`);
        if (sessionResponse.ok) {
          const { session } = await sessionResponse.json();
          if (session.title) {
            setCurrentTitle(session.title);
            console.log('[EnhancedChat] Title updated:', session.title);
          }
          if (session.updated_at) {
            setCurrentUpdatedAt(session.updated_at);
          }
        }
      } catch (error) {
        console.error('[EnhancedChat] Failed to reload messages:', error);
      }
    },
  });

  // Enhanced message state with reasoning and sources
  const [enhancedMessages, setEnhancedMessages] = useState<EnhancedChatMessage[]>(
    initialMessages.map(msg => ({
      ...msg,
      reasoning: undefined,
      sources: undefined,
      isStreaming: false,
    }))
  );

  // Update enhanced messages when chat messages change
  useEffect(() => {
    // No sorting needed - database orders by message_index
    // Map real messages with enhanced data
    const realMessages = messages.map(msg => {
      // Check both metadata (streaming) and data (DB load) for sources
      const metadata = (msg as { metadata?: { sources?: Citation[]; progress?: ProgressEvent[] } }).metadata;
      const data = (msg as { data?: { sources?: Citation[]; progress?: ProgressEvent[] } }).data;
      const sources = metadata?.sources || data?.sources || (msg as EnhancedChatMessage).sources;
      const progress = metadata?.progress || data?.progress || (msg as EnhancedChatMessage).progress;
      
      // Debug logging
      if (msg.role === 'assistant') {
        console.log('[EnhancedChat] Assistant message:', {
          id: msg.id,
          hasMetadata: !!metadata,
          hasData: !!data,
          metadataSources: metadata?.sources?.length || 0,
          dataSources: data?.sources?.length || 0,
          finalSources: sources?.length || 0,
          metadata: metadata,
          data: data,
        });
      }
      
      return {
        ...msg,
        reasoning: (msg as EnhancedChatMessage).reasoning,
        // Extract sources and progress from message metadata/data
        sources,
        progress,
        isStreaming: status === 'streaming' && msg === messages[messages.length - 1],
      };
    });
    
    setEnhancedMessages(realMessages);
  }, [messages, status]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/sessions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('[EnhancedChat] Session deleted successfully');
        // Redirect to new chat
        window.location.href = '/admin/chat';
      } else {
        console.error('[EnhancedChat] Failed to delete session');
        alert('Failed to delete chat session. Please try again.');
      }
    } catch (error) {
      console.error('[EnhancedChat] Error deleting session:', error);
      alert('An error occurred while deleting the chat.');
    }
  }, [id]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback((event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const input = formData.get('message') as string;
    
    if (!input.trim() || status === 'streaming') return;
    
    // Immediately add a "thinking" assistant message for instant feedback
    const thinkingMessage: EnhancedChatMessage = {
      id: `thinking-${Date.now()}`,
      role: 'assistant',
      parts: [{ type: 'text' as const, text: '' }],
      createdAt: new Date(),
      reasoning: undefined,
      sources: undefined,
      isStreaming: true,
    };
    
    setEnhancedMessages(prev => [...prev, thinkingMessage]);
    
    // Append the message to the chat using correct format
    sendMessage({ text: input.trim() });
    
    // Clear the input field
    form.reset();
  }, [sendMessage, status, setEnhancedMessages]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{currentTitle}</span>
          </div>
          {currentUpdatedAt && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-muted-foreground text-xs">
                Updated {formatRelativeTime(currentUpdatedAt)}
              </span>
            </>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleDelete}
          className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Delete chat</span>
        </Button>
      </div>

      {/* Conversation Area - Scrollable */}
      <Conversation className="flex-1 overflow-hidden">
        <ConversationContent className="space-y-4">
          {enhancedMessages.map((message) => (
            <div key={message.id} className="space-y-3">
              <Message from={message.role}>
                <MessageContent>
                  {(() => {
                    // Extract text content from message parts
                    const textContent = message.parts
                      ?.filter(part => part.type === 'text')
                      .map(part => {
                        // Debug: log if text is not a string
                        if (typeof part.text !== 'string') {
                          console.error('[EnhancedChat] Non-string text in part:', part);
                        }
                        return part.text;
                      })
                      .join('') || '';
                    
                    if (message.isStreaming && textContent === '') {
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Loader size={14} />
                            <span className="text-muted-foreground text-sm">{currentStep || 'Thinking...'}</span>
                          </div>
                          
                          {/* Real-time Progress Display - now using simple currentStep above */}
                        </div>
                      );
                    }
                    
                    // Render clean markdown for assistant messages
                    if (message.role === 'assistant') {
                      return (
                        <div className="space-y-3">
                          {/* Progress for completed messages - not shown with simple display */}
                          
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
                                // Custom rendering for better styling
                                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="mb-4 ml-6 list-disc">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal">{children}</ol>,
                                li: ({ children }) => <li className="mb-1">{children}</li>,
                                code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
                                  inline ? (
                                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-sm" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <pre className="mb-4 rounded-lg bg-muted p-3 overflow-x-auto">
                                      <code className="font-mono text-sm" {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  ),
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                                blockquote: ({ children }) => (
                                  <blockquote className="mb-4 border-l-4 border-muted-foreground/20 pl-4 italic">
                                    {children}
                                  </blockquote>
                                ),
                                h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
                                h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold">{children}</h2>,
                                h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold">{children}</h3>,
                                h4: ({ children }) => <h4 className="mb-2 text-base font-semibold">{children}</h4>,
                              }}
                            >
                              {textContent}
                            </ReactMarkdown>
                          </div>
                        </div>
                      );
                    }
                    
                    return <div className="whitespace-pre-wrap">{textContent}</div>;
                  })()}
                </MessageContent>
                <MessageAvatar 
                  src={message.role === 'user' ? 'https://github.com/dovazencot.png' : 'https://github.com/vercel.png'} 
                  name={message.role === 'user' ? 'User' : 'AI'} 
                />
              </Message>

              {/* Reasoning */}
              {message.reasoning && (
                <div className="ml-10">
                  <Reasoning isStreaming={message.isStreaming} defaultOpen={false}>
                    <ReasoningTrigger />
                    <ReasoningContent>{message.reasoning}</ReasoningContent>
                  </Reasoning>
                </div>
              )}

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="ml-10">
                  <Sources>
                    <SourcesTrigger count={message.sources.length} />
                    <SourcesContent>
                      {message.sources.map((source, index) => (
                        <Source key={index} href={source.url} title={source.title} />
                      ))}
                    </SourcesContent>
                  </Sources>
                </div>
              )}
            </div>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t p-4 shrink-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            name="message"
            placeholder="Ask me anything about development, coding, or technology..."
            disabled={status === 'streaming'}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputModelSelect 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                disabled={status === 'streaming'}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {models.map((model) => (
                    <PromptInputModelSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit 
              disabled={status === 'streaming'}
              status={status as 'ready' | 'streaming' | 'submitted'}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {/* Error Display */}
      {error && (
        <div className="border-t bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Error: {error.message}
          </p>
        </div>
      )}
    </div>
  );
}
