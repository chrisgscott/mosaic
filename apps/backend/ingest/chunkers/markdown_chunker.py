"""
Simple markdown chunker for Docling output.

Docling already preserves document structure in markdown format,
so we just need to split it into manageable chunks while trying
to preserve semantic boundaries (headings, paragraphs, etc.).
"""

import logging
import re
from typing import List, Dict, Any
from uuid import uuid4

logger = logging.getLogger(__name__)


class MarkdownChunker:
    """Simple chunker for markdown text from Docling."""
    
    def __init__(self, chunk_size: int = 1000, overlap: int = 200):
        """
        Initialize markdown chunker.
        
        Args:
            chunk_size: Target size for each chunk in characters
            overlap: Number of characters to overlap between chunks
        """
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk_markdown(self, markdown: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Split markdown into chunks, trying to preserve structure.
        
        Args:
            markdown: Markdown text from Docling
            document_id: UUID of the document
        
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        if not markdown or not markdown.strip():
            logger.warning(f"Empty markdown for document {document_id}")
            return []
        
        logger.info(f"Chunking markdown ({len(markdown):,} chars) for document {document_id}")
        
        # Try to split on semantic boundaries first
        sections = self._split_on_headings(markdown)
        
        # If sections are too large, split them further
        chunks = []
        for section in sections:
            if len(section) <= self.chunk_size:
                chunks.append(section)
            else:
                # Split large sections with overlap
                sub_chunks = self._split_with_overlap(section)
                chunks.extend(sub_chunks)
        
        # Convert to database format
        db_chunks = []
        for idx, chunk_text in enumerate(chunks):
            db_chunks.append({
                "id": str(uuid4()),
                "document_id": document_id,
                "content": chunk_text.strip(),
                "chunk_index": idx,
                "metadata": {
                    "processor": "docling",
                    "chunk_size": len(chunk_text),
                    "has_table": "|" in chunk_text,
                    "has_heading": chunk_text.strip().startswith("#"),
                }
            })
        
        logger.info(f"Created {len(db_chunks)} chunks from markdown")
        return db_chunks
    
    def _split_on_headings(self, markdown: str) -> List[str]:
        """
        Split markdown on heading boundaries.
        
        Returns sections that start with headings when possible.
        """
        # Split on markdown headings (# ## ### etc)
        heading_pattern = r'\n(?=#{1,6}\s)'
        sections = re.split(heading_pattern, markdown)
        
        # Filter out empty sections
        sections = [s.strip() for s in sections if s.strip()]
        
        return sections if sections else [markdown]
    
    def _split_with_overlap(self, text: str) -> List[str]:
        """
        Split text into chunks with overlap.
        
        Args:
            text: Text to split
        
        Returns:
            List of overlapping text chunks
        """
        chunks = []
        start = 0
        
        while start < len(text):
            # Get chunk
            end = start + self.chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary if possible
            if end < len(text):
                # Look for sentence endings in last 100 chars
                last_part = chunk[-100:]
                sentence_end = max(
                    last_part.rfind('. '),
                    last_part.rfind('.\n'),
                    last_part.rfind('! '),
                    last_part.rfind('? ')
                )
                
                if sentence_end > 0:
                    # Adjust chunk to end at sentence
                    chunk = chunk[:-(100 - sentence_end - 1)]
            
            chunks.append(chunk)
            
            # Move start forward (with overlap)
            start = start + self.chunk_size - self.overlap
        
        return chunks
