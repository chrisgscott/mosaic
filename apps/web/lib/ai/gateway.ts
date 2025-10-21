import { createGateway } from '@ai-sdk/gateway';

/**
 * Vercel AI Gateway Configuration
 * 
 * Official Vercel AI Gateway provides:
 * - Unified API across 20+ providers (OpenAI, Anthropic, Google, xAI, etc.)
 * - Automatic failover and retry logic
 * - Centralized usage tracking and cost monitoring
 * - Provider-level routing and load balancing
 * - OIDC authentication for Vercel deployments
 * 
 * Documentation: https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 * Dashboard: https://vercel.com/ai-gateway
 */

// Initialize Vercel AI Gateway
// Uses AI_GATEWAY_API_KEY from environment or OIDC for Vercel deployments
export const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

/**
 * Model configurations for different use cases
 * 
 * Format: 'provider/model-name'
 * Available providers: openai, anthropic, google, xai, groq, deepseek, etc.
 * 
 * Philosophy:
 * - quick: Fast, cheap operations (HyDE, multi-query, simple tasks)
 * - standard: Default chat responses, entity extraction
 * - detailed: High-quality analysis, complex reasoning
 * - deepResearch: Advanced reasoning with o1/o4 models
 * - vlm: Vision tasks requiring multimodal models
 */
/**
 * Default models (used as fallback if settings unavailable)
 * These match the database defaults and use provider/model format
 */
export const models = {
  // Core models for different quality/speed tradeoffs
  quick: gateway('openai/gpt-4.1-nano'),              // Ultra-fast: HyDE, multi-query
  standard: gateway('openai/gpt-4o-mini'),            // Default: chat, entities, graph
  detailed: gateway('openai/gpt-4o'),                 // High quality: complex analysis
  deepResearch: gateway('openai/o4-mini-deep-research'), // Advanced reasoning
  
  // Specialized models
  summary: gateway('openai/gpt-4o-mini'),             // Chunk summaries
  vlm: gateway('openai/gpt-4o'),                      // Vision/multimodal
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

/**
 * Provider routing options for advanced use cases
 * 
 * Example usage:
 * ```ts
 * import type { GatewayProviderOptions } from '@ai-sdk/gateway';
 * 
 * const result = await generateText({
 *   model: gateway('anthropic/claude-sonnet-4'),
 *   prompt: 'Hello',
 *   providerOptions: {
 *     gateway: {
 *       order: ['vertex', 'anthropic'], // Try Vertex AI first
 *       only: ['vertex', 'anthropic'],  // Only use these providers
 *       user: 'user-123',                // Track usage per user
 *       tags: ['chat', 'v2'],            // Tag for analytics
 *     }
 *   }
 * });
 * ```
 */
