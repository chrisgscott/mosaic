import { generateText, streamText } from 'ai';
import { getModelForDepth, type ResponseDepth } from './gateway';
import type { SearchResult } from '@/app/api/search/route';

// Simple token estimation (rough approximation)
// More accurate: use tiktoken library, but adds dependency
// TODO: Use this in Phase 6.5.2 for context window management
// function estimateTokens(text: string): number {
//   // Rough estimate: 1 token ≈ 4 characters for English
//   return Math.ceil(text.length / 4);
// }

/**
 * Deduplicate search results by chunk_id
 * Multi-Query can return the same chunk multiple times
 */
function deduplicateChunks(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.chunk_id)) {
      return false;
    }
    seen.add(result.chunk_id);
    return true;
  });
}

/**
 * Limit conversation history to prevent context window overflow
 * Keep only the most recent N turns
 */
function limitConversationHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTurns: number = 10
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (history.length <= maxTurns) {
    return history;
  }
  
  // Keep the most recent turns
  return history.slice(-maxTurns);
}

export interface GenerateAnswerOptions {
  query: string;
  searchResults: SearchResult[];
  depth?: ResponseDepth;
  includeSourceCitations?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AnswerResult {
  answer: string;
  sources: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    content: string;
    relevanceScore: number;
  }>;
  tokensUsed: {
    input: number;
    output: number;
  };
  model: string;
}

/**
 * Build the RAG prompt with retrieved context
 */
function buildRAGPrompt(
  query: string,
  searchResults: SearchResult[],
  includeSourceCitations: boolean = true
): string {
  // Deduplicate chunks first
  const uniqueResults = deduplicateChunks(searchResults);
  
  // Format search results as context
  const context = uniqueResults
    .map((result, idx) => {
      const citation = includeSourceCitations ? `[${idx + 1}]` : '';
      return `${citation} ${result.content}\n(Source: ${result.document_name}, Chunk ${result.chunk_index})`;
    })
    .join('\n\n---\n\n');

  const citationInstruction = includeSourceCitations
    ? '\n\nWhen referencing information from the context, cite your sources using [1], [2], etc.'
    : '';

  return `You are a helpful AI assistant that answers questions based on the provided context. Your goal is to provide accurate, well-structured answers that directly address the user's question.

## Context from Retrieved Documents:

${context}

## Instructions:
- Answer the question using ONLY information from the provided context
- If the context doesn't contain enough information to fully answer the question, say so clearly
- Be concise but thorough
- Structure your answer with clear paragraphs
- Use markdown formatting for better readability${citationInstruction}
- Do NOT make up information or use knowledge outside the provided context
- Your answer is ANALYSIS based on the source documents (which are FACTS)
- Be transparent about uncertainty - use phrases like "based on the documents" or "according to the sources"

## User Question:
${query}

## Your Answer:`;
}

/**
 * Build conversation prompt with history
 */
function buildConversationPrompt(
  query: string,
  searchResults: SearchResult[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  // Deduplicate chunks and limit conversation history
  const uniqueResults = deduplicateChunks(searchResults);
  const limitedHistory = limitConversationHistory(conversationHistory, 10);
  
  const context = uniqueResults
    .map((result, idx) => {
      return `[${idx + 1}] ${result.content}\n(Source: ${result.document_name})`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful AI assistant that answers questions based on provided context and conversation history. 

## Current Context:
${context}

## Instructions:
- Answer using information from the context and previous conversation
- Cite sources using [1], [2], etc.
- If context is insufficient, say so clearly
- Maintain conversation continuity
- Use markdown formatting
- Your answer is ANALYSIS based on the source documents (which are FACTS)
- Be transparent about uncertainty`;

  return [
    { role: 'system' as const, content: systemPrompt },
    ...limitedHistory,
    { role: 'user' as const, content: query },
  ];
}

/**
 * Generate a complete answer (non-streaming)
 */
export async function generateAnswer(
  options: GenerateAnswerOptions
): Promise<AnswerResult> {
  const {
    query,
    searchResults,
    depth = 'standard',
    includeSourceCitations = true,
    conversationHistory,
  } = options;

  if (searchResults.length === 0) {
    return {
      answer: "I couldn't find any relevant information in your documents to answer this question. Please try rephrasing your question or upload more documents.",
      sources: [],
      tokensUsed: { input: 0, output: 0 },
      model: 'none',
    };
  }

  const model = getModelForDepth(depth);

  try {
    let result;

    if (conversationHistory && conversationHistory.length > 0) {
      // Use conversation format
      const messages = buildConversationPrompt(query, searchResults, conversationHistory);
      result = await generateText({
        model,
        messages,
        temperature: 0.3, // Lower temperature for more factual responses
      });
    } else {
      // Use simple prompt format
      const prompt = buildRAGPrompt(query, searchResults, includeSourceCitations);
      result = await generateText({
        model,
        prompt,
        temperature: 0.3,
      });
    }

    // Extract sources with relevance scores
    const sources = searchResults.map((result) => ({
      chunkId: result.chunk_id,
      documentId: result.document_id,
      documentName: result.document_name,
      content: result.content,
      relevanceScore: result.rerank_score || result.similarity || 0,
    }));

    return {
      answer: result.text,
      sources,
      tokensUsed: {
        input: result.usage?.promptTokens || 0,
        output: result.usage?.completionTokens || 0,
      },
      model: 'standard', // Using AI Gateway standard model
    };
  } catch (error) {
    console.error('[Answer Generation] Error:', error);
    throw new Error(
      `Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate a streaming answer
 */
export async function generateStreamingAnswer(options: GenerateAnswerOptions) {
  const {
    query,
    searchResults,
    depth = 'standard',
    includeSourceCitations = true,
    conversationHistory,
  } = options;

  if (searchResults.length === 0) {
    throw new Error('No search results provided');
  }

  const model = getModelForDepth(depth);

  try {
    if (conversationHistory && conversationHistory.length > 0) {
      const messages = buildConversationPrompt(query, searchResults, conversationHistory);
      return streamText({
        model,
        messages,
        temperature: 0.3,
      });
    } else {
      const prompt = buildRAGPrompt(query, searchResults, includeSourceCitations);
      return streamText({
        model,
        prompt,
        temperature: 0.3,
      });
    }
  } catch (error) {
    console.error('[Streaming Answer] Error:', error);
    throw new Error(
      `Failed to generate streaming answer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
