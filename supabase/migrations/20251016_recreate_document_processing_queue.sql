-- Drop and recreate the document_processing queue to clear stuck messages
-- This fixes issues with invisible messages blocking the queue

-- Drop the existing queue (this will remove all messages)
SELECT pgmq.drop_queue('document_processing');

-- Recreate the queue
SELECT pgmq.create('document_processing');

-- Verify the queue was created
SELECT * FROM pgmq.list_queues() WHERE queue_name = 'document_processing';
