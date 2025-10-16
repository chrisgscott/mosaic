-- Graph RAG Schema: Postgres-native entity and relationship storage
-- Following R2R's approach: no external graph DB, use SQL joins for traversal

-- ============================================================================
-- ENTITIES TABLE
-- ============================================================================
-- Stores extracted entities (people, organizations, concepts, methodologies, etc.)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Entity identification
  name TEXT NOT NULL,                    -- Entity name (e.g., "CCAAAPPI", "Strategic Design Approaches")
  type TEXT NOT NULL,                    -- Entity type (person, organization, concept, methodology, etc.)
  
  -- Entity content
  description TEXT,                      -- LLM-generated description of the entity
  embedding VECTOR(1536),                -- Embedding for semantic entity search
  
  -- Source tracking
  document_ids UUID[] DEFAULT '{}',      -- Documents where this entity appears
  chunk_ids UUID[] DEFAULT '{}',         -- Chunks where this entity was extracted from
  
  -- Deduplication support
  canonical_name TEXT,                   -- Normalized name for deduplication (lowercase, trimmed)
  aliases TEXT[] DEFAULT '{}',           -- Alternative names/spellings
  
  -- Metadata
  metadata JSONB DEFAULT '{}',           -- Additional entity-specific metadata
  extraction_confidence FLOAT,           -- Confidence score from extraction (0-1)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints for deduplication
  CONSTRAINT entities_unique_canonical UNIQUE (user_id, canonical_name, type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS entities_user_id_idx ON entities(user_id);
CREATE INDEX IF NOT EXISTS entities_name_idx ON entities(name);
CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(type);
CREATE INDEX IF NOT EXISTS entities_canonical_name_idx ON entities(canonical_name);
CREATE INDEX IF NOT EXISTS entities_document_ids_idx ON entities USING GIN(document_ids);
CREATE INDEX IF NOT EXISTS entities_chunk_ids_idx ON entities USING GIN(chunk_ids);

-- HNSW index for semantic entity search
CREATE INDEX IF NOT EXISTS entities_embedding_idx ON entities 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS Policies
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Users can view their own entities + public document entities
CREATE POLICY "Users can view own entities"
  ON entities FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = ANY(entities.document_ids)
      AND d.is_public = true
    )
  );

-- Users can insert their own entities
CREATE POLICY "Users can insert own entities"
  ON entities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own entities
CREATE POLICY "Users can update own entities"
  ON entities FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own entities
CREATE POLICY "Users can delete own entities"
  ON entities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RELATIONSHIPS TABLE
-- ============================================================================
-- Stores relationships between entities (subject-predicate-object triples)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Relationship triple
  source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,       -- Type of relationship (uses, requires, relates_to, etc.)
  
  -- Relationship content
  description TEXT,                      -- LLM-generated description of the relationship
  
  -- Source tracking
  document_ids UUID[] DEFAULT '{}',      -- Documents where this relationship appears
  chunk_ids UUID[] DEFAULT '{}',         -- Chunks where this relationship was extracted from
  
  -- Metadata
  metadata JSONB DEFAULT '{}',           -- Additional relationship-specific metadata
  extraction_confidence FLOAT,           -- Confidence score from extraction (0-1)
  bidirectional BOOLEAN DEFAULT false,   -- Whether relationship works both ways
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints for deduplication
  CONSTRAINT relationships_unique_triple UNIQUE (user_id, source_entity_id, target_entity_id, relationship_type),
  CONSTRAINT relationships_no_self_reference CHECK (source_entity_id != target_entity_id)
);

-- Indexes for efficient graph traversal
CREATE INDEX IF NOT EXISTS relationships_user_id_idx ON relationships(user_id);
CREATE INDEX IF NOT EXISTS relationships_source_idx ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS relationships_target_idx ON relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS relationships_type_idx ON relationships(relationship_type);
CREATE INDEX IF NOT EXISTS relationships_document_ids_idx ON relationships USING GIN(document_ids);
CREATE INDEX IF NOT EXISTS relationships_chunk_ids_idx ON relationships USING GIN(chunk_ids);

-- Composite index for graph traversal queries
CREATE INDEX IF NOT EXISTS relationships_source_type_idx ON relationships(source_entity_id, relationship_type);
CREATE INDEX IF NOT EXISTS relationships_target_type_idx ON relationships(target_entity_id, relationship_type);

-- RLS Policies
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Users can view their own relationships + public document relationships
CREATE POLICY "Users can view own relationships"
  ON relationships FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = ANY(relationships.document_ids)
      AND d.is_public = true
    )
  );

-- Users can insert their own relationships
CREATE POLICY "Users can insert own relationships"
  ON relationships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own relationships
CREATE POLICY "Users can update own relationships"
  ON relationships FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own relationships
CREATE POLICY "Users can delete own relationships"
  ON relationships FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to find similar entities (for deduplication)
CREATE OR REPLACE FUNCTION find_similar_entities(
  p_user_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_embedding VECTOR(1536),
  p_similarity_threshold FLOAT DEFAULT 0.85
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    1 - (e.embedding <=> p_embedding) AS similarity
  FROM entities e
  WHERE e.user_id = p_user_id
    AND e.type = p_type
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> p_embedding) >= p_similarity_threshold
  ORDER BY e.embedding <=> p_embedding
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get entity with relationships (1-hop traversal)
CREATE OR REPLACE FUNCTION get_entity_with_relationships(
  p_entity_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'entity', row_to_json(e.*),
    'outgoing_relationships', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'relationship', row_to_json(r.*),
          'target_entity', row_to_json(te.*)
        )
      )
      FROM relationships r
      JOIN entities te ON te.id = r.target_entity_id
      WHERE r.source_entity_id = p_entity_id
        AND r.user_id = p_user_id
    ),
    'incoming_relationships', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'relationship', row_to_json(r.*),
          'source_entity', row_to_json(se.*)
        )
      )
      FROM relationships r
      JOIN entities se ON se.id = r.source_entity_id
      WHERE r.target_entity_id = p_entity_id
        AND r.user_id = p_user_id
    )
  )
  INTO result
  FROM entities e
  WHERE e.id = p_entity_id
    AND e.user_id = p_user_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search entities by name (fuzzy matching)
CREATE OR REPLACE FUNCTION search_entities_by_name(
  p_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_description TEXT,
  match_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.type,
    e.description,
    similarity(e.name, p_query) AS score
  FROM entities e
  WHERE e.user_id = p_user_id
    AND (
      e.name ILIKE '%' || p_query || '%'
      OR e.canonical_name ILIKE '%' || p_query || '%'
      OR p_query = ANY(e.aliases)
    )
  ORDER BY similarity(e.name, p_query) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE entities IS 'Stores extracted entities from documents for graph-based retrieval';
COMMENT ON TABLE relationships IS 'Stores relationships between entities (subject-predicate-object triples)';
COMMENT ON COLUMN entities.canonical_name IS 'Normalized name for deduplication (lowercase, trimmed)';
COMMENT ON COLUMN entities.embedding IS 'Vector embedding for semantic entity search';
COMMENT ON COLUMN relationships.bidirectional IS 'Whether relationship works both ways (e.g., "collaborates_with")';
COMMENT ON FUNCTION find_similar_entities IS 'Finds similar entities using embedding similarity for deduplication';
COMMENT ON FUNCTION get_entity_with_relationships IS 'Gets entity with all 1-hop relationships (incoming and outgoing)';
COMMENT ON FUNCTION search_entities_by_name IS 'Fuzzy search entities by name using trigram similarity';
