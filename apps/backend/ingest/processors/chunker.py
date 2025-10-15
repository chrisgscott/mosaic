"""
Text chunking processor.

Splits extracted text into chunks suitable for embedding and retrieval.
"""

import logging
from typing import List, Dict, Any, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
import tiktoken

logger = logging.getLogger(__name__)


class TextChunker:
    """Chunk text into smaller pieces for embedding."""
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base"  # OpenAI's encoding
    ):
        """
        Initialize the text chunker.
        
        Args:
            chunk_size: Target size of each chunk in tokens
            chunk_overlap: Number of tokens to overlap between chunks
            encoding_name: Tokenizer encoding to use
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Initialize tokenizer
        try:
            self.encoding = tiktoken.get_encoding(encoding_name)
        except Exception as e:
            logger.warning(f"Could not load encoding {encoding_name}: {e}")
            self.encoding = None
        
        # Initialize LangChain text splitter
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=self._token_length,
            separators=["\n\n", "\n", ". ", " ", ""],  # Try to split on natural boundaries
        )
    
    def _token_length(self, text: str) -> int:
        """Calculate the token length of text."""
        if self.encoding:
            return len(self.encoding.encode(text))
        else:
            # Fallback: rough estimate (1 token ≈ 4 characters)
            return len(text) // 4
    
    def chunk_text(
        self,
        text: str,
        document_id: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk text into smaller pieces.
        
        Args:
            text: The text to chunk
            document_id: ID of the source document
            user_id: Optional user ID for the document
            metadata: Optional metadata to attach to chunks
            
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for chunking")
            return []
        
        try:
            # Split text into chunks
            chunks = self.splitter.split_text(text)
            
            # Build chunk records for database
            chunk_records = []
            for idx, chunk_text in enumerate(chunks):
                token_count = self._token_length(chunk_text)
                
                chunk_record = {
                    "document_id": document_id,
                    "content": chunk_text,
                    "chunk_index": idx,
                    "token_count": token_count,
                    "metadata": metadata or {}
                }
                
                if user_id:
                    chunk_record["user_id"] = user_id
                
                chunk_records.append(chunk_record)
            
            logger.info(f"Created {len(chunk_records)} chunks from {len(text)} characters")
            return chunk_records
            
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            return []
    
    def chunk_with_metadata(
        self,
        structured_content: Dict[str, Any],
        document_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk text while preserving metadata from structured extraction.
        
        This is more advanced and can be used when you have structured
        content from the Unstructured processor.
        
        Args:
            structured_content: Output from UnstructuredProcessor.extract_with_metadata()
            document_id: ID of the source document
            user_id: Optional user ID
            
        Returns:
            List of chunk dictionaries with preserved metadata
        """
        if "elements" not in structured_content:
            # Fallback to simple chunking
            return self.chunk_text(
                structured_content.get("text", ""),
                document_id,
                user_id
            )
        
        # Group elements by page or section
        # This is a simplified version - you can make this more sophisticated
        elements = structured_content["elements"]
        
        # For now, just chunk the full text but we could do smarter grouping
        # based on page numbers, sections, etc.
        text = structured_content["text"]
        
        return self.chunk_text(text, document_id, user_id)
