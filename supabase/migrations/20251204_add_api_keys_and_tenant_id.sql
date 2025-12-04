-- Migration: Add API keys table and tenant_id for multi-tenant support
-- Date: 2024-12-04
-- Purpose: Enable Mosaic to be used as a service by multiple apps/tenants

-- ============================================================================
-- 1. Create API Keys Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                              -- Human-readable name
  key_hash        text NOT NULL UNIQUE,                       -- SHA256 hash of the key
  key_prefix      text NOT NULL,                              -- First 12 chars for display (msk_abc123...)
  tenant_id       uuid NOT NULL DEFAULT gen_random_uuid(),    -- Tenant this key belongs to
  created_by      uuid REFERENCES auth.users(id),             -- Admin who created the key
  created_at      timestamptz DEFAULT now(),
  last_used_at    timestamptz,
  is_active       boolean DEFAULT true,
  
  -- Optional metadata
  description     text,
  rate_limit      integer DEFAULT 1000                        -- Requests per minute (future use)
);

-- Index for fast key lookups during auth
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_tenant ON api_keys (tenant_id);

-- RLS: Only admins can manage API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all API keys" ON api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert API keys" ON api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update API keys" ON api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

COMMENT ON TABLE api_keys IS 'API keys for external apps to access Mosaic. Each key is scoped to a tenant_id.';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the API key. The actual key is never stored.';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 12 characters of the key for display purposes (e.g., msk_abc123...).';
COMMENT ON COLUMN api_keys.tenant_id IS 'All data accessed via this key is scoped to this tenant.';

-- ============================================================================
-- 2. Add tenant_id to existing tables
-- ============================================================================

-- Documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents (tenant_id) WHERE tenant_id IS NOT NULL;
COMMENT ON COLUMN documents.tenant_id IS 'Tenant that owns this document. NULL for legacy/admin-uploaded docs.';

-- Chunks table
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON chunks (tenant_id) WHERE tenant_id IS NOT NULL;
COMMENT ON COLUMN chunks.tenant_id IS 'Tenant that owns this chunk. Denormalized from documents for query performance.';

-- Embeddings table
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant ON embeddings (tenant_id) WHERE tenant_id IS NOT NULL;
COMMENT ON COLUMN embeddings.tenant_id IS 'Tenant that owns this embedding. Denormalized from documents for query performance.';

-- Entities table (if using graph features)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities (tenant_id) WHERE tenant_id IS NOT NULL;

-- Relationships table (if using graph features)
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS tenant_id uuid;
CREATE INDEX IF NOT EXISTS idx_relationships_tenant ON relationships (tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- 3. Update hybrid search function to support tenant filtering
-- ============================================================================

CREATE OR REPLACE FUNCTION search_chunks_hybrid(
  query_text text,
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_session_id text DEFAULT NULL,
  filter_tenant_id uuid DEFAULT NULL,  -- NEW: tenant filter
  rrf_k integer DEFAULT 60
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  similarity double precision,
  bm25_score double precision,
  rrf_score double precision,
  document_name text,
  document_file_type text,
  chunk_type varchar,
  metadata jsonb
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
      c.chunk_type,
      c.metadata,
      (1 - (e.embedding <=> query_embedding))::double precision AS similarity,
      ROW_NUMBER() OVER (ORDER BY e.embedding <=> query_embedding) AS rank
    FROM embeddings e
    JOIN chunks c ON e.chunk_id = c.id
    JOIN documents d ON c.document_id = d.id
    WHERE
      -- Tenant filter (if provided, only search within tenant)
      (filter_tenant_id IS NULL OR e.tenant_id = filter_tenant_id)
      -- Legacy user filter (for backward compatibility)
      AND (filter_tenant_id IS NOT NULL OR filter_user_id IS NULL OR e.user_id = filter_user_id OR d.is_public = true)
      -- Session filter
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
      -- Similarity threshold
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      c.id AS chunk_id,
      c.document_id,
      c.chunk_index,
      c.content,
      c.chunk_type,
      c.metadata,
      ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text))::double precision AS bm25_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) DESC) AS rank
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE
      -- Tenant filter
      (filter_tenant_id IS NULL OR c.tenant_id = filter_tenant_id)
      -- Legacy user filter
      AND (filter_tenant_id IS NOT NULL OR filter_user_id IS NULL OR c.user_id = filter_user_id OR d.is_public = true)
      -- Session filter
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
      -- Text match
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  ),
  rrf_fusion AS (
    SELECT
      COALESCE(s.chunk_id, k.chunk_id) AS chunk_id,
      COALESCE(s.document_id, k.document_id) AS document_id,
      COALESCE(s.chunk_index, k.chunk_index) AS chunk_index,
      COALESCE(s.content, k.content) AS content,
      COALESCE(s.chunk_type, k.chunk_type) AS chunk_type,
      COALESCE(s.metadata, k.metadata) AS metadata,
      COALESCE(s.similarity, 0::double precision) AS similarity,
      COALESCE(k.bm25_score, 0::double precision) AS bm25_score,
      (COALESCE(1.0 / (rrf_k + s.rank), 0.0) + COALESCE(1.0 / (rrf_k + k.rank), 0.0))::double precision AS rrf_score
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
    d.file_type AS document_file_type,
    rf.chunk_type,
    rf.metadata
  FROM rrf_fusion rf
  JOIN documents d ON rf.document_id = d.id
  ORDER BY rf.rrf_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_chunks_hybrid IS 'Hybrid semantic + keyword search with RRF fusion. Supports tenant_id filtering for multi-tenant deployments.';
