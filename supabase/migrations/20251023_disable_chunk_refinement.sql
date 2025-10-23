-- Disable chunk refinement temporarily
-- The chunk refiner is merging too aggressively (131 chunks → 2 chunks)
-- causing embedding failures due to chunks exceeding 8192 token limit

INSERT INTO system_settings (category, key, value, description, updated_at)
VALUES (
  'processing',
  'processing.enableChunkRefinement',
  'false',
  'Enable chunk refinement to improve semantic boundaries (EXPERIMENTAL - currently disabled due to over-merging)',
  NOW()
)
ON CONFLICT (category, key) 
DO UPDATE SET 
  value = 'false',
  description = 'Enable chunk refinement to improve semantic boundaries (EXPERIMENTAL - currently disabled due to over-merging)',
  updated_at = NOW();
