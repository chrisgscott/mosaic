/**
 * AI Model Settings Integration
 * 
 * Loads model configurations from database and integrates with AI Gateway.
 * Provides dynamic model selection based on admin settings.
 */

import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';

/**
 * Model settings stored in database
 */
export type ModelSettings = {
  quickModel: string;
  standardModel: string;
  detailedModel: string;
  deepResearchModel: string;
  summaryModel: string;
  vlmModel: string;
};

/**
 * Default model settings (fallback if database is unavailable)
 * Models are in provider/model format for AI Gateway
 */
const DEFAULT_MODELS: ModelSettings = {
  quickModel: 'openai/gpt-4.1-nano',
  standardModel: 'openai/gpt-4o-mini',
  detailedModel: 'openai/gpt-4o',
  deepResearchModel: 'openai/o4-mini-deep-research',
  summaryModel: 'openai/gpt-4o-mini',
  vlmModel: 'openai/gpt-4o',
};

/**
 * Load model settings from database
 * 
 * Returns configured models or defaults if database is unavailable.
 * Models are cached for the duration of the request.
 */
export async function getModelSettings(): Promise<ModelSettings> {
  try {
    const supabase = await createClient();
    
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'llm');

    if (error) {
      console.warn('[AI Settings] Error loading model settings, using defaults:', error);
      return DEFAULT_MODELS;
    }

    // Convert database settings to ModelSettings object
    const modelSettings: Partial<ModelSettings> = {};
    
    settings?.forEach((setting) => {
      const key = setting.key.replace('llm.', '');
      // Remove quotes from JSON string value
      const value = typeof setting.value === 'string' 
        ? setting.value.replace(/^"|"$/g, '')
        : setting.value;
      
      if (key in DEFAULT_MODELS) {
        modelSettings[key as keyof ModelSettings] = value;
      }
    });

    // Merge with defaults for any missing settings
    return {
      ...DEFAULT_MODELS,
      ...modelSettings,
    };
  } catch (error) {
    console.warn('[AI Settings] Error loading model settings, using defaults:', error);
    return DEFAULT_MODELS;
  }
}

/**
 * Get configured models for use in API routes
 * 
 * Returns gateway-wrapped models based on database settings.
 * 
 * @example
 * ```ts
 * const models = await getConfiguredModels();
 * 
 * // Use in HyDE generation
 * const result = await generateText({
 *   model: models.quick,
 *   prompt: 'Generate hypothetical document...'
 * });
 * ```
 */
export async function getConfiguredModels() {
  const settings = await getModelSettings();
  
  // Settings now store model names directly (no provider prefix)
  return {
    quick: openai(settings.quickModel),
    standard: openai(settings.standardModel),
    detailed: openai(settings.detailedModel),
    deepResearch: openai(settings.deepResearchModel),
    summary: openai(settings.summaryModel),
    vlm: openai(settings.vlmModel),
  };
}

/**
 * Model usage descriptions for UI
 */
export const MODEL_DESCRIPTIONS = {
  quickModel: {
    title: 'Quick Model',
    description: 'Ultra-fast & cheap model for simple generation',
    usedFor: [
      'HyDE hypothetical document generation',
      'Multi-query expansion',
      'Simple text generation',
    ],
  },
  summaryModel: {
    title: 'Summary Model',
    description: 'Model for chunk summarization (better comprehension than quick model)',
    usedFor: [
      'Chunk summaries',
      'Document summarization',
      'Content condensation',
    ],
  },
  standardModel: {
    title: 'Standard Model',
    description: 'Default model for general tasks',
    usedFor: [
      'Chat responses',
      'Entity extraction',
      'Graph search & relationship extraction',
      'General analysis',
    ],
  },
  detailedModel: {
    title: 'Detailed Model',
    description: 'High-quality model for complex analysis',
    usedFor: [
      'Detailed chat responses',
      'Complex reasoning',
      'Important decisions',
      'Comprehensive analysis',
    ],
  },
  deepResearchModel: {
    title: 'Deep Research Model',
    description: 'Advanced reasoning for multi-step problems',
    usedFor: [
      'Complex research tasks',
      'Multi-step reasoning',
      'Deep analysis',
      'Sophisticated problem solving',
    ],
  },
  vlmModel: {
    title: 'Vision-Language Model',
    description: 'Multimodal model for image analysis',
    usedFor: [
      'Image analysis and OCR',
      'Visual understanding',
      'Chart interpretation',
      'Document image processing',
    ],
  },
} as const;
