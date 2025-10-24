-- Check search_signals table
SELECT 
  id,
  query,
  created_at,
  array_length(chunk_ids, 1) as chunk_count,
  array_length(entity_ids, 1) as entity_count,
  array_length(rerank_scores, 1) as score_count
FROM search_signals
ORDER BY created_at DESC
LIMIT 10;

-- Count total signals
SELECT COUNT(*) as total_signals FROM search_signals;

-- Check if table exists and has correct structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'search_signals'
ORDER BY ordinal_position;
