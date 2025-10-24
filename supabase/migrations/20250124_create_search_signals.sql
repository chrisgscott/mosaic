-- Migration: Create search_signals table for graph learning
-- Purpose: Capture search patterns to discover implicit entity relationships
-- Phase 1 of Graph Learning from Search Patterns

-- Search signals table (raw search data)
CREATE TABLE IF NOT EXISTS search_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Query information
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  
  -- Results information
  chunk_ids UUID[] NOT NULL DEFAULT '{}',
  entity_ids UUID[] DEFAULT '{}',
  rerank_scores FLOAT[] DEFAULT '{}',
  
  -- User engagement (optional, for future use)
  clicked_chunk_ids UUID[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_search_signals_user_id ON search_signals(user_id);
CREATE INDEX idx_search_signals_created_at ON search_signals(created_at DESC);
CREATE INDEX idx_search_signals_user_created ON search_signals(user_id, created_at DESC);

-- Index for similarity search on query embeddings (for finding similar searches)
CREATE INDEX idx_search_signals_embedding ON search_signals 
  USING ivfflat (query_embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS Policies
ALTER TABLE search_signals ENABLE ROW LEVEL SECURITY;

-- Users can only see their own search signals
CREATE POLICY "Users can view own search signals"
  ON search_signals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own search signals
CREATE POLICY "Users can insert own search signals"
  ON search_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own search signals
CREATE POLICY "Users can delete own search signals"
  ON search_signals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Cleanup function: Delete search signals older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_search_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM search_signals
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- Note: This will be set up separately if pg_cron is available
-- SELECT cron.schedule('cleanup-search-signals', '0 2 * * *', 'SELECT cleanup_old_search_signals()');

COMMENT ON TABLE search_signals IS 'Captures search patterns for discovering implicit entity relationships through co-occurrence analysis';
COMMENT ON COLUMN search_signals.query IS 'Original search query text';
COMMENT ON COLUMN search_signals.query_embedding IS 'Vector embedding of the query for similarity search';
COMMENT ON COLUMN search_signals.chunk_ids IS 'Array of chunk IDs returned in search results';
COMMENT ON COLUMN search_signals.entity_ids IS 'Array of entity IDs mentioned in the returned chunks';
COMMENT ON COLUMN search_signals.rerank_scores IS 'Reranking scores for each result (parallel to chunk_ids)';
COMMENT ON COLUMN search_signals.clicked_chunk_ids IS 'Array of chunk IDs that user clicked/engaged with (future use)';
