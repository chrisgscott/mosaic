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
  // Use a counter to generate unique keys across the entire document
  let citationKeyCounter = 0;
  
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Custom rendering for better styling
          p: ({ children }) => {
            // Check if children contains citation markers
            const childrenStr = Array.isArray(children) 
              ? children.filter(c => typeof c === 'string').join('') 
              : (typeof children === 'string' ? children : '');
            const hasCitations = /\[\d+\]/.test(childrenStr);
            
            // Use div instead of p when citations are present to avoid HTML validation errors
            const Container = hasCitations ? 'div' : 'p';
            const containerClassName = hasCitations ? 'mb-4 last:mb-0' : 'mb-4 last:mb-0';
            
            return (
              <Container className={containerClassName}>
                {/* Process children to inject citations */}
                {Array.isArray(children) ? children.map((child, idx) => {
                  if (typeof child === 'string') {
                    return parseCitations(child, citations, citationKeyCounter++);
                  }
                  // Return non-string children (React elements) as-is with a key
                  return <span key={`child-${idx}`}>{child}</span>;
                }) : (typeof children === 'string' ? parseCitations(children, citations, citationKeyCounter++) : children)}
              </Container>
            );
          },
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
      
      // Debug: log when citation is not found
      if (!citation) {
        console.warn(`[CitationParser] Citation [${citationNumber}] not found. Available:`, citations.map(c => c.number));
      }
      
      if (citation) {
        return (
          <InlineCitation key={`${baseKey}-${index}`}>
            <InlineCitationCard>
              <InlineCitationCardTrigger sources={[citation.title]} />
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
                        <>
                          <InlineCitationQuote>
                            {citation.quote}
                          </InlineCitationQuote>
                          <a
                            href={citation.url}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View full context →
                          </a>
                        </>
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
