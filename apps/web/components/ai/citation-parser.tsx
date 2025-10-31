'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationSource,
  InlineCitationQuote,
} from '@/components/ui/shadcn-io/ai/inline-citation';

export interface Citation {
  number: string;
  title: string;
  url: string;
  description?: string;
  quote?: string;
}

interface CitationParserProps {
  content: string;
  citations: Citation[];
  className?: string;
  isStreaming?: boolean;
}

/**
 * Parses markdown content and replaces [1], [2], etc. with inline citation components
 */
export function CitationParser({ content, citations, className, isStreaming }: CitationParserProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Custom rendering for better styling
          p: ({ children }) => (
            <p className="mb-4 last:mb-0">
              {/* Process children to inject citations */}
              {Array.isArray(children) ? children.map((child, idx) => {
                if (typeof child === 'string') {
                  return parseCitations(child, citations, idx);
                }
                return child;
              }) : parseCitations(String(children), citations, 0)}
            </p>
          ),
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

/**
 * Helper function to parse citation markers and inject citation components
 */
function parseCitations(text: string, citations: Citation[], baseKey: number): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  
  return parts.map((part, index) => {
    const citationMatch = part.match(/\[(\d+)\]/);
    
    if (citationMatch) {
      const citationNumber = citationMatch[1];
      const citation = citations.find(c => c.number === citationNumber);
      
      if (citation) {
        return (
          <InlineCitation key={`${baseKey}-${index}`}>
            <InlineCitationCard>
              <InlineCitationCardTrigger sources={[citation.url]} />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselIndex />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    <InlineCitationCarouselItem>
                      <InlineCitationSource
                        title={citation.title}
                        url={citation.url}
                        description={citation.description}
                      />
                      {citation.quote && (
                        <InlineCitationQuote>
                          {citation.quote}
                        </InlineCitationQuote>
                      )}
                    </InlineCitationCarouselItem>
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        );
      }
    }
    
    return part;
  });
}
