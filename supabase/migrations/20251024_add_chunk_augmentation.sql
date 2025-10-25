-- Add chunk augmentation support
-- This enables storing generated questions alongside original chunks

-- Add chunk_type column to distinguish original chunks from augmented questions
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS chunk_type VARCHAR(50) DEFAULT 'ORIGINAL';

-- Add parent_chunk_id to link augmented questions back to their source chunk
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_chunk_id);

-- Add comment explaining the schema
COMMENT ON COLUMN chunks.chunk_type IS 'Type of chunk: ORIGINAL (base chunk) or AUGMENTED_QUESTION (generated question)';
COMMENT ON COLUMN chunks.parent_chunk_id IS 'For AUGMENTED_QUESTION chunks, references the ORIGINAL chunk that generated this question';
