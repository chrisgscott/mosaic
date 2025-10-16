-- Function to archive PGMQ messages for a specific document
-- This prevents queue corruption when documents are deleted while in error state

CREATE OR REPLACE FUNCTION pgmq_archive_by_document(p_document_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INTEGER := 0;
  msg_record RECORD;
BEGIN
  -- Find and archive all messages for this document in the document_processing queue
  FOR msg_record IN 
    SELECT msg_id 
    FROM pgmq.q_document_processing 
    WHERE (message->>'document_id')::UUID = p_document_id
  LOOP
    -- Archive the message (moves it from active queue to archive)
    PERFORM pgmq.archive('document_processing', msg_record.msg_id);
    archived_count := archived_count + 1;
  END LOOP;
  
  RETURN archived_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION pgmq_archive_by_document TO authenticated;

COMMENT ON FUNCTION pgmq_archive_by_document IS 'Archives all PGMQ messages for a specific document to prevent queue corruption on deletion';
