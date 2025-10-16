-- Add semantic search function for entities using pgvector
-- This allows efficient similarity search on entity embeddings

CREATE OR REPLACE FUNCTION search_entities_semantic(
  query_embedding VECTOR(1536),
  p_user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.7,
  result_limit INT DEFAULT 10,
  entity_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  description TEXT,
  document_ids UUID[],
  chunk_ids UUID[],
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.type,
    e.description,
    e.document_ids,
    e.chunk_ids,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM entities e
  WHERE e.user_id = p_user_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) >= similarity_threshold
    AND (entity_types IS NULL OR e.type = ANY(entity_types))
  ORDER BY e.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION search_entities_semantic IS 'Semantic search for entities using pgvector cosine similarity';
