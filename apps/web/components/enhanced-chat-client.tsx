'use client';

import { useChat } from '@ai-sdk/react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ui/shadcn-io/ai/conversation';
import { Loader } from '@/components/ui/shadcn-io/ai/loader';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/shadcn-io/ai/message';
import {
  PromptInput,
  PromptInputButton,
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
import { MicIcon, PaperclipIcon, RotateCcwIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { type FormEventHandler, useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';

// Define our enhanced message interface
type EnhancedChatMessage = UIMessage & {
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
  isStreaming?: boolean;
};

// Available models - will sync with our Vercel AI Gateway models
const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'o4-mini-deep-research', name: 'o4 Mini Deep Research' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B' },
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
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  
  // useChat hook with session persistence
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id, // Session ID for persistence
    messages: initialMessages, // Load initial messages from database
    api: '/api/chat',
    // Prepare request with model selection
    prepareRequest({ messages, input }) {
      return {
        body: {
          messages,
          input,
          model: selectedModel,
          chatId: id,
        },
      };
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
    setEnhancedMessages(messages.map(msg => ({
      ...msg,
      reasoning: (msg as any).reasoning,
      sources: (msg as any).sources,
      isStreaming: status === 'streaming' && msg === messages[messages.length - 1],
    })));
  }, [messages, status]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setEnhancedMessages([{
      id: nanoid(),
      role: 'assistant',
      content: "Hello! I'm your AI assistant. I can help you with coding questions, explain concepts, and provide guidance on web development topics. What would you like to know?",
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
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const input = formData.get('message') as string;
    
    if (!input.trim() || status === 'streaming') return;
    
    sendMessage(input);
  }, [sendMessage, status]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
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

      {/* Conversation Area */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {enhancedMessages.map((message) => (
            <div key={message.id} className="space-y-3">
              <Message from={message.role}>
                <MessageContent>
                  {message.isStreaming && message.content === '' ? (
                    <div className="flex items-center gap-2">
                      <Loader size={14} />
                      <span className="text-muted-foreground text-sm">Thinking...</span>
                    </div>
                  ) : (
                    message.content
                  )}
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

      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            name="message"
            placeholder="Ask me anything about development, coding, or technology..."
            disabled={status === 'streaming'}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton disabled={status === 'streaming'}>
                <PaperclipIcon size={16} />
              </PromptInputButton>
              <PromptInputButton disabled={status === 'streaming'}>
                <MicIcon size={16} />
                <span>Voice</span>
              </PromptInputButton>
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
              status={status as any}
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
