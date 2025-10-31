/**
 * Available AI models for Mosaic
 * 
 * This file defines all models that can be selected in the settings UI.
 * Models are organized by use case and include metadata for display.
 */

export type ModelInfo = {
  value: string; // model name without provider prefix (e.g., 'gpt-4o-mini')
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
  'gpt-5-nano': {
    value: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    cost: 0.02,
    costDisplay: '$0.02',
    provider: 'openai',
    bestFor: 'High-volume classification, auto-complete, chat filters, bulk tagging',
    speed: 3,
  },
  'gpt-4.1-nano': {
    value: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    cost: 0.02,
    costDisplay: '$0.02',
    provider: 'openai',
    bestFor: 'Email categorization, sentiment analysis, data extraction, simple translations',
    speed: 3,
  },
  
  // Fast, cheap models
  'gpt-4o-mini': {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    cost: 0.03,
    costDisplay: '$0.03',
    provider: 'openai',
    bestFor: 'Customer service chatbots, FAQ responses, product descriptions, quick summaries',
    speed: 3,
  },
  'gpt-4.1-mini': {
    value: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    cost: 0.08,
    costDisplay: '$0.08',
    provider: 'openai',
    bestFor: 'Code comments, PR reviews, technical documentation, API responses',
    speed: 2,
  },
  'gpt-5-mini': {
    value: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    cost: 0.10,
    costDisplay: '$0.10',
    provider: 'openai',
    bestFor: 'Blog writing, marketing copy, meeting summaries, basic code generation',
    speed: 2,
  },
  
  // Multimodal fast models
  'gemini-2.5-flash': {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    cost: 0.13,
    costDisplay: '$0.13',
    provider: 'google',
    bestFor: 'Real-time applications, streaming, multimodal tasks, large-scale processing',
    speed: 3,
  },
  
  // Reasoning models (budget)
  'o4-mini': {
    value: 'o4-mini',
    label: 'O4 Mini',
    cost: 0.23,
    costDisplay: '$0.23',
    provider: 'openai',
    bestFor: 'Quick reasoning tasks, math help, step-by-step tutorials, logical problems',
    speed: 1,
  },
  'o3-mini': {
    value: 'o3-mini',
    label: 'O3 Mini',
    cost: 0.23,
    costDisplay: '$0.23',
    provider: 'openai',
    bestFor: 'Budget-friendly reasoning, competitive programming, puzzle solving',
    speed: 1,
  },
  
  // Production quality
  'claude-haiku-4.5': {
    value: 'claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    cost: 0.25,
    costDisplay: '$0.25',
    provider: 'anthropic',
    bestFor: 'Production chatbots, content rewriting, email drafting, near-real-time analysis',
    speed: 2,
  },
  
  // Full-featured models
  'gpt-4.1': {
    value: 'gpt-4.1',
    label: 'GPT-4.1',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Full-stack coding, complex SQL queries, technical analysis, 1M token context',
    speed: 2,
  },
  'gpt-4o': {
    value: 'gpt-4o',
    label: 'GPT-4o',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Multimodal analysis, vision tasks, balanced quality and speed',
    speed: 2,
  },
  'o3': {
    value: 'o3',
    label: 'O3',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'STEM problem solving, code debugging, mathematical proofs, scientific analysis',
    speed: 1,
  },
  'o4-mini-deep-research': {
    value: 'o4-mini-deep-research',
    label: 'O4 Mini Deep Research',
    cost: 0.41,
    costDisplay: '$0.41',
    provider: 'openai',
    bestFor: 'Literature reviews, market research, competitive analysis, fact-checking',
    speed: 1,
  },
  
  // Premium models
  'gpt-5': {
    value: 'gpt-5',
    label: 'GPT-5',
    cost: 0.51,
    costDisplay: '$0.51',
    provider: 'openai',
    bestFor: 'Production coding, creative writing, complex instructions, agentic workflows',
    speed: 2,
  },
  'gemini-2.5-pro': {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    cost: 0.51,
    costDisplay: '$0.51',
    provider: 'google',
    bestFor: 'Long-context analysis (1M tokens), enterprise applications, Google Search grounding',
    speed: 2,
  },
  'claude-sonnet': {
    value: 'claude-sonnet',
    label: 'Claude Sonnet',
    cost: 0.77,
    costDisplay: '$0.77',
    provider: 'anthropic',
    bestFor: 'Software architecture, complex coding, nuanced writing, detailed analysis',
    speed: 2,
  },
  'claude-sonnet-1m': {
    value: 'claude-sonnet-1m',
    label: 'Claude Sonnet (1M Window)',
    cost: 0.77,
    costDisplay: '$0.77',
    provider: 'anthropic',
    bestFor: 'Entire codebase analysis, book-length documents, extensive conversation history',
    speed: 2,
  },
  
  // Advanced reasoning
  'o3-deep-research': {
    value: 'o3-deep-research',
    label: 'O3 Deep Research',
    cost: 2.05,
    costDisplay: '$2.05',
    provider: 'openai',
    bestFor: 'PhD-level research, comprehensive reports, investigative journalism, patent analysis',
    speed: 1,
  },
  
  // Mission-critical
  'gpt-5-pro': {
    value: 'gpt-5-pro',
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
    'gpt-5-nano',
    'gpt-4.1-nano',
    'gpt-4o-mini',
  ],
  
  // Chunk summaries (needs good comprehension)
  summary: [
    'gpt-4o-mini',
    'gpt-4.1-mini',
    'gpt-5-mini',
    'claude-haiku-4.5',
  ],
  
  // Chat, entity extraction, graph search
  standard: [
    'gpt-4o-mini',
    'gpt-4.1-mini',
    'gpt-5-mini',
    'gemini-2.5-flash',
    'claude-haiku-4.5',
    'gpt-4.1',
  ],
  
  // Complex analysis, detailed responses
  detailed: [
    'gpt-4.1',
    'gpt-4o',
    'gpt-5',
    'gemini-2.5-pro',
    'claude-sonnet',
  ],
  
  // Advanced reasoning
  deepResearch: [
    'o4-mini',
    'o3-mini',
    'o3',
    'o4-mini-deep-research',
    'o3-deep-research',
    'gpt-5-pro',
  ],
  
  // Vision/multimodal
  vlm: [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-5',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'claude-sonnet',
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
