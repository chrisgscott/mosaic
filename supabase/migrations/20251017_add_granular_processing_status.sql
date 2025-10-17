-- Add granular processing statuses to documents table
-- This provides better visibility into document processing stages

-- First, drop the existing CHECK constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;

-- Update the status column to allow new values
ALTER TABLE documents 
  ADD CONSTRAINT documents_status_check 
  CHECK (status IN (
    'uploaded',           -- Upload complete, queued for processing
    'processing',         -- Worker has picked up the job
    'extracting',         -- Extracting text with Docling
    'chunking',           -- Creating chunks from document
    'generating_summaries', -- Generating chunk summaries
    'embedding',          -- Generating embeddings for chunks
    'extracting_graph',   -- Extracting entities and relationships
    'ready',              -- All processing complete
    'error'               -- Processing failed
  ));

-- Add optional fields for tracking processing progress
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS processing_stage_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create index on processing_stage_started_at for analytics
CREATE INDEX IF NOT EXISTS idx_documents_processing_started ON documents(processing_stage_started_at) WHERE processing_stage_started_at IS NOT NULL;

-- Add comment explaining the status flow
COMMENT ON COLUMN documents.status IS 'Document processing status: uploaded → processing → extracting → chunking → generating_summaries → embedding → extracting_graph → ready (or error at any stage)';
COMMENT ON COLUMN documents.processing_progress IS 'Processing progress percentage (0-100)';
COMMENT ON COLUMN documents.processing_stage_started_at IS 'Timestamp when current processing stage started';
COMMENT ON COLUMN documents.error_message IS 'Error message if status is error';
COMMENT ON COLUMN documents.retry_count IS 'Number of times processing has been retried';
