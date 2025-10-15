"""
Document Processing Background Worker

Polls pgmq queue for document processing jobs, extracts text using Unstructured,
chunks the content, and stores it in the database.
"""

import os
import time
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client

from processors.unstructured_processor import UnstructuredProcessor
from processors.chunker import TextChunker

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
processor = UnstructuredProcessor()
chunker = TextChunker()


class DocumentWorker:
    """Background worker for processing documents from the queue."""
    
    def __init__(self):
        self.db_conn = None
        self.running = True
        
    def connect_db(self):
        """Establish database connection for pgmq."""
        try:
            # Try connection pooling URL first, fall back to direct connection
            try:
                self.db_conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
            except psycopg2.OperationalError as e:
                if "Tenant or user not found" in str(e):
                    # Pooler might not be configured, try direct connection
                    logger.warning("Connection pooling failed, trying direct connection")
                    direct_url = DATABASE_URL.replace("pooler.supabase.com:6543", "supabase.co:5432").replace("postgres.cqtxfjcpgaudugkqjpdc", "postgres")
                    self.db_conn = psycopg2.connect(direct_url, cursor_factory=RealDictCursor)
                else:
                    raise
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def poll_queue(self) -> Optional[Dict[str, Any]]:
        """Poll the pgmq queue for the next job."""
        try:
            with self.db_conn.cursor() as cursor:
                # Read message from queue with visibility timeout of 300 seconds (5 min)
                cursor.execute("""
                    SELECT * FROM pgmq.read(
                        queue_name := 'document_processing',
                        vt := 300,
                        qty := %s
                    );
                """, (BATCH_SIZE,))
                
                result = cursor.fetchone()
                return result if result else None
                
        except Exception as e:
            logger.error(f"Error polling queue: {e}")
            # Reconnect on error
            self.connect_db()
            return None
    
    def delete_message(self, msg_id: int):
        """Delete a message from the queue after successful processing."""
        try:
            with self.db_conn.cursor() as cursor:
                cursor.execute("""
                    SELECT pgmq.delete(
                        queue_name := 'document_processing',
                        msg_id := %s
                    );
                """, (msg_id,))
                self.db_conn.commit()
                logger.info(f"Deleted message {msg_id} from queue")
        except Exception as e:
            logger.error(f"Error deleting message {msg_id}: {e}")
    
    def update_document_status(self, document_id: str, status: str, error_message: str = None, retry_count: int = None):
        """Update document status in database."""
        try:
            update_data = {
                "status": status,
                "updated_at": "now()"
            }
            
            if error_message is not None:
                update_data["error_message"] = error_message
                update_data["last_error_at"] = "now()"
            
            if retry_count is not None:
                update_data["retry_count"] = retry_count
            
            supabase.table("documents").update(update_data).eq("id", document_id).execute()
            logger.info(f"Updated document {document_id} status to {status}")
        except Exception as e:
            logger.error(f"Failed to update document status: {e}")
    
    def process_document(self, job: Dict[str, Any]) -> tuple[bool, bool]:
        """
        Process a single document job.
        
        Returns (success, should_delete) tuple:
        - success: True if processing succeeded
        - should_delete: True if message should be deleted from queue (even on failure)
        """
        document_id = job["message"]["document_id"]
        file_path = job["message"]["file_path"]
        read_ct = job.get("read_ct", 0)  # pgmq tracks how many times message was read
        
        logger.info(f"Processing document {document_id}: {file_path}")
        
        # Check if we've exceeded max retries
        if read_ct >= MAX_RETRIES:
            logger.error(f"Document {document_id} exceeded max retries ({MAX_RETRIES}), giving up")
            self.update_document_status(
                document_id, 
                "error", 
                error_message=f"Processing failed after {MAX_RETRIES} attempts",
                retry_count=read_ct
            )
            return (False, True)  # Delete from queue, stop retrying
        
        try:
            # Get document to find user_id
            doc_result = supabase.table("documents").select("user_id").eq("id", document_id).execute()
            if not doc_result.data:
                logger.warning(f"Document {document_id} not found - was likely deleted")
                # Document was deleted, don't retry this job
                return (False, True)
            user_id = doc_result.data[0]["user_id"]
            
            # Update status to processing
            self.update_document_status(document_id, "processing")
            
            # Download file from Supabase Storage
            logger.info(f"Downloading file from storage: {file_path}")
            file_data = supabase.storage.from_("documents").download(file_path)
            
            # Extract elements using Unstructured
            logger.info("Extracting elements with Unstructured")
            elements = processor.extract_elements(file_data, file_path)
            
            if not elements:
                raise ValueError("No elements extracted from document")
            
            logger.info(f"Extracted {len(elements)} elements")
            
            # Chunk the elements using by_title strategy
            logger.info("Chunking elements (respecting section boundaries)")
            chunks = chunker.chunk_elements(elements, document_id, user_id, storage_path=file_path)
            
            logger.info(f"Created {len(chunks)} chunks")
            
            # Store chunks in database
            logger.info("Storing chunks in database")
            supabase.table("chunks").insert(chunks).execute()
            
            # Update document status to ready
            self.update_document_status(document_id, "ready")
            
            logger.info(f"Successfully processed document {document_id}")
            return (True, True)
            
        except Exception as e:
            attempt_num = read_ct + 1
            error_msg = str(e)
            logger.error(f"Error processing document {document_id} (attempt {attempt_num}/{MAX_RETRIES}): {error_msg}")
            self.update_document_status(
                document_id, 
                "error",
                error_message=error_msg,
                retry_count=attempt_num
            )
            # Retry on general errors - will be retried up to MAX_RETRIES times
            return (False, False)
    
    def run(self):
        """Main worker loop."""
        logger.info("Starting document processing worker")
        self.connect_db()
        
        while self.running:
            try:
                # Poll for next job
                job = self.poll_queue()
                
                if job:
                    msg_id = job["msg_id"]
                    logger.info(f"Received job {msg_id}")
                    
                    # Process the document
                    success, should_delete = self.process_document(job)
                    
                    # Delete message from queue if successful or if it should be removed
                    if should_delete:
                        self.delete_message(msg_id)
                        if not success:
                            logger.info(f"Job {msg_id} removed from queue (document was deleted)")
                    else:
                        logger.warning(f"Job {msg_id} failed, will retry after visibility timeout")
                else:
                    # No jobs available, sleep before polling again
                    time.sleep(POLL_INTERVAL)
                    
            except KeyboardInterrupt:
                logger.info("Received shutdown signal")
                self.running = False
            except Exception as e:
                logger.error(f"Unexpected error in worker loop: {e}")
                time.sleep(POLL_INTERVAL)
        
        # Cleanup
        if self.db_conn:
            self.db_conn.close()
        logger.info("Worker stopped")


if __name__ == "__main__":
    worker = DocumentWorker()
    worker.run()
