import { openai } from '@ai-sdk/openai';

/**
 * OpenAI Direct Configuration
 * 
 * Uses OpenAI SDK directly without AI Gateway for simplicity.
 * All models use standard OpenAI model names (no provider prefix).
 */

/**
 * Model Registry
 * 
 * Centralized model definitions with semantic names.
 * All models use direct OpenAI SDK.
 * 
 * Model Selection Guide:
 * - quick: Fast, cheap operations (HyDE, multi-query generation)
 * - standard: Default for most tasks (chat, entity extraction)
 * - detailed: High-quality analysis (complex reasoning)
 * - deepResearch: Advanced reasoning with extended thinking
 * - summary: Document/chunk summarization
 * - vlm: Vision-language model for image understanding
 * - embedding: Text embeddings for semantic search
 */
/**
 * Default models (used as fallback if settings unavailable)
 * These match the database defaults and use provider/model format
 */
export const models = {
  // Core models for different quality/speed tradeoffs
  quick: openai('gpt-4.1-nano'),              // Ultra-fast: HyDE, multi-query
  standard: openai('gpt-4o-mini'),            // Default: chat, entities, graph
  detailed: openai('gpt-4.1'),                // High quality: complex analysis
  deepResearch: openai('o4-mini-deep-research'), // Advanced reasoning
  
  // Specialized models
  summary: openai('gpt-4.1-mini'),            // Chunk/document summarization
  vlm: openai('gpt-4o-mini'),                 // Vision-language model
  embedding: openai('text-embedding-3-small'), // Semantic embeddings
} as const;

export type ResponseDepth = keyof typeof models;

/**
 * Get the appropriate model for a given response depth
 */
export function getModelForDepth(depth: ResponseDepth = 'standard') {
  return models[depth];
}

/**
 * Estimate token cost for a query
 * Based on GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.60;
  return inputCost + outputCost;
}

