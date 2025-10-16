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

logger = logging.getLogger(__name__)


class HybridChunker:
    """Wrapper for Docling's HybridChunker with embedding model tokenizer."""
    
    def __init__(self, 
                 embedding_model: str = "text-embedding-3-small",
                 max_tokens: int = 512,
                 merge_peers: bool = True,
                 summary_neighbors: int = 2):
        """
        Initialize HybridChunker with embedding model tokenizer.
        
        Args:
            embedding_model: OpenAI embedding model name (for token counting)
            max_tokens: Maximum tokens per chunk
            merge_peers: Whether to merge undersized successive chunks with same headings
            summary_neighbors: Number of neighboring chunks to include in summary generation (0 to disable)
        """
        self.embedding_model = embedding_model
        self.max_tokens = max_tokens
        self.merge_peers = merge_peers
        self.summary_neighbors = summary_neighbors
        
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
        self.chunker = DoclingHybridChunker(
            tokenizer=self.tokenizer,
            max_tokens=max_tokens,
            merge_peers=merge_peers
        )
        logger.info(f"HybridChunker initialized (max_tokens={max_tokens}, merge_peers={merge_peers})")
    
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
                context_parts.append(f"PRECEDING CONTEXT:\n{prev_text}")
            
            context_parts.append(f"CURRENT CHUNK:\n{current_chunk}")
            
            if next_chunks:
                next_text = "\n\n".join(next_chunks)
                context_parts.append(f"FOLLOWING CONTEXT:\n{next_text}")
            
            full_context = "\n\n---\n\n".join(context_parts)
            
            # Generate summary using GPT-5-nano (58% cheaper with caching)
            response = self.openai_client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {
                        "role": "system",
                        "content": f"Analyze the CURRENT CHUNK in context of its neighbors and write a {summary_guidance} summary. Focus on: (1) the main topic and key concepts, (2) how it connects to surrounding content, and (3) its role in the broader document. For larger chunks, ensure you capture all important concepts and details. Write directly and avoid meta-commentary like 'this chunk describes' or 'the current chunk provides'."
                    },
                    {
                        "role": "user",
                        "content": full_context
                    }
                ],
                max_completion_tokens=max_tokens  # GPT-5 models use max_completion_tokens
                # Note: GPT-5-nano only supports default temperature (1)
            )
            
            summary = response.choices[0].message.content.strip()
            logger.debug(f"Generated summary: {summary[:100]}...")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating chunk summary: {e}")
            return None
    
    def chunk_document(self, docling_doc: DoclingDocument, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk a DoclingDocument using HybridChunker.
        
        Args:
            docling_doc: DoclingDocument object from Docling processor
            document_id: UUID of the document
        
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        if not docling_doc:
            logger.warning(f"Empty DoclingDocument for document {document_id}")
            return []
        
        logger.info(f"Chunking document {document_id} with HybridChunker")
        
        try:
            # Use Docling's HybridChunker to create chunks
            chunk_iter = self.chunker.chunk(dl_doc=docling_doc)
            chunks = list(chunk_iter)
            
            logger.info(f"HybridChunker created {len(chunks)} chunks")
            
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
            
            # Second pass: Generate summaries with neighbor context
            if self.summary_neighbors > 0:
                logger.info(f"Generating summaries with {self.summary_neighbors} neighbors per chunk")
                
                successful_summaries = 0
                failed_summaries = 0
                
                for idx, db_chunk in enumerate(db_chunks):
                    # Get previous chunks
                    start_prev = max(0, idx - self.summary_neighbors)
                    previous_chunks = chunk_texts[start_prev:idx]
                    
                    # Get next chunks
                    end_next = min(len(chunk_texts), idx + self.summary_neighbors + 1)
                    next_chunks = chunk_texts[idx + 1:end_next]
                    
                    # Generate summary with adaptive length based on chunk size
                    summary = self._generate_chunk_summary(
                        current_chunk=chunk_texts[idx],
                        current_chunk_tokens=db_chunk["token_count"],
                        previous_chunks=previous_chunks,
                        next_chunks=next_chunks
                    )
                    
                    if summary:
                        db_chunk["summary"] = summary
                        successful_summaries += 1
                        logger.debug(f"Chunk {idx}: Generated summary ({len(summary)} chars)")
                    else:
                        db_chunk["summary"] = None
                        failed_summaries += 1
                        logger.warning(f"Chunk {idx}: Failed to generate summary")
                
                logger.info(f"Summary generation complete: {successful_summaries} successful, {failed_summaries} failed")
            
            logger.info(f"Created {len(db_chunks)} chunks from DoclingDocument")
            return db_chunks
            
        except Exception as e:
            logger.error(f"Error chunking document {document_id}: {e}")
            raise
