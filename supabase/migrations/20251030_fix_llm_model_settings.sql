-- Add missing summaryModel setting
INSERT INTO system_settings (key, value, description, category) VALUES
  (
    'llm.summaryModel',
    '"gpt-4o-mini"',
    'Model for generating chunk summaries: needs good comprehension to capture key information from document chunks.',
    'llm'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
