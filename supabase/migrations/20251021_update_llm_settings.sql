-- Update system settings to use consolidated AI Gateway model structure
-- This migration replaces granular model settings with 5 core models

-- Remove old granular model settings
DELETE FROM system_settings 
WHERE key IN (
  'search.graphModel',
  'search.hydeModel', 
  'search.multiQueryModel',
  'processing.vlmModel'
);

-- Insert new consolidated LLM model settings
INSERT INTO system_settings (key, value, description, category) VALUES
  -- Core models for different quality/speed tradeoffs
  (
    'llm.quickModel',
    '"gpt-4o-mini"',
    'Fast & cheap model for simple tasks: HyDE generation, multi-query expansion, basic text generation. Used when speed and cost matter more than quality.',
    'llm'
  ),
  (
    'llm.standardModel',
    '"gpt-4o-mini"',
    'Default model for general tasks: chat responses, entity extraction, graph search, standard analysis. Good balance of quality and cost.',
    'llm'
  ),
  (
    'llm.detailedModel',
    '"gpt-4o"',
    'High-quality model for complex analysis: detailed responses, important decisions, comprehensive reasoning. Use when quality is critical.',
    'llm'
  ),
  (
    'llm.deepResearchModel',
    '"o4-mini-deep-research"',
    'Advanced reasoning model for multi-step problems: complex research, deep analysis, sophisticated reasoning chains. Uses OpenAI o1/o4 models.',
    'llm'
  ),
  (
    'llm.vlmModel',
    '"gpt-4o"',
    'Vision-language model for image analysis: OCR, visual understanding, image description, chart interpretation. Requires multimodal capability.',
    'llm'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Add comment explaining the model structure
COMMENT ON COLUMN system_settings.value IS 'Model name without provider prefix (e.g., "gpt-4o-mini" not "openai/gpt-4o-mini"). Provider is configured in AI Gateway.';
