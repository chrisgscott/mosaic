import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';

/**
 * Dynamic Model Configuration from Database
 * 
 * Models are loaded from system_settings table with keys like:
 * - llm.quickModel: Fast operations (HyDE, multi-query)
 * - llm.standardModel: Default tasks (chat, entities)
 * - llm.detailedModel: High-quality analysis
 * - llm.deepResearchModel: Advanced reasoning
 * - llm.summaryModel: Document summarization
 * - llm.vlmModel: Vision-language tasks
 * - llm.embeddingModel: Text embeddings
 */

/**
 * Default models (fallback if database settings unavailable)
 */
const DEFAULT_MODELS = {
  quick: 'gpt-4.1-nano',
  standard: 'gpt-4.1-mini', 
  detailed: 'gpt-4.1',
  deepResearch: 'o4-mini-deep-research',
  summary: 'gpt-4o-mini',
  vlm: 'gpt-4o-mini',
  embedding: 'text-embedding-3-small',
} as const;

/**
 * Get model configuration from database settings
 */
async function getModelSettings() {
  try {
    const supabase = await createClient();
    
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'llm');

    if (error) {
      console.warn('[Gateway] Error loading model settings, using defaults:', error);
      return DEFAULT_MODELS;
    }

    // Convert settings to model config
    const modelConfig: Record<string, string> = {};
    settings?.forEach((setting: { key: string; value: string }) => {
      // Convert llm.quickModel -> quick, llm.standardModel -> standard, etc.
      const modelType = setting.key.replace('llm.', '').replace('Model', '');
      modelConfig[modelType] = setting.value;
    });

    console.log('[Gateway] Loaded model settings:', modelConfig);
    return { ...DEFAULT_MODELS, ...modelConfig };
  } catch (error) {
    console.error('[Gateway] Error loading model settings:', error);
    return DEFAULT_MODELS;
  }
}

/**
 * Create dynamic models object
 */
export async function getModels() {
  const modelSettings = await getModelSettings();
  
  return {
    quick: openai(modelSettings.quick || DEFAULT_MODELS.quick),
    standard: openai(modelSettings.standard || DEFAULT_MODELS.standard),
    detailed: openai(modelSettings.detailed || DEFAULT_MODELS.detailed),
    deepResearch: openai(modelSettings.deepResearch || DEFAULT_MODELS.deepResearch),
    summary: openai(modelSettings.summary || DEFAULT_MODELS.summary),
    vlm: openai(modelSettings.vlm || DEFAULT_MODELS.vlm),
  } as const;
}

/**
 * Get embedding model (separate from language models)
 */
export async function getEmbeddingModel() {
  const modelSettings = await getModelSettings();
  return openai.embedding(modelSettings.embedding || DEFAULT_MODELS.embedding);
}

/**
 * Cached models for synchronous access
 * Note: This loads models once at startup. Settings changes require restart.
 */
let cachedModels: Awaited<ReturnType<typeof getModels>> | null = null;

async function getCachedModels() {
  if (!cachedModels) {
    cachedModels = await getModels();
  }
  return cachedModels;
}

/**
 * Synchronous model access (for compatibility with existing code)
 */
export const models = new Proxy({} as Awaited<ReturnType<typeof getModels>>, {
  get(target, prop) {
    if (!cachedModels) {
      throw new Error('Models not initialized. Call initModels() first.');
    }
    return cachedModels[prop as keyof typeof cachedModels];
  }
});

/**
 * Initialize models at startup
 */
export async function initModels() {
  cachedModels = await getModels();
}

/**
 * Get the appropriate model for a given response depth
 */
export async function getModelForDepth(depth: keyof Awaited<ReturnType<typeof getModels>> = 'standard') {
  const models = await getCachedModels();
  return models[depth];
}

/**
 * Get model type for TypeScript
 */
export type ModelDepth = keyof Awaited<ReturnType<typeof getModels>>;

/**
 * Estimate token cost for a query
 * Based on GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.60;
  return inputCost + outputCost;
}

