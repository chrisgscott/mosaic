"""
Text chunking processor using Unstructured's native chunking strategies.

Chunks document elements while respecting semantic boundaries like section headings.
"""

import logging
from typing import List, Dict, Any, Optional
from unstructured.chunking.title import chunk_by_title
import tiktoken

logger = logging.getLogger(__name__)


class TextChunker:
    """Chunk document elements using Unstructured's by_title strategy."""
    
    def __init__(
        self,
        max_characters: int = 2000,  # Hard maximum (characters, not tokens)
        new_after_n_chars: int = 1200,  # Soft maximum - start new chunk earlier to avoid splits
        overlap: int = 100,  # Character overlap between chunks
        encoding_name: str = "cl100k_base"  # OpenAI's encoding for token counting
    ):
        """
        Initialize the text chunker.
        
        Args:
            max_characters: Hard maximum chunk size in characters
            new_after_n_chars: Soft maximum - start new chunk after this size
            overlap: Number of characters to overlap between chunks
            encoding_name: Tokenizer encoding for token counting
        """
        self.max_characters = max_characters
        self.new_after_n_chars = new_after_n_chars
        self.overlap = overlap
        
        # Initialize tokenizer for token counting
        try:
            self.encoding = tiktoken.get_encoding(encoding_name)
        except Exception as e:
            logger.warning(f"Could not load encoding {encoding_name}: {e}")
            self.encoding = None
    
    def _token_length(self, text: str) -> int:
        """Calculate the token length of text."""
        if self.encoding:
            return len(self.encoding.encode(text))
        else:
            # Fallback: rough estimate (1 token ≈ 4 characters)
            return len(text) // 4
    
    def chunk_elements(
        self,
        elements: List[Any],
        document_id: str,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        storage_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Chunk document elements using Unstructured's by_title strategy.
        
        This respects section boundaries and semantic structure.
        
        Args:
            elements: List of Unstructured document elements
            document_id: ID of the source document
            user_id: Optional user ID for the document
            metadata: Optional metadata to attach to chunks
            storage_path: Actual storage path (e.g., 'user_id/filename.pdf') to override temp file metadata
            
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        if not elements:
            logger.warning("Empty elements list provided for chunking")
            return []
        
        try:
            # Use Unstructured's by_title chunking strategy
            # This preserves section boundaries and respects document structure
            chunks = chunk_by_title(
                elements=elements,
                max_characters=self.max_characters,
                new_after_n_chars=self.new_after_n_chars,
                overlap=self.overlap,
                multipage_sections=True,  # Allow sections to span pages
                combine_text_under_n_chars=self.new_after_n_chars,  # Combine small sections up to soft max
            )
            
            # Build chunk records for database
            chunk_records = []
            for idx, chunk in enumerate(chunks):
                chunk_text = str(chunk)
                token_count = self._token_length(chunk_text)
                
                # Extract metadata from original elements for citations and deep linking
                chunk_metadata = metadata.copy() if metadata else {}
                if hasattr(chunk, 'metadata') and hasattr(chunk.metadata, 'orig_elements'):
                    orig_elements = chunk.metadata.orig_elements
                    if orig_elements:
                        # Basic element info
                        chunk_metadata['element_count'] = len(orig_elements)
                        
                        # Page numbers for citations
                        page_numbers = {
                            e.metadata.page_number 
                            for e in orig_elements 
                            if hasattr(e, 'metadata') and hasattr(e.metadata, 'page_number') and e.metadata.page_number
                        }
                        if page_numbers:
                            chunk_metadata['page_numbers'] = sorted(list(page_numbers))
                        
                        # Element types (Title, NarrativeText, Table, etc.)
                        element_types = [type(e).__name__ for e in orig_elements]
                        chunk_metadata['element_types'] = list(set(element_types))
                        
                        # Check if chunk contains tables (for special handling)
                        has_table = any(t in element_types for t in ['Table', 'TableChunk'])
                        if has_table:
                            chunk_metadata['contains_table'] = True
                            # Extract table HTML if available
                            for e in orig_elements:
                                if hasattr(e, 'metadata') and hasattr(e.metadata, 'text_as_html'):
                                    if e.metadata.text_as_html:
                                        chunk_metadata['table_html'] = e.metadata.text_as_html
                                        break
                        
                        # Coordinates for PDF deep linking (if available)
                        # This enables linking directly to the position in the PDF
                        coordinates = []
                        for e in orig_elements:
                            if hasattr(e, 'metadata') and hasattr(e.metadata, 'coordinates'):
                                coords = e.metadata.coordinates
                                if coords:
                                    coordinates.append({
                                        'page': getattr(e.metadata, 'page_number', None),
                                        'x': coords.points[0][0] if coords.points else None,
                                        'y': coords.points[0][1] if coords.points else None,
                                    })
                        if coordinates:
                            chunk_metadata['coordinates'] = coordinates[:1]  # Store first element's coords
                        
                        # File metadata from storage path or fallback to element metadata
                        if storage_path:
                            # Use actual Supabase Storage path
                            import os
                            chunk_metadata['source_filename'] = os.path.basename(storage_path)
                            chunk_metadata['source_directory'] = os.path.dirname(storage_path)
                        else:
                            # Fallback to element metadata (temp file paths)
                            first_elem = orig_elements[0]
                            if hasattr(first_elem, 'metadata'):
                                if hasattr(first_elem.metadata, 'filename'):
                                    chunk_metadata['source_filename'] = first_elem.metadata.filename
                                if hasattr(first_elem.metadata, 'file_directory'):
                                    chunk_metadata['source_directory'] = first_elem.metadata.file_directory
                        
                        # Last modified date from element metadata
                        first_elem = orig_elements[0]
                        if hasattr(first_elem, 'metadata'):
                            if hasattr(first_elem.metadata, 'last_modified'):
                                chunk_metadata['file_last_modified'] = str(first_elem.metadata.last_modified)
                        
                        # Links for HTML/web documents
                        links = []
                        for e in orig_elements:
                            if hasattr(e, 'metadata') and hasattr(e.metadata, 'links'):
                                if e.metadata.links:
                                    links.extend(e.metadata.links)
                        if links:
                            chunk_metadata['links'] = links[:10]  # Store up to 10 links
                
                chunk_record = {
                    "document_id": document_id,
                    "content": chunk_text,
                    "chunk_index": idx,
                    "token_count": token_count,
                    "metadata": chunk_metadata
                }
                
                if user_id:
                    chunk_record["user_id"] = user_id
                
                chunk_records.append(chunk_record)
            
            logger.info(f"Created {len(chunk_records)} chunks from {len(elements)} elements")
            return chunk_records
            
        except Exception as e:
            logger.error(f"Error chunking elements: {e}")
            return []
    
