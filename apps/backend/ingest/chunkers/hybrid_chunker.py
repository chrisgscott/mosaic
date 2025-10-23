"""
Docling HybridChunker wrapper for intelligent document chunking.

Uses Docling's native HybridChunker which:
- Starts with hierarchical chunking based on document structure
- Applies tokenization-aware refinements aligned to embedding model
- Preserves semantic boundaries and document metadata
- Merges undersized chunks with same headings/captions
"""

import logging
import os
from typing import List, Dict, Any, Optional
from uuid import uuid4
from docling_core.types.doc.document import DoclingDocument
from docling.chunking import HybridChunker as DoclingHybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class HybridChunker:
    """Wrapper for Docling's HybridChunker with embedding model tokenizer."""
    
    def __init__(self, 
                 embedding_model: str = "text-embedding-3-small",
                 max_tokens: int = 512,
                 merge_peers: bool = True,
                 summary_neighbors: int = 2,
                 settings_service=None):
        """
        Initialize HybridChunker with embedding model tokenizer.
        
        Args:
            embedding_model: OpenAI embedding model name (for token counting)
            max_tokens: Maximum tokens per chunk
            merge_peers: Whether to merge undersized successive chunks with same headings
            summary_neighbors: Number of neighboring chunks to include in summary generation (0 to disable)
            settings_service: Optional settings service for reading model configuration
        """
        self.embedding_model = embedding_model
        self.max_tokens = max_tokens
        self.merge_peers = merge_peers
        self.summary_neighbors = summary_neighbors
        self.settings_service = settings_service
        
        # Initialize OpenAI client for summary generation
        if summary_neighbors > 0:
            self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            logger.info(f"Summary generation enabled with {summary_neighbors} neighbors")
        else:
            self.openai_client = None
            logger.info("Summary generation disabled")
        
        # For OpenAI models, we'll use tiktoken via a simple wrapper
        # since HuggingFace tokenizers are designed for HF models
        # We'll use a compatible tokenizer as a proxy
        try:
            # Use a similar tokenizer as proxy for token counting
            # sentence-transformers models are commonly used for embeddings
            tokenizer_model = "sentence-transformers/all-MiniLM-L6-v2"
            hf_tokenizer = AutoTokenizer.from_pretrained(tokenizer_model)
            self.tokenizer = HuggingFaceTokenizer(tokenizer=hf_tokenizer)
            logger.info(f"Initialized HybridChunker with {tokenizer_model} tokenizer (proxy for {embedding_model})")
        except Exception as e:
            logger.error(f"Failed to initialize tokenizer: {e}")
            raise
        
        # Initialize Docling's HybridChunker
        # NOTE: merge_peers=False prevents aggressive merging of content
        # This ensures we get more granular chunks even from documents with few headings
        self.chunker = DoclingHybridChunker(
            tokenizer=self.tokenizer,
            max_tokens=max_tokens,
            merge_peers=False  # Disable merging to get more chunks
        )
        logger.info(f"HybridChunker initialized (max_tokens={max_tokens}, merge_peers=False)")
    
    def _generate_chunk_summary(self, 
                                current_chunk: str,
                                current_chunk_tokens: int,
                                previous_chunks: List[str],
                                next_chunks: List[str]) -> Optional[str]:
        """
        Generate a contextual summary for a chunk by analyzing its neighbors.
        
        Args:
            current_chunk: The chunk to summarize
            current_chunk_tokens: Token count of current chunk
            previous_chunks: List of preceding chunks (up to summary_neighbors)
            next_chunks: List of following chunks (up to summary_neighbors)
        
        Returns:
            Summary string or None if generation fails
        """
        if not self.openai_client:
            return None
        
        try:
            # Determine summary length based on chunk size
            if current_chunk_tokens < 100:
                # Small chunks: 1-2 sentences
                summary_guidance = "1-2 concise sentences"
                max_tokens = 100
            elif current_chunk_tokens < 300:
                # Medium chunks: 2-3 sentences
                summary_guidance = "2-3 sentences"
                max_tokens = 150
            else:
                # Large chunks: 3-5 sentences with more detail
                summary_guidance = "3-5 sentences covering all major points"
                max_tokens = 250
            
            # Build context from neighbors
            context_parts = []
            
            if previous_chunks:
                prev_text = "\n\n".join(previous_chunks)
                context_parts.append(f"[PRECEDING CONTEXT - FOR REFERENCE ONLY]:\n{prev_text}")
            
            context_parts.append(f"[CURRENT CHUNK - SUMMARIZE THIS]:\n{current_chunk}")
            
            if next_chunks:
                next_text = "\n\n".join(next_chunks)
                context_parts.append(f"[FOLLOWING CONTEXT - FOR REFERENCE ONLY]:\n{next_text}")
            
            full_context = "\n\n---\n\n".join(context_parts)
            
            # Get summary model from settings (default to gpt-4o-mini)
            summary_model = "gpt-4o-mini"
            if self.settings_service:
                summary_model = self.settings_service.get_string('processing.summaryModel', 'gpt-4o-mini')
            
            # Generate summary
            response = self.openai_client.chat.completions.create(
                model=summary_model,
                messages=[
                    {
                        "role": "system",
                        "content": f"You must write a {summary_guidance} summary of ONLY the [CURRENT CHUNK - SUMMARIZE THIS] section. The preceding and following context sections are provided for reference only to help you understand connections, but you must ONLY summarize the current chunk. If the current chunk is self-contained, summarize it directly. Only mention relationships to surrounding content if they are genuinely meaningful and evident. Write directly and avoid meta-commentary."
                    },
                    {
                        "role": "user",
                        "content": full_context
                    }
                ],
                temperature=0.3,
                max_tokens=max_tokens
            )
            
            # Debug: Log the full response structure
            logger.debug(f"API Response: {response}")
            
            # Extract summary from response
            if not response.choices:
                logger.error("No choices in API response")
                return None
            
            message = response.choices[0].message
            if not message:
                logger.error("No message in first choice")
                return None
            
            content = message.content
            if not content:
                logger.error(f"No content in message. Message: {message}")
                return None
            
            summary = content.strip()
            if not summary:
                logger.error("Summary is empty after stripping")
                return None
                
            logger.debug(f"Generated summary: {summary[:100]}...")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating chunk summary: {e}", exc_info=True)
            return None
    
    def _chunk_page_documents(self, page_documents: List[tuple], document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk individual page documents without merging them first.
        This avoids the Docling export_to_markdown() bug that loses content on merged documents.
        
        Args:
            page_documents: List of (page_num, DoclingDocument) tuples
            document_id: UUID of the document
        
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        logger.info(f"Chunking {len(page_documents)} pages individually to avoid content loss")
        
        all_chunks = []
        chunk_index = 0
        
        # Sort pages by page number
        sorted_pages = sorted(page_documents, key=lambda x: x[0])
        
        for page_num, page_doc in sorted_pages:
            try:
                # Chunk this individual page
                chunk_iter = self.chunker.chunk(dl_doc=page_doc)
                page_chunks = list(chunk_iter)
                
                logger.debug(f"Page {page_num}: created {len(page_chunks)} chunks")
                
                # Convert to database format
                for chunk in page_chunks:
                    chunk_text = self.chunker.contextualize(chunk=chunk)
                    token_count = self.tokenizer.count_tokens(text=chunk_text)
                    
                    metadata = {
                        "processor": "docling_hybrid",
                        "page_number": page_num,
                        "chunk_size": len(chunk_text),
                        "token_count": token_count,
                        "embedding_model": self.embedding_model,
                    }
                    
                    # Add document item references if available
                    if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'doc_items'):
                        doc_items_refs = [it.self_ref for it in chunk.meta.doc_items]
                        metadata["doc_items"] = doc_items_refs
                    
                    # Add headings if available
                    if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'headings'):
                        metadata["headings"] = chunk.meta.headings
                    
                    all_chunks.append({
                        "id": str(uuid4()),
                        "document_id": document_id,
                        "content": chunk_text.strip(),
                        "chunk_index": chunk_index,
                        "token_count": token_count,
                        "summary": None,  # Will be populated later
                        "metadata": metadata
                    })
                    
                    chunk_index += 1
                    
            except Exception as e:
                logger.error(f"Error chunking page {page_num}: {e}", exc_info=True)
                continue
        
        logger.info(f"Created {len(all_chunks)} total chunks from {len(page_documents)} pages")
        
        # Generate summaries for all chunks
        if self.summary_neighbors > 0 and all_chunks:
            logger.info(f"Generating summaries with {self.summary_neighbors} neighbors per chunk")
            
            # Get parallel workers from settings
            if self.settings_service:
                max_workers = self.settings_service.get_int('processing.summaryParallelWorkers', 20, 'SUMMARY_GENERATION_WORKERS')
            else:
                max_workers = int(os.getenv('SUMMARY_GENERATION_WORKERS', '20'))
            
            # Generate summaries in parallel
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = []
                for i, chunk in enumerate(all_chunks):
                    # Get neighbors
                    start_idx = max(0, i - self.summary_neighbors)
                    end_idx = min(len(all_chunks), i + self.summary_neighbors + 1)
                    
                    previous_chunks = [all_chunks[j]["content"] for j in range(start_idx, i)]
                    next_chunks = [all_chunks[j]["content"] for j in range(i + 1, end_idx)]
                    
                    future = executor.submit(
                        self._generate_chunk_summary,
                        chunk["content"],
                        chunk["token_count"],
                        previous_chunks,
                        next_chunks
                    )
                    futures.append((i, future))
                
                # Collect results
                successful = 0
                failed = 0
                for i, future in futures:
                    try:
                        summary = future.result(timeout=30)
                        if summary:
                            all_chunks[i]["summary"] = summary
                            successful += 1
                        else:
                            failed += 1
                    except Exception as e:
                        logger.error(f"Failed to generate summary for chunk {i}: {e}")
                        failed += 1
                
                logger.info(f"Summary generation complete: {successful} successful, {failed} failed")
        
        return all_chunks
    
    def chunk_document(self, docling_doc, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk a DoclingDocument using HybridChunker.
        
        Args:
            docling_doc: DoclingDocument object OR dict with page_documents from Docling processor
            document_id: UUID of the document
        
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        if not docling_doc:
            logger.warning(f"Empty DoclingDocument for document {document_id}")
            return []
        
        # Check if we received page documents instead of a merged document
        if isinstance(docling_doc, dict) and docling_doc.get("type") == "page_documents":
            logger.info(f"Received {len(docling_doc['pages'])} page documents - chunking individually")
            return self._chunk_page_documents(docling_doc["pages"], document_id)
        
        logger.info(f"Chunking document {document_id} with HybridChunker")
        
        # Debug: Log document structure
        logger.info(f"DoclingDocument has {len(docling_doc.texts)} text elements")
        if hasattr(docling_doc, 'tables'):
            logger.info(f"DoclingDocument has {len(docling_doc.tables)} tables")
        
        # Debug: Check total document content
        try:
            from docling.document_converter import DocumentConverter
            full_markdown = docling_doc.export_to_markdown()
            logger.info(f"Full document markdown length: {len(full_markdown)} characters")
            
            # CRITICAL BUG: export_to_markdown() is broken for merged documents
            # It only returns a tiny fraction of content (1,402 chars for 113 pages!)
            # Calculate what the actual content should be by summing text elements
            total_text_chars = sum(len(text.text) for text in docling_doc.texts if hasattr(text, 'text'))
            logger.warning(f"⚠️  CONTENT LOSS DETECTED: markdown export={len(full_markdown)} chars, but text elements contain {total_text_chars} chars")
            logger.warning(f"⚠️  This is a Docling bug - export_to_markdown() loses content on merged documents")
        except Exception as e:
            logger.warning(f"Could not export to markdown: {e}")
        
        try:
            # Use Docling's HybridChunker to create chunks
            chunk_iter = self.chunker.chunk(dl_doc=docling_doc)
            chunks = list(chunk_iter)
            
            logger.info(f"HybridChunker created {len(chunks)} chunks")
            
            # Debug: Log total content length
            total_chars = sum(len(self.chunker.contextualize(chunk=chunk)) for chunk in chunks)
            logger.info(f"Total characters in chunks: {total_chars}")
            
            # First pass: Convert to database format with text
            db_chunks = []
            chunk_texts = []
            
            for idx, chunk in enumerate(chunks):
                # Get contextualized text (includes metadata like headers)
                chunk_text = self.chunker.contextualize(chunk=chunk)
                chunk_texts.append(chunk_text)
                
                # Count tokens
                token_count = self.tokenizer.count_tokens(text=chunk_text)
                
                # Extract metadata from chunk
                metadata = {
                    "processor": "docling_hybrid",
                    "chunk_size": len(chunk_text),
                    "token_count": token_count,
                    "embedding_model": self.embedding_model,
                }
                
                # Add document item references if available
                if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'doc_items'):
                    doc_items_refs = [it.self_ref for it in chunk.meta.doc_items]
                    metadata["doc_items"] = doc_items_refs
                
                # Add headings if available
                if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'headings'):
                    metadata["headings"] = chunk.meta.headings
                
                db_chunks.append({
                    "id": str(uuid4()),
                    "document_id": document_id,
                    "content": chunk_text.strip(),
                    "chunk_index": idx,
                    "token_count": token_count,
                    "summary": None,  # Will be populated in second pass
                    "metadata": metadata
                })
            
            # Second pass: Generate summaries with neighbor context (in parallel)
            if self.summary_neighbors > 0:
                # Get parallel workers from settings (with ENV fallback)
                if self.settings_service:
                    max_workers = self.settings_service.get_int('processing.summaryParallelWorkers', 20, 'SUMMARY_GENERATION_WORKERS')
                else:
                    max_workers = int(os.getenv("SUMMARY_GENERATION_WORKERS", "20"))
                logger.info(f"Generating summaries with {self.summary_neighbors} neighbors per chunk ({max_workers} workers)")
                
                successful_summaries = 0
                failed_summaries = 0
                
                # Process summaries in parallel
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    # Submit all summary generation tasks
                    future_to_idx = {}
                    for idx, db_chunk in enumerate(db_chunks):
                        # Get previous chunks
                        start_prev = max(0, idx - self.summary_neighbors)
                        previous_chunks = chunk_texts[start_prev:idx]
                        
                        # Get next chunks
                        end_next = min(len(chunk_texts), idx + self.summary_neighbors + 1)
                        next_chunks = chunk_texts[idx + 1:end_next]
                        
                        # Submit summary generation task
                        future = executor.submit(
                            self._generate_chunk_summary,
                            current_chunk=chunk_texts[idx],
                            current_chunk_tokens=db_chunk["token_count"],
                            previous_chunks=previous_chunks,
                            next_chunks=next_chunks
                        )
                        future_to_idx[future] = idx
                    
                    # Collect results as they complete
                    for future in as_completed(future_to_idx):
                        idx = future_to_idx[future]
                        try:
                            summary = future.result()
                            if summary:
                                db_chunks[idx]["summary"] = summary
                                successful_summaries += 1
                                logger.debug(f"Chunk {idx}: Generated summary ({len(summary)} chars)")
                            else:
                                db_chunks[idx]["summary"] = None
                                failed_summaries += 1
                                logger.warning(f"Chunk {idx}: Failed to generate summary")
                        except Exception as e:
                            db_chunks[idx]["summary"] = None
                            failed_summaries += 1
                            logger.error(f"Chunk {idx}: Error generating summary: {e}")
                
                logger.info(f"Summary generation complete: {successful_summaries} successful, {failed_summaries} failed")
            
            logger.info(f"Created {len(db_chunks)} chunks from DoclingDocument")
            return db_chunks
            
        except Exception as e:
            logger.error(f"Error chunking document {document_id}: {e}")
            raise
