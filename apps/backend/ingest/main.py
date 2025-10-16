"""
Document Processing Background Worker

Polls pgmq queue for document processing jobs, extracts text using either
Unstructured (OCR) or Docling (VLM), chunks the content, and stores it in the database.
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
from processors.docling_processor import DoclingProcessor
from processors.chunker import TextChunker
from chunkers.hybrid_chunker import HybridChunker
from processors.embeddings_generator import EmbeddingsGenerator
from processors.graph_extractor import GraphExtractor

# Load environment variables
load_dotenv()

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set Docling loggers to same level
logging.getLogger('docling').setLevel(getattr(logging, LOG_LEVEL))
logging.getLogger('processors.docling_processor').setLevel(getattr(logging, LOG_LEVEL))

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Processor selection
USE_DOCLING = os.getenv("USE_DOCLING", "false").lower() == "true"
USE_API_VLM = os.getenv("USE_API_VLM", "true").lower() == "true"
DOCLING_MAX_WORKERS = int(os.getenv("DOCLING_MAX_WORKERS", "10"))

# Graph extraction configuration
ENABLE_GRAPH_EXTRACTION = os.getenv("ENABLE_GRAPH_EXTRACTION", "true").lower() == "true"

# Chunk summary configuration
CHUNK_SUMMARY_NEIGHBORS = int(os.getenv("CHUNK_SUMMARY_NEIGHBORS", "2"))

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Initialize processor based on configuration
if USE_DOCLING:
    processor = DoclingProcessor(use_api_vlm=USE_API_VLM, max_workers=DOCLING_MAX_WORKERS)
    chunker = HybridChunker(summary_neighbors=CHUNK_SUMMARY_NEIGHBORS)
    logger.info(f"Using Docling processor with HybridChunker (API VLM: {USE_API_VLM}, max_workers: {DOCLING_MAX_WORKERS}, summary_neighbors: {CHUNK_SUMMARY_NEIGHBORS})")
else:
    processor = UnstructuredProcessor()
    chunker = TextChunker()
    logger.info("Using Unstructured processor")


class DocumentWorker:
    """Background worker for processing documents from the queue."""
    
    def __init__(self):
        # Initialize chunker
        self.chunker = HybridChunker(summary_neighbors=CHUNK_SUMMARY_NEIGHBORS) if USE_DOCLING else TextChunker()
        
        # Initialize embeddings generator
        self.embeddings_generator = EmbeddingsGenerator(supabase)
        logger.info("Initialized embeddings generator")
        
        # Initialize graph extractor
        if ENABLE_GRAPH_EXTRACTION:
            self.graph_extractor = GraphExtractor(supabase)
            logger.info("Initialized graph extractor")
        else:
            self.graph_extractor = None
            logger.info("Graph extraction disabled")
        
        self.db_conn = None
        self.running = True
        
    def cleanup_temp_on_startup(self):
        """Clean up temp directory on worker startup to prevent disk buildup."""
        try:
            import tempfile
            import shutil
            
            tmp_dir = tempfile.gettempdir()
            logger.info(f"Cleaning up temp directory on startup: {tmp_dir}")
            
            # Clean up all temp files and directories
            cleaned_count = 0
            for item in os.listdir(tmp_dir):
                item_path = os.path.join(tmp_dir, item)
                try:
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path, ignore_errors=True)
                        cleaned_count += 1
                    elif os.path.isfile(item_path):
                        os.unlink(item_path)
                        cleaned_count += 1
                except Exception:
                    # Ignore errors for individual items
                    pass
            
            logger.info(f"Startup cleanup complete: removed {cleaned_count} items from {tmp_dir}")
        except Exception as e:
            logger.warning(f"Error during startup cleanup: {e}")
        
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
            
            # Clean up temp directories BEFORE downloading (only for Unstructured)
            if not USE_DOCLING:
                logger.info("Cleaning up temp directories before processing")
                processor.cleanup_temp_dirs()
            
            # Download file from Supabase Storage
            logger.info(f"Downloading file from storage: {file_path}")
            file_data = supabase.storage.from_("documents").download(file_path)
            
            # Process document based on selected processor
            if USE_DOCLING:
                # Docling returns DoclingDocument object
                logger.info(f"Extracting document with Docling ({'API VLM' if USE_API_VLM else 'Local VLM'})")
                docling_doc = processor.extract_document(file_data, file_path)
                
                if not docling_doc:
                    raise ValueError("No document extracted from file")
                
                logger.info(f"Extracted DoclingDocument successfully")
                
                # Chunk the document using HybridChunker
                logger.info("Chunking document with HybridChunker")
                chunks = self.chunker.chunk_document(docling_doc, document_id)
                
                # Add user_id and storage_path to chunks
                for chunk in chunks:
                    chunk["user_id"] = user_id
                    chunk["metadata"]["storage_path"] = file_path
                
            else:
                # Unstructured returns elements
                logger.info("Extracting elements with Unstructured")
                elements = processor.extract_elements(file_data, file_path)
                
                if not elements:
                    raise ValueError("No elements extracted from document")
                
                logger.info(f"Extracted {len(elements)} elements")
                
                # Chunk the elements using by_title strategy
                logger.info("Chunking elements (respecting section boundaries)")
                chunks = chunker.chunk_elements(elements, document_id, user_id, storage_path=file_path)
            
            logger.info(f"Created {len(chunks)} chunks")
            
            # Store chunks in database in batches and generate embeddings immediately
            logger.info("Storing chunks and generating embeddings")
            CHUNK_BATCH_SIZE = 100
            total_embeddings = 0
            
            for i in range(0, len(chunks), CHUNK_BATCH_SIZE):
                batch = chunks[i:i + CHUNK_BATCH_SIZE]
                batch_num = i//CHUNK_BATCH_SIZE + 1
                total_batches = (len(chunks) + CHUNK_BATCH_SIZE - 1)//CHUNK_BATCH_SIZE
                
                logger.debug(f"Inserting chunk batch {batch_num}/{total_batches} ({len(batch)} chunks)")
                result = supabase.table("chunks").insert(batch).execute()
                
                # Generate embeddings for this batch immediately
                logger.debug(f"Generating embeddings for batch {batch_num}/{total_batches}")
                stored_chunks = result.data
                
                # Prepare batch for embeddings (OpenAI supports up to 2048 inputs per request)
                # Always embed full content for maximum search precision
                # Summaries are metadata only, not for embedding
                chunk_texts = [
                    chunk["content"] 
                    for chunk in stored_chunks
                ]
                embeddings = self.embeddings_generator.generate_embeddings_batch(chunk_texts)
                
                # Store embeddings
                embedding_records = [
                    {
                        "chunk_id": chunk["id"],
                        "document_id": document_id,
                        "user_id": user_id,
                        "embedding": embedding,
                        "model": "text-embedding-3-small"
                    }
                    for chunk, embedding in zip(stored_chunks, embeddings)
                ]
                supabase.table("embeddings").insert(embedding_records).execute()
                total_embeddings += len(embeddings)
                
                logger.debug(f"Batch {batch_num}/{total_batches} complete: {len(batch)} chunks + {len(embeddings)} embeddings")
            
            logger.info(f"Successfully stored {len(chunks)} chunks and generated {total_embeddings} embeddings")
            
            # Extract graph (entities and relationships) if enabled
            if self.graph_extractor:
                logger.info("Extracting entities and relationships for knowledge graph")
                try:
                    # Get stored chunks with IDs for graph extraction
                    chunks_result = supabase.table("chunks").select("id, content, summary").eq("document_id", document_id).execute()
                    stored_chunks_for_graph = chunks_result.data
                    
                    # Process chunks for graph extraction
                    entity_count, rel_count = self.graph_extractor.process_chunks_batch(
                        stored_chunks_for_graph,
                        document_id,
                        user_id
                    )
                    
                    logger.info(f"Graph extraction complete: {entity_count} entities, {rel_count} relationships")
                except Exception as e:
                    # Don't fail the whole job if graph extraction fails
                    logger.error(f"Graph extraction failed (non-fatal): {e}")
            
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
        
        # Clean up temp directory on startup
        self.cleanup_temp_on_startup()
        
        self.connect_db()
        
        logger.info("Entering main polling loop")
        while self.running:
            try:
                # Poll for next job
                logger.debug("Polling for jobs...")
                job = self.poll_queue()
                logger.debug(f"Poll result: {job is not None}")
                
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
