"""
Embeddings Generator

Generates vector embeddings for text chunks using OpenAI's text-embedding-3-small model.
Handles batch processing and rate limiting.
"""

import os
import logging
import time
from typing import List, Dict, Any, Optional
from openai import OpenAI, RateLimitError, APIError
from supabase import Client

logger = logging.getLogger(__name__)


class EmbeddingsGenerator:
    """
    Generates and stores vector embeddings for document chunks.
    
    Uses OpenAI's text-embedding-3-small model (1536 dimensions).
    Handles batch processing and rate limiting automatically.
    """
    
    def __init__(self, supabase_client: Client):
        """
        Initialize the embeddings generator.
        
        Args:
            supabase_client: Supabase client for database operations
        """
        self.supabase = supabase_client
        
        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = OpenAI(api_key=api_key)
        self.model = "text-embedding-3-small"
        self.dimensions = 1536
        
        # Rate limiting configuration
        self.batch_size = 100  # Process 100 chunks at a time
        self.max_retries = 3
        self.retry_delay = 2  # seconds
        
        logger.info(f"Initialized EmbeddingsGenerator with model: {self.model}")
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text string.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception: If embedding generation fails after retries
        """
        for attempt in range(self.max_retries):
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=text,
                    encoding_format="float"
                )
                return response.data[0].embedding
                
            except RateLimitError as e:
                if attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Rate limit hit, retrying in {wait_time}s... (attempt {attempt + 1}/{self.max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Rate limit exceeded after {self.max_retries} attempts")
                    raise
                    
            except APIError as e:
                logger.error(f"OpenAI API error: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise
                    
            except Exception as e:
                logger.error(f"Unexpected error generating embedding: {e}")
                raise
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts in a single API call.
        
        Args:
            texts: List of texts to generate embeddings for
            
        Returns:
            List of embedding vectors, one per input text
            
        Raises:
            Exception: If batch embedding generation fails
        """
        if not texts:
            return []
        
        for attempt in range(self.max_retries):
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=texts,
                    encoding_format="float"
                )
                
                # Sort by index to ensure correct order
                embeddings = sorted(response.data, key=lambda x: x.index)
                return [item.embedding for item in embeddings]
                
            except RateLimitError as e:
                if attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    logger.warning(f"Rate limit hit, retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise
                    
            except Exception as e:
                logger.error(f"Error generating batch embeddings: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise
    
    def generate_for_chunk(self, chunk_id: str, chunk_content: str, 
                          document_id: str, user_id: str) -> bool:
        """
        Generate and store embedding for a single chunk.
        
        Args:
            chunk_id: UUID of the chunk
            chunk_content: Text content of the chunk
            document_id: UUID of the parent document
            user_id: UUID of the document owner
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if embedding already exists
            existing = self.supabase.table("embeddings")\
                .select("id")\
                .eq("chunk_id", chunk_id)\
                .execute()
            
            if existing.data:
                logger.debug(f"Embedding already exists for chunk {chunk_id}")
                return True
            
            # Generate embedding
            embedding = self.generate_embedding(chunk_content)
            
            # Store in database
            self.supabase.table("embeddings").insert({
                "chunk_id": chunk_id,
                "document_id": document_id,
                "user_id": user_id,
                "embedding": embedding,
                "model": self.model
            }).execute()
            
            logger.debug(f"Generated embedding for chunk {chunk_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate embedding for chunk {chunk_id}: {e}")
            return False
    
    def generate_for_document(self, document_id: str) -> Dict[str, Any]:
        """
        Generate embeddings for all chunks in a document.
        
        Args:
            document_id: UUID of the document
            
        Returns:
            Dictionary with success status and statistics
        """
        try:
            # Get document info
            doc_result = self.supabase.table("documents")\
                .select("id, user_id, file_name")\
                .eq("id", document_id)\
                .single()\
                .execute()
            
            if not doc_result.data:
                return {
                    "success": False,
                    "error": "Document not found"
                }
            
            document = doc_result.data
            user_id = document["user_id"]
            file_name = document["file_name"]
            
            # Get all chunks for this document
            chunks_result = self.supabase.table("chunks")\
                .select("id, content")\
                .eq("document_id", document_id)\
                .order("chunk_index")\
                .execute()
            
            chunks = chunks_result.data
            total_chunks = len(chunks)
            
            if total_chunks == 0:
                return {
                    "success": True,
                    "message": "No chunks to process",
                    "total_chunks": 0,
                    "processed": 0
                }
            
            logger.info(f"Generating embeddings for {total_chunks} chunks in document: {file_name}")
            
            # Process in batches
            processed = 0
            failed = 0
            
            for i in range(0, total_chunks, self.batch_size):
                batch = chunks[i:i + self.batch_size]
                batch_texts = [chunk["content"] for chunk in batch]
                
                try:
                    # Generate embeddings for batch
                    embeddings = self.generate_embeddings_batch(batch_texts)
                    
                    # Store embeddings
                    embedding_records = [
                        {
                            "chunk_id": chunk["id"],
                            "document_id": document_id,
                            "user_id": user_id,
                            "embedding": embedding,
                            "model": self.model
                        }
                        for chunk, embedding in zip(batch, embeddings)
                    ]
                    
                    self.supabase.table("embeddings").insert(embedding_records).execute()
                    
                    processed += len(batch)
                    logger.info(f"Processed {processed}/{total_chunks} chunks")
                    
                except Exception as e:
                    logger.error(f"Failed to process batch {i//self.batch_size + 1}: {e}")
                    failed += len(batch)
            
            success = failed == 0
            return {
                "success": success,
                "total_chunks": total_chunks,
                "processed": processed,
                "failed": failed,
                "document_id": document_id,
                "file_name": file_name
            }
            
        except Exception as e:
            logger.error(f"Error generating embeddings for document {document_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_for_all_documents(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate embeddings for all documents (optionally filtered by user).
        
        Args:
            user_id: Optional UUID to filter documents by user
            
        Returns:
            Dictionary with overall statistics
        """
        try:
            # Get documents without embeddings
            query = self.supabase.table("documents")\
                .select("id, file_name")\
                .eq("status", "ready")
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            docs_result = query.execute()
            documents = docs_result.data
            
            total_docs = len(documents)
            logger.info(f"Processing {total_docs} documents")
            
            results = []
            for doc in documents:
                result = self.generate_for_document(doc["id"])
                results.append(result)
                
                if result["success"]:
                    logger.info(f"✓ {doc['file_name']}: {result['processed']} chunks")
                else:
                    logger.error(f"✗ {doc['file_name']}: {result.get('error', 'Unknown error')}")
            
            # Calculate overall stats
            total_processed = sum(r.get("processed", 0) for r in results)
            total_failed = sum(r.get("failed", 0) for r in results)
            successful_docs = sum(1 for r in results if r["success"])
            
            return {
                "success": True,
                "total_documents": total_docs,
                "successful_documents": successful_docs,
                "failed_documents": total_docs - successful_docs,
                "total_chunks_processed": total_processed,
                "total_chunks_failed": total_failed,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return {
                "success": False,
                "error": str(e)
            }
