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
    
    def update_document_status(self, document_id: str, status: str):
        """Update document status in the database."""
        try:
            supabase.table("documents").update({"status": status}).eq("id", document_id).execute()
            logger.info(f"Updated document {document_id} status to {status}")
        except Exception as e:
            logger.error(f"Error updating document status: {e}")
    
    def process_document(self, job: Dict[str, Any]) -> bool:
        """
        Process a single document job.
        
        Returns True if successful, False otherwise.
        """
        document_id = job["message"]["document_id"]
        file_path = job["message"]["file_path"]
        
        logger.info(f"Processing document {document_id}: {file_path}")
        
        try:
            # Get document to find user_id
            doc_result = supabase.table("documents").select("user_id").eq("id", document_id).execute()
            if not doc_result.data:
                raise ValueError(f"Document {document_id} not found")
            user_id = doc_result.data[0]["user_id"]
            
            # Update status to processing
            self.update_document_status(document_id, "processing")
            
            # Download file from Supabase Storage
            logger.info(f"Downloading file from storage: {file_path}")
            file_data = supabase.storage.from_("documents").download(file_path)
            
            # Extract text using Unstructured
            logger.info("Extracting text with Unstructured")
            extracted_text = processor.extract_text(file_data, file_path)
            
            if not extracted_text:
                raise ValueError("No text extracted from document")
            
            logger.info(f"Extracted {len(extracted_text)} characters")
            
            # Chunk the text
            logger.info("Chunking text")
            chunks = chunker.chunk_text(extracted_text, document_id, user_id)
            
            logger.info(f"Created {len(chunks)} chunks")
            
            # Store chunks in database
            logger.info("Storing chunks in database")
            supabase.table("chunks").insert(chunks).execute()
            
            # Update document status to ready
            self.update_document_status(document_id, "ready")
            
            logger.info(f"Successfully processed document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}")
            self.update_document_status(document_id, "error")
            return False
    
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
                    success = self.process_document(job)
                    
                    # Delete message from queue if successful
                    if success:
                        self.delete_message(msg_id)
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
