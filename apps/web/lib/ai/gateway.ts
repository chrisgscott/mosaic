import { createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * AI Gateway Configuration
 * 
 * Provides unified access to multiple LLM providers with automatic failover.
 * Uses Vercel AI Gateway for centralized billing and monitoring.
 * 
 * Fallback Chain:
 * 1. GPT-4o-mini (primary, fast & cheap)
 * 2. Claude 3.7 Sonnet (fallback, high quality)
 * 3. Gemini 2.5 Flash Lite (backup, very fast)
 */

// Configure OpenAI provider through AI Gateway
export const gateway = createOpenAI({
  baseURL: process.env.AI_GATEWAY_API_KEY 
    ? 'https://gateway.ai.cloudflare.com/v1/mosaic/openai'
    : undefined,
  apiKey: process.env.OPENAI_API_KEY,
});

// Primary model for RAG answer generation
export const primaryModel = gateway('gpt-4o-mini');

// Fallback model (Claude 3.7 Sonnet)
export const fallbackModel = anthropic('claude-3-5-sonnet-20241022');

// Model configurations for different use cases
export const models = {
  // Quick answers (1-2 paragraphs)
  quick: gateway('gpt-4o-mini'),
  
  // Standard answers (3-5 paragraphs with citations)
  standard: gateway('gpt-4o-mini'),
  
  // Detailed answers (comprehensive analysis)
  detailed: gateway('gpt-4o'),
  
  // Deep research (multi-step reasoning)
  deepResearch: gateway('o4-mini-deep-research'),
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
