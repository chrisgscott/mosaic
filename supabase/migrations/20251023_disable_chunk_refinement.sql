-- Remove chunk refinement feature
-- Decision: Not in official chunking improvements plan
-- Reason: Expensive, buggy (cascading merges), redundant with better initial chunking
-- Philosophy: Get chunking right the first time via Sorting Hat + optimal strategies

-- Remove the setting if it exists
DELETE FROM system_settings 
WHERE category = 'processing' 
  AND key = 'processing.enableChunkRefinement';

-- Remove refinement neighbors setting if it exists
DELETE FROM system_settings 
WHERE category = 'processing' 
  AND key = 'processing.refinementNeighbors';

-- Note: chunk_refiner.py file kept for reference but not used in main.py
-- Can be re-added later if needed after completing official plan phases
