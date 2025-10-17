-- Create system_settings table for admin-configurable settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view settings
CREATE POLICY "Admins can view settings"
  ON system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Only admins can update settings
CREATE POLICY "Admins can update settings"
  ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Only admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert default search settings
INSERT INTO system_settings (key, value, description, category) VALUES
  ('search.useHyDE', 'true', 'Enable HyDE (Hypothetical Document Embeddings) for query expansion. Useful for general queries but may hallucinate for specialized domains.', 'search'),
  ('search.useMultiQuery', 'true', 'Generate multiple query variations to improve recall. Recommended for most use cases.', 'search'),
  ('search.useReranking', 'true', 'Use Cohere reranking to improve result precision. Adds ~300ms latency but significantly improves relevance.', 'search'),
  ('search.useGraphSearch', 'true', 'Enable knowledge graph enhancement to find related entities and relationships. Best for relationship queries.', 'search')
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE system_settings IS 'System-wide settings configurable by admins';
COMMENT ON COLUMN system_settings.key IS 'Unique setting key in dot notation (e.g., search.useHyDE)';
COMMENT ON COLUMN system_settings.value IS 'Setting value as JSONB (supports strings, numbers, booleans, objects)';
COMMENT ON COLUMN system_settings.category IS 'Setting category for grouping in UI (e.g., search, ingestion, general)';
