"""
Document Processing Background Worker

Polls pgmq queue for document processing jobs, extracts text using Docling (VLM),
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

from processors.docling_processor import DoclingProcessor
from chunkers.structure_aware_chunker import StructureAwareChunker
from processors.embeddings_generator import EmbeddingsGenerator
from processors.graph_extractor import GraphExtractor
from settings_service import SettingsService

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

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Initialize settings service
settings_service = SettingsService(supabase)

# Read configuration from settings (with ENV fallbacks)
USE_API_VLM = settings_service.get_bool('processing.useApiVlm', True, 'USE_API_VLM')
DOCLING_MAX_WORKERS = settings_service.get_int('processing.pdfWorkers', 10, 'DOCLING_MAX_WORKERS')
ENABLE_GRAPH_EXTRACTION = settings_service.get_bool('search.useGraphSearch', True, 'ENABLE_GRAPH_EXTRACTION')
CHUNK_SUMMARY_NEIGHBORS = settings_service.get_int('processing.summaryNeighbors', 2, 'CHUNK_SUMMARY_NEIGHBORS')
CHUNK_MAX_TOKENS = settings_service.get_int('processing.chunkMaxTokens', 256, 'CHUNK_MAX_TOKENS')

# Get model settings for logging
VLM_MODEL = settings_service.get_string('processing.vlmModel', 'gpt-4o-mini')
SUMMARY_MODEL = settings_service.get_string('processing.summaryModel', 'gpt-4o-mini')
GRAPH_MODEL = settings_service.get_string('processing.graphModel', 'gpt-4o-mini')
EMBEDDING_MODEL = settings_service.get_string('llm.embeddingModel', 'text-embedding-3-small')
TEMPERATURE = settings_service.get_float('llm.temperature', 0.7)

# Log consolidated settings summary
logger.info("=" * 70)
logger.info("ACTIVE SETTINGS")
logger.info("=" * 70)
logger.info("Processing:")
logger.info(f"  • API VLM: {USE_API_VLM}")
logger.info(f"  • VLM Model: {VLM_MODEL}")
logger.info(f"  • PDF Workers: {DOCLING_MAX_WORKERS}")
logger.info(f"  • Chunk Max Tokens: {CHUNK_MAX_TOKENS}")
logger.info(f"  • Summary Workers: {CHUNK_SUMMARY_NEIGHBORS}")
logger.info(f"  • Summary Model: {SUMMARY_MODEL}")
logger.info(f"  • Graph Model: {GRAPH_MODEL}")
logger.info(f"  • Graph Extraction: {ENABLE_GRAPH_EXTRACTION}")
logger.info("LLM:")
logger.info(f"  • Embedding Model: {EMBEDDING_MODEL}")
logger.info(f"  • Temperature: {TEMPERATURE}")
logger.info("=" * 70)

# Initialize processor and chunker
processor = DoclingProcessor(
    use_api_vlm=USE_API_VLM, 
    max_workers=DOCLING_MAX_WORKERS, 
    settings_service=settings_service,
    supabase_client=supabase  # Pass supabase for checkpointing
)
chunker = StructureAwareChunker(target_size=1000, min_size=300, max_size=2000)


class DocumentWorker:
    """Background worker for processing documents from the queue."""
    
    def __init__(self):
        # Store settings service reference
        self.settings_service = settings_service
        
        # Initialize chunker
        self.chunker = StructureAwareChunker(target_size=1000, min_size=300, max_size=2000)
        
        # Initialize embeddings generator
        self.embeddings_generator = EmbeddingsGenerator(supabase, settings_service=settings_service)
        logger.info("Initialized embeddings generator")
        
        # Initialize graph extractor
        if ENABLE_GRAPH_EXTRACTION:
            self.graph_extractor = GraphExtractor(supabase, settings_service=settings_service)
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
            logger.info(f"Attempting to connect to database...")
            logger.debug(f"DATABASE_URL: {DATABASE_URL[:50]}...")  # Log first 50 chars only
            
            # Try connection pooling URL first, fall back to direct connection
            try:
                self.db_conn = psycopg2.connect(
                    DATABASE_URL, 
                    cursor_factory=RealDictCursor,
                    connect_timeout=10  # 10 second timeout
                )
            except psycopg2.OperationalError as e:
                logger.warning(f"Connection attempt failed: {e}")
                if "Tenant or user not found" in str(e):
                    # Pooler might not be configured, try direct connection
                    logger.warning("Connection pooling failed, trying direct connection")
                    direct_url = DATABASE_URL.replace("pooler.supabase.com:6543", "supabase.co:5432").replace("postgres.cqtxfjcpgaudugkqjpdc", "postgres")
                    logger.debug(f"Trying direct URL: {direct_url[:50]}...")
                    self.db_conn = psycopg2.connect(
                        direct_url, 
                        cursor_factory=RealDictCursor,
                        connect_timeout=10
                    )
                else:
                    raise
            logger.info("✅ Connected to database successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to database: {e}")
            logger.error(f"DATABASE_URL format: {DATABASE_URL[:80]}...")
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
    
    def update_document_status(self, document_id: str, status: str, error_message: str = None, retry_count: int = None, progress: int = None):
        """Update document status in database."""
        try:
            update_data = {
                "status": status,
                "updated_at": "now()",
                "processing_stage_started_at": "now()"  # Track when this stage started
            }
            if error_message:
                update_data["error_message"] = error_message
            if retry_count is not None:
                update_data["retry_count"] = retry_count
            if progress is not None:
                update_data["processing_progress"] = progress
            
            supabase.table("documents").update(update_data).eq("id", document_id).execute()
            logger.info(f"Updated document {document_id} status to {status}" + (f" ({progress}%)" if progress else ""))
        except Exception as e:
            logger.error(f"Error updating document status: {e}")
    
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
            # Get document to find user_id and chunking_config
            doc_result = supabase.table("documents").select("user_id, chunking_config").eq("id", document_id).execute()
            if not doc_result.data:
                logger.warning(f"Document {document_id} not found - was likely deleted")
                # Document was deleted, don't retry this job
                return (False, True)
            user_id = doc_result.data[0]["user_id"]
            chunking_config = doc_result.data[0].get("chunking_config")
            
            # Update status to processing
            self.update_document_status(document_id, "processing")
            
            # Download file from Supabase Storage
            logger.info(f"Downloading file from storage: {file_path}")
            file_data = supabase.storage.from_("documents").download(file_path)
            
            # Check for cached extracted content first
            cached_extraction = supabase.table("extracted_documents")\
                .select("content, page_count, extraction_method")\
                .eq("document_id", document_id)\
                .execute()
            
            if cached_extraction.data and len(cached_extraction.data) > 0:
                cached = cached_extraction.data[0]
                logger.info(f"📦 Using cached extracted content ({cached.get('page_count', '?')} pages, method: {cached.get('extraction_method', 'unknown')})")
                # Reconstruct docling_doc format from cached content
                docling_doc = {"type": "cached_markdown", "content": cached["content"]}
            else:
                # Extract document with Docling
                self.update_document_status(document_id, "extracting")
                logger.info(f"Extracting document with Docling ({'API VLM' if USE_API_VLM else 'Local VLM'})")
                docling_doc = processor.extract_document(file_data, file_path, document_id=document_id, user_id=user_id)
                
                if not docling_doc:
                    raise ValueError("No document extracted from file")
                
                logger.info(f"Extracted DoclingDocument successfully")
                
                # Cache the extracted content
                if isinstance(docling_doc, dict) and docling_doc.get("type") == "page_documents":
                    full_text = ""
                    page_count = len(docling_doc["pages"])
                    for page_num, page_doc in sorted(docling_doc["pages"], key=lambda x: x[0]):
                        full_text += page_doc.export_to_markdown() + "\n\n"
                else:
                    full_text = docling_doc.export_to_markdown()
                    page_count = 1
                
                # Estimate token count
                token_count = len(full_text) // 4
                
                supabase.table("extracted_documents").upsert({
                    "document_id": document_id,
                    "user_id": user_id,
                    "content": full_text,
                    "page_count": page_count,
                    "extraction_method": "docling_api_vlm" if USE_API_VLM else "docling_local_vlm",
                    "content_length": len(full_text),
                    "token_count": token_count
                }).execute()
                logger.info(f"💾 Cached extracted content ({page_count} pages, {len(full_text):,} chars, ~{token_count:,} tokens)")
            
            # Chunk the document using simple structure-aware chunking
            self.update_document_status(document_id, "chunking")
            logger.info("Chunking document with StructureAwareChunker (uses Docling structure)")
            
            # Create a simple wrapper class for markdown content
            class MarkdownDoc:
                def __init__(self, markdown):
                    self.markdown = markdown
                def export_to_markdown(self):
                    return self.markdown
            
            # Get Docling document for chunking
            if isinstance(docling_doc, dict) and docling_doc.get("type") == "cached_markdown":
                # Cached extraction - already have markdown content
                doc_for_chunking = MarkdownDoc(docling_doc["content"])
            elif isinstance(docling_doc, dict) and docling_doc.get("type") == "page_documents":
                # For page-based documents, concatenate all pages into one markdown string
                full_markdown = ""
                for page_num, page_doc in sorted(docling_doc["pages"], key=lambda x: x[0]):
                    full_markdown += page_doc.export_to_markdown() + "\n\n"
                doc_for_chunking = MarkdownDoc(full_markdown)
            else:
                # Regular Docling document object
                doc_for_chunking = docling_doc
            
            # Chunk using structure-aware chunker
            chunks = self.chunker.chunk_document(doc_for_chunking, document_id)
            
            # Add user_id and storage_path to chunks
            for chunk in chunks:
                chunk["user_id"] = user_id
                chunk["metadata"]["storage_path"] = file_path
            
            logger.info(f"Created {len(chunks)} chunks")
            
            # Store chunks in database in batches and generate embeddings immediately
            self.update_document_status(document_id, "embedding")
            logger.info("Storing chunks and generating embeddings")
            
            # Clean up any existing chunks from previous failed attempts
            try:
                existing = supabase.table("chunks").select("id").eq("document_id", document_id).execute()
                if existing.data:
                    logger.info(f"Deleting {len(existing.data)} existing chunks from previous attempt")
                    supabase.table("chunks").delete().eq("document_id", document_id).execute()
            except Exception as e:
                logger.warning(f"Could not clean up existing chunks: {e}")
            
            # Step 1: Insert ALL chunks first (ensures chunks are saved even if embeddings fail)
            CHUNK_BATCH_SIZE = 100
            logger.info(f"Inserting {len(chunks)} chunks in batches of {CHUNK_BATCH_SIZE}")
            
            for i in range(0, len(chunks), CHUNK_BATCH_SIZE):
                batch = chunks[i:i + CHUNK_BATCH_SIZE]
                batch_num = i//CHUNK_BATCH_SIZE + 1
                total_batches = (len(chunks) + CHUNK_BATCH_SIZE - 1)//CHUNK_BATCH_SIZE
                
                logger.debug(f"Inserting chunk batch {batch_num}/{total_batches} ({len(batch)} chunks)")
                supabase.table("chunks").insert(batch).execute()
            
            logger.info(f"✅ All {len(chunks)} chunks inserted successfully")
            
            # Step 2: Generate embeddings for all chunks (can retry if this fails)
            logger.info("Generating embeddings for all chunks")
            total_embeddings = 0
            
            for i in range(0, len(chunks), CHUNK_BATCH_SIZE):
                batch = chunks[i:i + CHUNK_BATCH_SIZE]
                batch_num = i//CHUNK_BATCH_SIZE + 1
                total_batches = (len(chunks) + CHUNK_BATCH_SIZE - 1)//CHUNK_BATCH_SIZE
                
                logger.debug(f"Generating embeddings for batch {batch_num}/{total_batches}")
                
                # Prepare batch for embeddings (OpenAI supports up to 2048 inputs per request)
                # Always embed full content for maximum search precision
                # Summaries are metadata only, not for embedding
                chunk_texts = [
                    chunk["content"] 
                    for chunk in batch
                ]
                embeddings = self.embeddings_generator.generate_embeddings_batch(chunk_texts)
                
                # Store embeddings in smaller batches (embeddings are large - 1536 floats each)
                # Split into batches of 20 to avoid timeout
                embedding_records = [
                    {
                        "chunk_id": chunk["id"],
                        "document_id": document_id,
                        "user_id": user_id,
                        "embedding": embedding,
                        "model": "text-embedding-3-small"
                    }
                    for chunk, embedding in zip(batch, embeddings)
                ]
                
                # Insert embeddings in sub-batches of 20
                for j in range(0, len(embedding_records), 20):
                    sub_batch = embedding_records[j:j+20]
                    supabase.table("embeddings").insert(sub_batch).execute()
                
                total_embeddings += len(embeddings)
                
                logger.debug(f"Batch {batch_num}/{total_batches} complete: {len(batch)} chunks + {len(embeddings)} embeddings")
            
            logger.info(f"Successfully stored {len(chunks)} chunks and generated {total_embeddings} embeddings")
            
            # Clean up temporary checkpoint chunks
            try:
                deleted = supabase.table("chunks").delete().eq("document_id", document_id).lt("chunk_index", 0).execute()
                if deleted.data:
                    logger.info(f"🧹 Cleaned up {len(deleted.data)} temporary checkpoint chunks")
            except Exception as e:
                logger.warning(f"Could not clean up checkpoint chunks: {e}")
            
            # Extract graph (entities and relationships) if enabled
            if self.graph_extractor:
                self.update_document_status(document_id, "extracting_graph")
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
                    
                    # Second-pass cleanup: Remove junk entities
                    try:
                        deleted_count = self.graph_extractor.cleanup_junk_entities(user_id, document_id)
                        logger.info(f"Entity cleanup: Removed {deleted_count} junk entities")
                    except Exception as e:
                        logger.warning(f"Entity cleanup failed (non-fatal): {e}")
                        
                except Exception as e:
                    # Don't fail the whole job if graph extraction fails
                    logger.error(f"Graph extraction failed (non-fatal): {e}")
            
            # Update document status to ready
            self.update_document_status(document_id, "ready")
            
            # Clean up extracted content cache (no longer needed)
            try:
                supabase.table("extracted_documents").delete().eq("document_id", document_id).execute()
                logger.info("🧹 Cleaned up extracted content cache")
            except Exception as e:
                logger.warning(f"Could not clean up extracted content cache: {e}")
            
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
