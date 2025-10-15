-- Add error tracking columns to documents table
ALTER TABLE documents ADD COLUMN error_message TEXT;
ALTER TABLE documents ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN last_error_at TIMESTAMPTZ;

-- Add index for filtering by error status
CREATE INDEX idx_documents_error ON documents(status) WHERE status = 'error';

-- Add comments for documentation
COMMENT ON COLUMN documents.error_message IS 'Last error message from processing failure';
COMMENT ON COLUMN documents.retry_count IS 'Number of times processing has been attempted';
COMMENT ON COLUMN documents.last_error_at IS 'Timestamp of most recent processing error';
