'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownResponseProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export function MarkdownResponse({ content, className, isStreaming }: MarkdownResponseProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
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
              <code className="block p-4 rounded bg-muted font-mono text-sm overflow-x-auto" {...props}>
                {children}
              </code>
            ),
          a: ({ children, href }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
      )}
    </div>
  );
}
