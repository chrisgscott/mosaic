-- Add session filtering to hybrid search
-- When session_id is provided, search ONLY session documents
-- When NULL, search all user documents (existing behavior)

CREATE OR REPLACE FUNCTION search_chunks_hybrid(
  query_text TEXT,
  query_embedding vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_session_id text DEFAULT NULL,  -- NEW: Filter by session
  rrf_k integer DEFAULT 60
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity double precision,
  bm25_score double precision,
  rrf_score double precision,
  document_name text,
  document_file_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.chunk_index,
      c.content,
      1 - (e.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY e.embedding <=> query_embedding) AS rank
    FROM embeddings e
    JOIN chunks c ON e.chunk_id = c.id
    JOIN documents d ON c.document_id = d.id
    WHERE
      (filter_user_id IS NULL OR e.user_id = filter_user_id OR d.is_public = true)
      -- NEW: Session filter - if provided, ONLY search session documents
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count * 2  -- Get more candidates for fusion
  ),
  keyword_search AS (
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.chunk_index,
      c.content,
      ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS bm25_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) DESC) AS rank
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE
      (filter_user_id IS NULL OR c.user_id = filter_user_id OR d.is_public = true)
      -- NEW: Session filter - if provided, ONLY search session documents
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) DESC
    LIMIT match_count * 2  -- Get more candidates for fusion
  ),
  rrf_fusion AS (
    SELECT
      COALESCE(s.chunk_id, k.chunk_id) AS chunk_id,
      COALESCE(s.document_id, k.document_id) AS document_id,
      COALESCE(s.chunk_index, k.chunk_index) AS chunk_index,
      COALESCE(s.content, k.content) AS content,
      COALESCE(s.similarity, 0) AS similarity,
      COALESCE(k.bm25_score, 0) AS bm25_score,
      -- RRF score: sum of 1/(k + rank) for each search method
      (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0)) AS rrf_score
    FROM semantic_search s
    FULL OUTER JOIN keyword_search k ON s.chunk_id = k.chunk_id
  )
  SELECT
    rf.chunk_id,
    rf.document_id,
    rf.chunk_index,
    rf.content,
    rf.similarity,
    rf.bm25_score,
    rf.rrf_score,
    d.file_name AS document_name,
    d.file_type AS document_file_type
  FROM rrf_fusion rf
  JOIN documents d ON rf.document_id = d.id
  ORDER BY rf.rrf_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_chunks_hybrid IS 'Hybrid search with optional session filtering. When filter_session_id is provided, searches ONLY documents in that session.';
