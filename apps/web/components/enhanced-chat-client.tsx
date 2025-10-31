'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
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
import { cn } from '@/lib/utils';
import { RotateCcwIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { type FormEventHandler, useCallback, useEffect, useState } from 'react';
import { MarkdownResponse } from '@/components/ai/markdown-response';

// Define our enhanced message interface
type EnhancedChatMessage = UIMessage & {
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
  isStreaming?: boolean;
  createdAt?: Date;
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
}: {
  id: string;
  initialMessages?: UIMessage[];
}) {
  const [selectedModel, setSelectedModel] = useState('standard'); // Default to standard model
  
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
    // Map real messages with enhanced data
    const realMessages = messages.map(msg => ({
      ...msg,
      reasoning: (msg as EnhancedChatMessage).reasoning,
      sources: (msg as EnhancedChatMessage).sources,
      isStreaming: status === 'streaming' && msg === messages[messages.length - 1],
    }));
    
    setEnhancedMessages(realMessages);
  }, [messages, status]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setEnhancedMessages([{
      id: nanoid(),
      role: 'assistant',
      parts: [{ 
        type: 'text' as const, 
        text: "Hello! I'm your AI assistant. I can help you with coding questions, explain concepts, and provide guidance on web development topics. What would you like to know?" 
      }],
      createdAt: new Date(),
      reasoning: undefined,
      sources: [
        { title: "Getting Started Guide", url: "#" },
        { title: "API Documentation", url: "#" }
      ],
      isStreaming: false,
    }]);
  }, [setMessages]);

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
            <div className={cn(
              "size-2 rounded-full",
              status === 'streaming' ? "bg-green-500 animate-pulse" : "bg-green-500"
            )} />
            <span className="font-medium text-sm">AI Assistant</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-muted-foreground text-xs">
            {models.find(m => m.id === selectedModel)?.name}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleReset}
          className="h-8 px-2"
        >
          <RotateCcwIcon className="size-4" />
          <span className="ml-1">Reset</span>
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
                      .map(part => part.text)
                      .join('') || '';
                    
                    if (message.isStreaming && textContent === '') {
                      return (
                        <div className="flex items-center gap-2">
                          <Loader size={14} />
                          <span className="text-muted-foreground text-sm">Thinking...</span>
                        </div>
                      );
                    }
                    
                    // Render markdown for assistant messages, plain text for user messages
                    if (message.role === 'assistant') {
                      return (
                        <MarkdownResponse 
                          content={textContent} 
                          isStreaming={message.isStreaming}
                        />
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
