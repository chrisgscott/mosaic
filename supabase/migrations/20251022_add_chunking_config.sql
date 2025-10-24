-- Add chunking configuration support to documents table
-- This allows per-document customization of chunking strategy

-- Add chunking_config JSONB column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS chunking_config JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN documents.chunking_config IS 
'Optional per-document chunking configuration. Structure:
{
  "strategy": "hybrid" | "structural" | "custom_boundary",
  "boundary_markers": ["Recipe", "##", "Chapter"],
  "keep_together_patterns": [
    {
      "start_marker": "Recipe",
      "end_marker": "pipdecks.com",
      "description": "Keep recipe cards together"
    }
  ],
  "max_chunk_tokens": 512,
  "respect_headings": true,
  "custom_rules": {}
}';

-- Create index for querying documents by chunking strategy
CREATE INDEX IF NOT EXISTS idx_documents_chunking_strategy 
ON documents ((chunking_config->>'strategy'));
