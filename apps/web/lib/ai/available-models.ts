/**
 * Available AI models for Mosaic
 * 
 * This file defines all models that can be selected in the settings UI.
 * Models are organized by use case and include metadata for display.
 */

export type ModelInfo = {
  value: string; // provider/model format (e.g., 'openai/gpt-4o-mini')
  label: string; // Display name
  cost: number; // Cost per 100 pages in USD
  costDisplay: string; // Formatted cost for display
  provider: 'openai' | 'anthropic' | 'google';
  bestFor: string; // Short description of ideal use cases
  speed: 1 | 2 | 3; // 1=slow, 2=medium, 3=fast
};

export type ModelCategory = 'quick' | 'summary' | 'standard' | 'detailed' | 'deepResearch' | 'vlm';

/**
 * All available models with metadata
 */
export const ALL_MODELS: Record<string, ModelInfo> = {
  // Ultra-fast, cheapest models
  'openai/gpt-5-nano': {
    value: 'openai/gpt-5-nano',
    label: 'GPT-5 Nano',
    cost: 0.02,
    costDisplay: '$0.02',
    provider: 'openai',
    bestFor: 'High-volume classification, auto-complete, chat filters, bulk tagging',
    speed: 3,
  },
  'openai/gpt-4.1-nano': {
    value: 'openai/gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    cost: 0.02,
    costDisplay: '$0.02',
    provider: 'openai',
    bestFor: 'Email categorization, sentiment analysis, data extraction, simple translations',
    speed: 3,
  },
  
  // Fast, cheap models
  'openai/gpt-4o-mini': {
    value: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    cost: 0.03,
    costDisplay: '$0.03',
    provider: 'openai',
    bestFor: 'Customer service chatbots, FAQ responses, product descriptions, quick summaries',
    speed: 3,
  },
  'openai/gpt-4.1-mini': {
    value: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    cost: 0.08,
    costDisplay: '$0.08',
    provider: 'openai',
    bestFor: 'Code comments, PR reviews, technical documentation, API responses',
    speed: 2,
  },
  'openai/gpt-5-mini': {
    value: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    cost: 0.10,
    costDisplay: '$0.10',
    provider: 'openai',
    bestFor: 'Blog writing, marketing copy, meeting summaries, basic code generation',
    speed: 2,
  },
  
  // Multimodal fast models
  'google/gemini-2.5-flash': {
    value: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    cost: 0.13,
    costDisplay: '$0.13',
    provider: 'google',
    bestFor: 'Real-time applications, streaming, multimodal tasks, large-scale processing',
    speed: 3,
  },
  
  // Reasoning models (budget)
  'openai/o4-mini': {
    value: 'openai/o4-mini',
    label: 'O4 Mini',
    cost: 0.23,
    costDisplay: '$0.23',
    provider: 'openai',
    bestFor: 'Quick reasoning tasks, math help, step-by-step tutorials, logical problems',
    speed: 1,
  },
  'openai/o3-mini': {
    value: 'openai/o3-mini',
    label: 'O3 Mini',
    cost: 0.23,
    costDisplay: '$0.23',
    provider: 'openai',
    bestFor: 'Budget-friendly reasoning, competitive programming, puzzle solving',
    speed: 1,
  },
  
  // Production quality
  'anthropic/claude-haiku-4.5': {
    value: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    cost: 0.25,
    costDisplay: '$0.25',
    provider: 'anthropic',
    bestFor: 'Production chatbots, content rewriting, email drafting, near-real-time analysis',
    speed: 2,
  },
  
  // Full-featured models
  'openai/gpt-4.1': {
    value: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Full-stack coding, complex SQL queries, technical analysis, 1M token context',
    speed: 2,
  },
  'openai/gpt-4o': {
    value: 'openai/gpt-4o',
    label: 'GPT-4o',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Multimodal analysis, vision tasks, balanced quality and speed',
    speed: 2,
  },
  'openai/o3': {
    value: 'openai/o3',
    label: 'O3',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'STEM problem solving, code debugging, mathematical proofs, scientific analysis',
    speed: 1,
  },
  'openai/o4-mini-deep-research': {
    value: 'openai/o4-mini-deep-research',
    label: 'O4 Mini Deep Research',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Literature reviews, market research, competitive analysis, fact-checking',
    speed: 1,
  },
  
  // Premium models
  'openai/gpt-5': {
    value: 'openai/gpt-5',
    label: 'GPT-5',
    cost: 0.51,
    costDisplay: '$0.51',
    provider: 'openai',
    bestFor: 'Production coding, creative writing, complex instructions, agentic workflows',
    speed: 2,
  },
  'google/gemini-2.5-pro': {
    value: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    cost: 0.51,
    costDisplay: '$0.51',
    provider: 'google',
    bestFor: 'Long-context analysis (1M tokens), enterprise applications, Google Search grounding',
    speed: 2,
  },
  'anthropic/claude-sonnet': {
    value: 'anthropic/claude-sonnet',
    label: 'Claude Sonnet',
    cost: 0.77,
    costDisplay: '$0.77',
    provider: 'anthropic',
    bestFor: 'Software architecture, complex coding, nuanced writing, detailed analysis',
    speed: 2,
  },
  'anthropic/claude-sonnet-1m': {
    value: 'anthropic/claude-sonnet-1m',
    label: 'Claude Sonnet (1M Window)',
    cost: 0.77,
    costDisplay: '$0.77',
    provider: 'anthropic',
    bestFor: 'Entire codebase analysis, book-length documents, extensive conversation history',
    speed: 2,
  },
  
  // Advanced reasoning
  'openai/o3-deep-research': {
    value: 'openai/o3-deep-research',
    label: 'O3 Deep Research',
    cost: 2.05,
    costDisplay: '$2.05',
    provider: 'openai',
    bestFor: 'PhD-level research, comprehensive reports, investigative journalism, patent analysis',
    speed: 1,
  },
  
  // Mission-critical
  'openai/gpt-5-pro': {
    value: 'openai/gpt-5-pro',
    label: 'GPT-5 Pro',
    cost: 6.08,
    costDisplay: '$6.08',
    provider: 'openai',
    bestFor: 'Mission-critical reasoning, legal analysis, medical research, frontier AI',
    speed: 1,
  },
};

/**
 * Models available for each use case category
 */
export const MODELS_BY_CATEGORY: Record<ModelCategory, string[]> = {
  // Ultra-fast generation (HyDE, multi-query expansion)
  quick: [
    'openai/gpt-5-nano',
    'openai/gpt-4.1-nano',
    'openai/gpt-4o-mini',
  ],
  
  // Chunk summaries (needs good comprehension)
  summary: [
    'openai/gpt-4o-mini',
    'openai/gpt-4.1-mini',
    'openai/gpt-5-mini',
    'anthropic/claude-haiku-4.5',
  ],
  
  // Chat, entity extraction, graph search
  standard: [
    'openai/gpt-4o-mini',
    'openai/gpt-4.1-mini',
    'openai/gpt-5-mini',
    'google/gemini-2.5-flash',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-4.1',
  ],
  
  // Complex analysis, detailed responses
  detailed: [
    'openai/gpt-4.1',
    'openai/gpt-4o',
    'openai/gpt-5',
    'google/gemini-2.5-pro',
    'anthropic/claude-sonnet',
  ],
  
  // Advanced reasoning
  deepResearch: [
    'openai/o4-mini',
    'openai/o3-mini',
    'openai/o3',
    'openai/o4-mini-deep-research',
    'openai/o3-deep-research',
    'openai/gpt-5-pro',
  ],
  
  // Vision/multimodal
  vlm: [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-5',
    'google/gemini-2.5-flash',
    'google/gemini-2.5-pro',
    'anthropic/claude-sonnet',
  ],
};

/**
 * Get models for a specific category
 */
export function getModelsForCategory(category: ModelCategory): ModelInfo[] {
  const modelIds = MODELS_BY_CATEGORY[category];
  return modelIds.map(id => ALL_MODELS[id]).filter(Boolean);
}

/**
 * Get model info by value
 */
export function getModelInfo(value: string): ModelInfo | undefined {
  return ALL_MODELS[value];
}

/**
 * Category descriptions for UI
 */
export const CATEGORY_DESCRIPTIONS: Record<ModelCategory, string> = {
  quick: 'Ultra-fast model for simple generation tasks like HyDE and multi-query expansion. Optimized for speed and cost.',
  summary: 'Model for generating chunk summaries. Needs good comprehension to capture key information.',
  standard: 'Default model for general tasks: chat responses, entity extraction, graph search. Balance of quality and cost.',
  detailed: 'High-quality model for complex analysis and detailed responses. Use when quality is critical.',
  deepResearch: 'Advanced reasoning model for multi-step problems and deep research. Uses chain-of-thought reasoning.',
  vlm: 'Vision-language model for image analysis, OCR, and multimodal tasks. Requires vision capability.',
};
