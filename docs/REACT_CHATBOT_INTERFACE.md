# React AI Chatbot Interface
URL: /blocks/ai-chatbot
React AI chatbot with streaming responses and reasoning display. Complete ChatGPT-style interface with model selection, sources, and TypeScript support using shadcn/ui.

***

title: React AI Chatbot Interface
description: React AI chatbot with streaming responses and reasoning display. Complete ChatGPT-style interface with model selection, sources, and TypeScript support using shadcn/ui.
icon: MessageCircle
-------------------

<PoweredBy
  packages={[
  { name: "React", url: "https://react.dev" },
  { name: "AI Conversation", url: "/components/ai-conversation" },
  { name: "AI Message", url: "/components/ai-message" },
  { name: "AI Prompt Input", url: "/components/ai-prompt-input" },
  { name: "AI Reasoning", url: "/components/ai-reasoning" },
  { name: "AI Sources", url: "/components/ai-sources" },
  { name: "Lucide React", url: "https://lucide.dev/" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com" },
]}
/>

<Callout title="Building AI chat interfaces?">
  [Join our Discord community](https://discord.com/invite/Z9NVtNE7bj) for help
  from other developers.
</Callout>

<br />

Everyone's building AI chat now. Slap together a text input and div for messages, call it done. Then spend three weeks debugging why messages flicker during streaming, scroll jumps around, and users can't tell when the AI is thinking versus broken. This React component handles the annoying stuff—proper streaming states, scroll management, and all the UI details users expect from ChatGPT.

<Preview path="ai-chatbot" type="block" />

```
'use client';
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
type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  reasoning?: string;
  sources?: Array<{ title: string; url: string }>;
  isStreaming?: boolean;
};
const models = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B' },
];
const sampleResponses = [
  {
    content: "I'd be happy to help you with that! React is a powerful JavaScript library for building user interfaces. What specific aspect would you like to explore?",
    reasoning: "The user is asking about React, which is a broad topic. I should provide a helpful overview while asking for more specific information to give a more targeted response.",
    sources: [
      { title: "React Official Documentation", url: "https://react.dev" },
      { title: "React Developer Tools", url: "https://react.dev/learn" }
    ]
  },
  {
    content: "Next.js is an excellent framework built on top of React that provides server-side rendering, static site generation, and many other powerful features out of the box.",
    reasoning: "The user mentioned Next.js, so I should explain its relationship to React and highlight its key benefits for modern web development.",
    sources: [
      { title: "Next.js Documentation", url: "https://nextjs.org/docs" },
      { title: "Vercel Next.js Guide", url: "https://vercel.com/guides/nextjs" }
    ]
  },
  {
    content: "TypeScript adds static type checking to JavaScript, which helps catch errors early and improves code quality. It's particularly valuable in larger applications.",
    reasoning: "TypeScript is becoming increasingly important in modern development. I should explain its benefits while keeping the explanation accessible.",
    sources: [
      { title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs" },
      { title: "TypeScript with React", url: "https://react.dev/learn/typescript" }
    ]
  }
];
const Example = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nanoid(),
      content: "Hello! I'm your AI assistant. I can help you with coding questions, explain concepts, and provide guidance on web development topics. What would you like to know?",
      role: 'assistant',
      timestamp: new Date(),
      sources: [
        { title: "Getting Started Guide", url: "#" },
        { title: "API Documentation", url: "#" }
      ]
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const simulateTyping = useCallback((messageId: string, content: string, reasoning?: string, sources?: Array<{ title: string; url: string }>) => {
    let currentIndex = 0;
    const typeInterval = setInterval(() => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const currentContent = content.slice(0, currentIndex);
          return {
            ...msg,
            content: currentContent,
            isStreaming: currentIndex < content.length,
            reasoning: currentIndex >= content.length ? reasoning : undefined,
            sources: currentIndex >= content.length ? sources : undefined,
          };
        }
        return msg;
      }));
      currentIndex += Math.random() > 0.1 ? 1 : 0; // Simulate variable typing speed
      
      if (currentIndex >= content.length) {
        clearInterval(typeInterval);
        setIsTyping(false);
        setStreamingMessageId(null);
      }
    }, 50);
    return () => clearInterval(typeInterval);
  }, []);
  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback((event) => {
    event.preventDefault();
    
    if (!inputValue.trim() || isTyping) return;
    // Add user message
    const userMessage: ChatMessage = {
      id: nanoid(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    // Simulate AI response with delay
    setTimeout(() => {
      const responseData = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
      const assistantMessageId = nanoid();
      
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);
      
      // Start typing simulation
      simulateTyping(assistantMessageId, responseData.content, responseData.reasoning, responseData.sources);
    }, 800);
  }, [inputValue, isTyping, simulateTyping]);
  const handleReset = useCallback(() => {
    setMessages([
      {
        id: nanoid(),
        content: "Hello! I'm your AI assistant. I can help you with coding questions, explain concepts, and provide guidance on web development topics. What would you like to know?",
        role: 'assistant',
        timestamp: new Date(),
        sources: [
          { title: "Getting Started Guide", url: "#" },
          { title: "API Documentation", url: "#" }
        ]
      }
    ]);
    setInputValue('');
    setIsTyping(false);
    setStreamingMessageId(null);
  }, []);
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500" />
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
          {messages.map((message) => (
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me anything about development, coding, or technology..."
            disabled={isTyping}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton disabled={isTyping}>
                <PaperclipIcon size={16} />
              </PromptInputButton>
              <PromptInputButton disabled={isTyping}>
                <MicIcon size={16} />
                <span>Voice</span>
              </PromptInputButton>
              <PromptInputModelSelect 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                disabled={isTyping}
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
              disabled={!inputValue.trim() || isTyping}
              status={isTyping ? 'streaming' : 'ready'}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};
export default Example;
```
## ai/conversation
```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
export type ConversationProps = ComponentProps<typeof StickToBottom>;
export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn('relative flex-1 overflow-y-auto', className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);
export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;
export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <StickToBottom.Content className={cn('p-4', className)} {...props} />
);
export type ConversationScrollButtonProps = ComponentProps<typeof Button>;
export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);
  return (
    !isAtBottom && (
      <Button
        className={cn(
          'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
```
## ai/loader
```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
type LoaderIconProps = {
  size?: number;
};
const LoaderIcon = ({ size = 16 }: LoaderIconProps) => (
  <svg
    height={size}
    strokeLinejoin="round"
    style={{ color: 'currentcolor' }}
    viewBox="0 0 16 16"
    width={size}
  >
    <title>Loader</title>
    <g clipPath="url(#clip0_2393_1490)">
      <path d="M8 0V4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 16V12"
        opacity="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.29773 1.52783L5.64887 4.7639"
        opacity="0.9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12.7023 1.52783L10.3511 4.7639"
        opacity="0.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12.7023 14.472L10.3511 11.236"
        opacity="0.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.29773 14.472L5.64887 11.236"
        opacity="0.6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15.6085 5.52783L11.8043 6.7639"
        opacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M0.391602 10.472L4.19583 9.23598"
        opacity="0.7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15.6085 10.4722L11.8043 9.2361"
        opacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M0.391602 5.52783L4.19583 6.7639"
        opacity="0.8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </g>
    <defs>
      <clipPath id="clip0_2393_1490">
        <rect fill="white" height="16" width="16" />
      </clipPath>
    </defs>
  </svg>
);
export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
};
export const Loader = ({ className, size = 16, ...props }: LoaderProps) => (
  <div
    className={cn(
      'inline-flex animate-spin items-center justify-center',
      className
    )}
    {...props}
  >
    <LoaderIcon size={size} />
  </div>
);
```
## ai/message

```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';
export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};
export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-end justify-end gap-2 py-4',
      from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
      '[&>div]:max-w-[80%]',
      className
    )}
    {...props}
  />
);
export type MessageContentProps = HTMLAttributes<HTMLDivElement>;
export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm',
      'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground',
      'group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground',
      className
    )}
    {...props}
  >
    <div className="is-user:dark">{children}</div>
  </div>
);
export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};
export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar
    className={cn('size-8 ring ring-1 ring-border', className)}
    {...props}
  >
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
  </Avatar>
);
```
## ai/prompt-input

```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChatStatus } from 'ai';
import { Loader2Icon, SendIcon, SquareIcon, XIcon } from 'lucide-react';
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from 'react';
import { Children } from 'react';
export type PromptInputProps = HTMLAttributes<HTMLFormElement>;
export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      'w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm',
      className
    )}
    {...props}
  />
);
export type PromptInputTextareaProps = ComponentProps<typeof Textarea> & {
  minHeight?: number;
  maxHeight?: number;
};
export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = 'What would you like to know?',
  minHeight = 48,
  maxHeight = 164,
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow newline
        return;
      }
      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };
  return (
    <Textarea
      className={cn(
        'w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0',
        'field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent',
        'focus-visible:ring-0',
        className
      )}
      name="message"
      onChange={(e) => {
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};
export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn('flex items-center justify-between p-1', className)}
    {...props}
  />
);
export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;
export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div
    className={cn(
      'flex items-center gap-1',
      '[&_button:first-child]:rounded-bl-xl',
      className
    )}
    {...props}
  />
);
export type PromptInputButtonProps = ComponentProps<typeof Button>;
export const PromptInputButton = ({
  variant = 'ghost',
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? 'default' : 'icon';
  return (
    <Button
      className={cn(
        'shrink-0 gap-1.5 rounded-lg',
        variant === 'ghost' && 'text-muted-foreground',
        newSize === 'default' && 'px-3',
        className
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};
export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
};
export const PromptInputSubmit = ({
  className,
  variant = 'default',
  size = 'icon',
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <SendIcon className="size-4" />;
  if (status === 'submitted') {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === 'error') {
    Icon = <XIcon className="size-4" />;
  }
  return (
    <Button
      className={cn('gap-1.5 rounded-lg', className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};
export type PromptInputModelSelectProps = ComponentProps<typeof Select>;
export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);
export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;
export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      'border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors',
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props}
  />
);
export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;
export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);
export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;
export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);
export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;
export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
```
## ai/reasoning

```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use client';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BrainIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { createContext, memo, useContext, useEffect, useState } from 'react';
import { Response } from './response';
type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};
const ReasoningContext = createContext<ReasoningContextValue | null>(null);
const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error('Reasoning components must be used within Reasoning');
  }
  return context;
};
export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};
const AUTO_CLOSE_DELAY = 1000;
export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = false,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });
    const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.round((Date.now() - startTime) / 1000));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);
    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (isStreaming && !isOpen) {
        setIsOpen(true);
      } else if (!isStreaming && isOpen && !defaultOpen && !hasAutoClosedRef) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosedRef(true);
        }, AUTO_CLOSE_DELAY);
        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosedRef]);
    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };
    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn('not-prose mb-4', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);
export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  title?: string;
};
export const ReasoningTrigger = memo(
  ({
    className,
    title = 'Reasoning',
    children,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();
    return (
      <CollapsibleTrigger
        className={cn(
          'flex items-center gap-2 text-muted-foreground text-sm',
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {isStreaming || duration === 0 ? (
              <p>Thinking...</p>
            ) : (
              <p>Thought for {duration} seconds</p>
            )}
            <ChevronDownIcon
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                isOpen ? 'rotate-180' : 'rotate-0'
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);
export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};
export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        'mt-4 text-sm',
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
        className
      )}
      {...props}
    >
      <Response className="grid gap-2">{children}</Response>
    </CollapsibleContent>
  )
);
Reasoning.displayName = 'Reasoning';
ReasoningTrigger.displayName = 'ReasoningTrigger';
ReasoningContent.displayName = 'ReasoningContent';
```
## ai/source

```
/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BookIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
export type SourcesProps = ComponentProps<'div'>;
export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn('not-prose mb-4 text-primary text-xs', className)}
    {...props}
  />
);
export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};
export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger className="flex items-center gap-2" {...props}>
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
);
export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;
export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-3 flex w-fit flex-col gap-2',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
);
export type SourceProps = ComponentProps<'a'>;
export const Source = ({ href, title, children, ...props }: SourceProps) => (
  <a
    className="flex items-center gap-2"
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon className="h-4 w-4" />
        <span className="block font-medium">{title}</span>
      </>
    )}
  </a>
);
```

## button

```
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
export { Button, buttonVariants }

```

Built with TypeScript and shadcn/ui. Combines dedicated AI components for conversation display, message formatting, prompt input, and reasoning sections. The component handles streaming coordination, scroll management, and state updates so you can focus on connecting your AI API.

## Why most AI chat UIs suck

Your basic chat implementation works fine until users start actually using it. Messages arrive character by character but the scroll jumps around. No visual feedback when the AI is thinking—users assume it's broken. The model dropdown conflicts with the input focus. Auto-scroll fights with manual scrolling. Trust me, I've debugged this exact combination at least five times.

This component handles the coordination nightmares: streaming without scroll jumping, typing indicators that don't break layout, model switching that doesn't lose focus, and proper loading states throughout. Plus reasoning sections and source citations because users expect transparency now, not just raw responses.

Built with accessibility in mind—screen readers work with streaming content, keyboard navigation doesn't break during updates, and touch targets are sized properly for mobile.

## Installation

<Installer packageName="ai-chatbot" />

## Usage

```tsx
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@repo/ai/conversation';
import { Message, MessageAvatar, MessageContent } from '@repo/ai/message';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from '@repo/ai/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@repo/ai/reasoning';
import { Sources, SourcesContent, SourcesTrigger } from '@repo/ai/sources';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <div className="flex h-full w-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>{message.content}</MessageContent>
              <MessageAvatar src={message.avatar} name={message.name} />
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
        />
        <PromptInputToolbar>
          <PromptInputSubmit disabled={!input.trim()} />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
};
```

## Features

* **Streaming that doesn't break scroll** - Messages appear character by character without jumping the viewport around
* **Smart auto-scroll management** - Stays at bottom during streaming, lets users read history without fighting back
* **Model switching** - Dropdown for GPT-4, Claude, Gemini, etc. with persistence and proper state coordination
* **Reasoning sections** - Collapsible "thinking" display that auto-expands during AI reasoning, manual toggle after
* **Source citations** - Expandable reference links with automatic counting ("Used 3 sources")
* **Proper loading states** - Typing indicators, submit button states, and visual feedback throughout
* **TypeScript everywhere** - Complete interfaces for messages, reasoning, sources, and streaming states
* **Touch-friendly mobile** - 44px touch targets, virtual keyboard handling, responsive conversation layout
* **Keyboard shortcuts** - Enter to send, Shift+Enter for newlines, Escape to cancel, Tab navigation
* **Copy-paste ready** - Import the components, connect your API, done. No state management confusion
* **shadcn/ui integration** - Uses existing design tokens and works with your theme customization
* **Screen reader friendly** - ARIA live regions for streaming, proper focus management, reduced motion support

## Use Cases

This free open source React component works perfectly for:

* **AI customer support** - Interactive help systems with reasoning transparency and source attribution in Next.js applications
* **Development assistants** - Code help chatbots with model selection and conversation management using TypeScript
* **Content creation tools** - Writing assistants with streaming responses and multi-model support
* **Educational platforms** - Learning chatbots with step-by-step reasoning display and source verification
* **Research interfaces** - AI research tools with citation tracking and conversation organization
* **Documentation helpers** - Interactive docs with AI guidance and contextual source linking
* **Product demos** - Showcase AI capabilities with professional chat interfaces and model comparison
* **Enterprise applications** - Internal AI tools with audit trails and reasoning transparency

## API Reference

### AIChatbot

The main chatbot interface component providing complete conversational AI functionality.

| Prop            | Type                        | Default | Description                                  |
| --------------- | --------------------------- | ------- | -------------------------------------------- |
| `messages`      | `ChatMessage[]`             | `[]`    | Array of conversation messages with metadata |
| `onMessageSend` | `(message: string) => void` | -       | Callback when user sends a message           |
| `isStreaming`   | `boolean`                   | `false` | Whether AI is currently responding           |
| `selectedModel` | `string`                    | -       | Currently selected AI model identifier       |
| `onModelChange` | `(model: string) => void`   | -       | Callback when user changes AI model          |
| `className`     | `string`                    | -       | Additional CSS classes for container         |
| `...props`      | `HTMLAttributes`            | -       | All HTML div attributes supported            |

### ChatMessage Interface

| Property      | Type                    | Description                           |
| ------------- | ----------------------- | ------------------------------------- |
| `id`          | `string`                | Unique message identifier             |
| `content`     | `string`                | Message text content                  |
| `role`        | `'user' \| 'assistant'` | Message sender role                   |
| `timestamp`   | `Date`                  | Message creation time                 |
| `reasoning`   | `string`                | Optional AI reasoning text            |
| `sources`     | `Source[]`              | Optional citation sources             |
| `isStreaming` | `boolean`               | Whether message is actively streaming |

### Conversation Management

The component automatically handles:

* **Message state** with proper React state updates and re-rendering
* **Scroll behavior** with auto-scroll to latest and manual scroll controls
* **Streaming coordination** between input states and message display
* **Model persistence** saving user preferences to localStorage

### Streaming Specifications

| Element           | Behavior                       | Animation       | Accessibility          |
| ----------------- | ------------------------------ | --------------- | ---------------------- |
| Message content   | Character-by-character display | 50ms intervals  | Screen reader friendly |
| Reasoning section | Auto-expand when complete      | Slide animation | Keyboard navigable     |
| Sources list      | Appear after message           | Fade in         | Focus management       |
| Typing indicator  | Pulsing loader                 | Continuous      | ARIA live region       |

## Common gotchas

**Message streaming performance**: Character-by-character updates can cause React re-render performance issues with long messages. The component uses optimized state updates and memoization to handle this efficiently.

**Conversation scroll management**: Auto-scrolling during streaming can conflict with user manual scrolling. The component detects user scroll intent and temporarily disables auto-scroll until the user returns to bottom.

**Model switching during streaming**: Changing models while a message is streaming can cause state conflicts. The component properly cancels ongoing streams and resets state when model selection changes.

**Accessibility with dynamic content**: Screen readers struggle with rapidly changing content during streaming. The component uses ARIA live regions and proper focus management to ensure accessibility.

**Mobile keyboard interactions**: Virtual keyboards on mobile can disrupt conversation scrolling and input focus. The component handles viewport changes and maintains proper scroll positioning.

**TypeScript message types**: Strict typing for AI messages requires proper interface definitions. Ensure your message objects match the ChatMessage interface for full type safety.

## Explore the components it's built with

This AI chatbot combines multiple specialized AI components from our collection:

<Cards>
  <Card href="/ai/conversation" title="Conversation" description="Scrollable conversation container with auto-scroll and manual controls" />

  <Card href="/ai/message" title="Message" description="Individual message display with avatars and content formatting" />

  <Card href="/ai/prompt-input" title="Prompt Input" description="Advanced input component with model selection and tool buttons" />

  <Card href="/ai/reasoning" title="Reasoning" description="Collapsible reasoning display showing AI thought processes" />

  <Card href="/ai/sources" title="Sources" description="Expandable source citations for AI response transparency" />

  <Card href="/ai/loader" title="Loader" description="Animated loading indicator for AI processing states" />
</Cards>

## Questions developers actually ask

<Accordions type="single">
  <Accordion id="openai-integration" title="How do I connect this to OpenAI or Anthropic APIs?">
    This handles the UI, you handle the API. Use Vercel AI SDK or just fetch() with streaming. Update the messages state as responses come in. The component accepts any object matching the ChatMessage interface—doesn't care where the data comes from.
  </Accordion>

  <Accordion id="scroll-jumping" title="Why does my scroll position jump around during streaming?">
    Classic problem. The component tracks whether users are manually scrolling and only auto-scrolls when they're at the bottom. Uses proper scroll restoration and doesn't fight with user intent. Way better than naive "always scroll to bottom" approaches.
  </Accordion>

  <Accordion id="model-switching" title="Can I add more AI models to the dropdown?">
    Yeah, just pass your models array. Works with any provider—OpenAI, Anthropic, local models, whatever. The component persists the selection and handles switching without breaking ongoing streams.
  </Accordion>

  <Accordion id="streaming-performance" title="Does character-by-character streaming cause performance issues?">
    It can if you're naive about it. The component uses optimized React updates and proper memoization. Won't cause re-render storms like basic implementations do. Tested with 2000+ character responses.
  </Accordion>

  <Accordion id="mobile-keyboard" title="How does this handle mobile virtual keyboards?">
    Virtual keyboards are annoying—they resize the viewport and mess up scroll positioning. The component detects these changes and maintains proper scroll state. Input stays focused, conversation stays readable.
  </Accordion>

  <Accordion id="conversation-persistence" title="How do I save conversations across browser sessions?">
    Messages live in React state. For persistence, JSON.stringify the messages array to localStorage, send to your backend, whatever. Restore on mount. The component doesn't care about your storage strategy.
  </Accordion>

  <Accordion id="reasoning-timing" title="When do the reasoning sections appear?">
    Include a reasoning property in your message objects. The sections auto-expand during streaming (so users see the AI "thinking"), then become manually toggleable. Same pattern ChatGPT uses.
  </Accordion>

  <Accordion id="bundle-size" title="What's the bundle impact of all these AI components?">
    The whole AI component collection is \~15kb gzipped. Individual components are smaller—Conversation (\~3kb), Message (\~2kb), PromptInput (\~4kb). Tree-shaking works properly so you only bundle what you import.
  </Accordion>
</Accordions>
