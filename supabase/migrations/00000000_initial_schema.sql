-- =============================================================================
-- Mosaic Initial Schema
-- =============================================================================
-- This is a consolidated migration for new Mosaic installations.
-- It creates all tables, functions, and policies needed to run Mosaic.
-- 
-- For existing installations, use the individual migration files instead.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- =============================================================================
-- 1. PROFILES TABLE (User management)
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 2. DOCUMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  status text DEFAULT 'uploaded',
  error_message text,
  retry_count integer DEFAULT 0,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  session_id text,
  is_public boolean DEFAULT false,
  chunking_config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_session ON documents(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. CHUNKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  chunk_type varchar(50) DEFAULT 'CONTENT',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_user ON chunks(user_id);
CREATE INDEX idx_chunks_tenant ON chunks(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_chunks_content_fts ON chunks USING gin(to_tsvector('english', content));

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks" ON chunks
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.is_public = true)
  );

CREATE POLICY "Users can insert own chunks" ON chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks" ON chunks
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 4. EMBEDDINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  embedding vector(1536) NOT NULL,
  model text DEFAULT 'text-embedding-3-small',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_embeddings_chunk ON embeddings(chunk_id);
CREATE INDEX idx_embeddings_document ON embeddings(document_id);
CREATE INDEX idx_embeddings_user ON embeddings(user_id);
CREATE INDEX idx_embeddings_tenant ON embeddings(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own embeddings" ON embeddings
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND d.is_public = true)
  );

CREATE POLICY "Users can insert own embeddings" ON embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings" ON embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 5. ENTITIES TABLE (Knowledge Graph)
-- =============================================================================

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  name text NOT NULL,
  entity_type text NOT NULL,
  description text,
  document_ids uuid[] DEFAULT '{}',
  chunk_ids uuid[] DEFAULT '{}',
  relationship_count integer DEFAULT 0,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name, entity_type)
);

CREATE INDEX idx_entities_user ON entities(user_id);
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_tenant ON entities(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_entities_embedding ON entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entities" ON entities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entities" ON entities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entities" ON entities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entities" ON entities
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 6. RELATIONSHIPS TABLE (Knowledge Graph)
-- =============================================================================

CREATE TABLE IF NOT EXISTS relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  source_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  description text,
  weight double precision DEFAULT 1.0,
  document_ids uuid[] DEFAULT '{}',
  chunk_ids uuid[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX idx_relationships_target ON relationships(target_entity_id);
CREATE INDEX idx_relationships_type ON relationships(relationship_type);
CREATE INDEX idx_relationships_tenant ON relationships(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relationships" ON relationships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationships" ON relationships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationships" ON relationships
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationships" ON relationships
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 7. SYSTEM SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  value_type text DEFAULT 'string',
  category text DEFAULT 'general',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can modify settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Insert default settings
INSERT INTO system_settings (key, value, value_type, category, description) VALUES
  -- Search settings
  ('search.useReranking', 'true', 'boolean', 'search', 'Enable Cohere reranking for search results'),
  ('search.useGraphSearch', 'false', 'boolean', 'search', 'Enable knowledge graph search'),
  ('search.useHyDE', 'false', 'boolean', 'search', 'Enable Hypothetical Document Embeddings'),
  ('search.useMultiQuery', 'false', 'boolean', 'search', 'Enable multi-query expansion'),
  
  -- LLM settings
  ('llm.standardModel', 'gpt-4o-mini', 'string', 'llm', 'Default model for chat'),
  ('llm.embeddingModel', 'text-embedding-3-small', 'string', 'llm', 'Model for embeddings'),
  ('llm.temperature', '0.7', 'number', 'llm', 'Default temperature for LLM calls'),
  
  -- Processing settings
  ('processing.useApiVlm', 'true', 'boolean', 'processing', 'Use API-based VLM for document processing'),
  ('processing.pdfWorkers', '10', 'number', 'processing', 'Parallel workers for PDF processing'),
  ('processing.chunkMaxTokens', '256', 'number', 'processing', 'Maximum tokens per chunk'),
  ('processing.enableDocumentAugmentation', 'false', 'boolean', 'processing', 'Generate questions for chunks')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 8. API KEYS TABLE (Multi-tenant support)
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  tenant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  description text,
  rate_limit integer DEFAULT 1000
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view API keys" ON api_keys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert API keys" ON api_keys
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update API keys" ON api_keys
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =============================================================================
-- 9. CHAT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own messages" ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
  );

-- =============================================================================
-- 10. EXTRACTED DOCUMENTS CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS extracted_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  page_count integer,
  extraction_method text,
  content_length integer,
  token_count integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id)
);

CREATE INDEX idx_extracted_documents_document ON extracted_documents(document_id);

ALTER TABLE extracted_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extracted docs" ON extracted_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extracted docs" ON extracted_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 11. HYBRID SEARCH FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION search_chunks_hybrid(
  query_text text,
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10,
  filter_user_id uuid DEFAULT NULL,
  filter_session_id text DEFAULT NULL,
  filter_tenant_id uuid DEFAULT NULL,
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
      (filter_tenant_id IS NULL OR e.tenant_id = filter_tenant_id)
      AND (filter_tenant_id IS NOT NULL OR filter_user_id IS NULL OR e.user_id = filter_user_id OR d.is_public = true)
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
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
      (filter_tenant_id IS NULL OR c.tenant_id = filter_tenant_id)
      AND (filter_tenant_id IS NOT NULL OR filter_user_id IS NULL OR c.user_id = filter_user_id OR d.is_public = true)
      AND (filter_session_id IS NULL OR d.session_id = filter_session_id)
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

-- =============================================================================
-- 12. ENTITY SEMANTIC SEARCH FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION search_entities_semantic(
  query_embedding vector(1536),
  filter_user_id uuid,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  entity_type text,
  description text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.description,
    (1 - (e.embedding <=> query_embedding))::double precision AS similarity
  FROM entities e
  WHERE
    e.user_id = filter_user_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- 13. PGMQ SETUP
-- =============================================================================

-- Create the document processing queue
SELECT pgmq.create('document_processing');

-- Wrapper function for sending messages
CREATE OR REPLACE FUNCTION pgmq_send(queue_name text, msg jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result bigint;
BEGIN
  SELECT pgmq.send(queue_name, msg) INTO result;
  RETURN result;
END;
$$;

-- Function to archive messages by document ID
CREATE OR REPLACE FUNCTION pgmq_archive_by_document(p_document_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count integer := 0;
  msg_record record;
BEGIN
  FOR msg_record IN
    SELECT msg_id FROM pgmq.q_document_processing
    WHERE (message->>'document_id')::uuid = p_document_id
  LOOP
    PERFORM pgmq.archive('document_processing', msg_record.msg_id);
    archived_count := archived_count + 1;
  END LOOP;
  
  RETURN archived_count;
END;
$$;

-- =============================================================================
-- 14. STORAGE SETUP
-- =============================================================================

-- Create documents bucket (run this in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies (run in SQL editor)
-- CREATE POLICY "Users can upload documents" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own documents" ON storage.objects
--   FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete own documents" ON storage.objects
--   FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- DONE!
-- =============================================================================
-- After running this migration:
-- 1. Create the 'documents' storage bucket in Supabase Dashboard
-- 2. Set up storage policies (uncomment and run the storage section above)
-- 3. Create your first admin user and set is_admin = true in profiles
-- =============================================================================
