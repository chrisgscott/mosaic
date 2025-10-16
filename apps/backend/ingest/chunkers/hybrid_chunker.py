"""
Docling HybridChunker wrapper for intelligent document chunking.

Uses Docling's native HybridChunker which:
- Starts with hierarchical chunking based on document structure
- Applies tokenization-aware refinements aligned to embedding model
- Preserves semantic boundaries and document metadata
- Merges undersized chunks with same headings/captions
"""

import logging
from typing import List, Dict, Any
from uuid import uuid4
from docling_core.types.doc.document import DoclingDocument
from docling.chunking import HybridChunker as DoclingHybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer

logger = logging.getLogger(__name__)


class HybridChunker:
    """Wrapper for Docling's HybridChunker with embedding model tokenizer."""
    
    def __init__(self, 
                 embedding_model: str = "text-embedding-3-small",
                 max_tokens: int = 512,
                 merge_peers: bool = True):
        """
        Initialize HybridChunker with embedding model tokenizer.
        
        Args:
            embedding_model: OpenAI embedding model name (for token counting)
            max_tokens: Maximum tokens per chunk
            merge_peers: Whether to merge undersized successive chunks with same headings
        """
        self.embedding_model = embedding_model
        self.max_tokens = max_tokens
        self.merge_peers = merge_peers
        
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
            
            # Convert to database format
            db_chunks = []
            for idx, chunk in enumerate(chunks):
                # Get contextualized text (includes metadata like headers)
                chunk_text = self.chunker.contextualize(chunk=chunk)
                
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
                    "metadata": metadata
                })
            
            logger.info(f"Created {len(db_chunks)} chunks from DoclingDocument")
            return db_chunks
            
        except Exception as e:
            logger.error(f"Error chunking document {document_id}: {e}")
            raise
