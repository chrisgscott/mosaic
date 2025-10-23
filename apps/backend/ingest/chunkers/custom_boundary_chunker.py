"""
Custom Boundary Chunker for semantic chunking based on document structure.

Allows per-document chunking rules that respect logical boundaries like:
- Recipe cards (title + description + steps)
- Chapters or sections
- Custom markers defined by the user
"""

import logging
import re
from typing import List, Dict, Any, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class CustomBoundaryChunker:
    """
    Chunks documents based on custom boundary markers and keep-together rules.
    
    Example config:
    {
        "boundary_markers": ["Recipe", "##", "Chapter"],
        "keep_together_patterns": [
            {
                "start_marker": "Recipe\\n",
                "end_marker": "pipdecks.com",
                "description": "Keep recipe cards together"
            }
        ],
        "max_chunk_tokens": 512
    }
    """
    
    def __init__(self, config: Dict[str, Any], tokenizer=None):
        """
        Initialize the custom boundary chunker.
        
        Args:
            config: Chunking configuration with boundary markers and rules
            tokenizer: Optional tokenizer for token counting
        """
        self.config = config
        self.tokenizer = tokenizer
        self.boundary_markers = config.get('boundary_markers', [])
        self.keep_together_patterns = config.get('keep_together_patterns', [])
        self.max_chunk_tokens = config.get('max_chunk_tokens', 512)
        
        logger.info(f"Initialized CustomBoundaryChunker with {len(self.keep_together_patterns)} keep-together patterns")
    
    def chunk_document(self, content: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk document based on custom boundary rules.
        
        Args:
            content: Full document text
            document_id: UUID of the document
            
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        logger.info(f"Chunking document {document_id} with custom boundaries")
        
        chunks = []
        
        # First, try to identify keep-together sections
        sections = self._identify_sections(content)
        
        logger.info(f"Identified {len(sections)} sections to process")
        
        chunk_index = 0
        for section in sections:
            section_text = section['text'].strip()
            
            if not section_text:
                continue
            
            # Check if section is small enough to be a single chunk
            token_count = self._count_tokens(section_text)
            
            if token_count <= self.max_chunk_tokens:
                # Keep entire section together
                chunks.append({
                    "id": str(uuid4()),
                    "document_id": document_id,
                    "content": section_text,
                    "chunk_index": chunk_index,
                    "token_count": token_count,
                    "summary": None,
                    "metadata": {
                        "processor": "custom_boundary",
                        "section_type": section.get('type', 'unknown'),
                        "boundary_start": section.get('start_marker'),
                        "boundary_end": section.get('end_marker'),
                        "chunk_size": len(section_text),
                        "token_count": token_count,
                    }
                })
                chunk_index += 1
            else:
                # Section too large, split it intelligently
                sub_chunks = self._split_large_section(section_text, section.get('type'))
                
                for sub_chunk_text in sub_chunks:
                    token_count = self._count_tokens(sub_chunk_text)
                    chunks.append({
                        "id": str(uuid4()),
                        "document_id": document_id,
                        "content": sub_chunk_text.strip(),
                        "chunk_index": chunk_index,
                        "token_count": token_count,
                        "summary": None,
                        "metadata": {
                            "processor": "custom_boundary",
                            "section_type": section.get('type', 'unknown'),
                            "is_subsection": True,
                            "chunk_size": len(sub_chunk_text),
                            "token_count": token_count,
                        }
                    })
                    chunk_index += 1
        
        logger.info(f"Created {len(chunks)} chunks using custom boundaries")
        
        return chunks
    
    def _identify_sections(self, content: str) -> List[Dict[str, Any]]:
        """
        Identify sections in the document based on keep-together patterns.
        
        Returns:
            List of sections with their text and metadata
        """
        sections = []
        
        if not self.keep_together_patterns:
            # No patterns defined, split on boundary markers
            return self._split_on_markers(content)
        
        # Process each keep-together pattern
        for pattern in self.keep_together_patterns:
            start_marker = pattern.get('start_marker', '')
            end_marker = pattern.get('end_marker', '')
            section_type = pattern.get('description', 'section')
            
            if not start_marker:
                continue
            
            # Find all sections matching this pattern
            pattern_sections = self._find_pattern_sections(
                content, 
                start_marker, 
                end_marker, 
                section_type
            )
            sections.extend(pattern_sections)
        
        # If no sections found, fall back to marker-based splitting
        if not sections:
            sections = self._split_on_markers(content)
        
        return sections
    
    def _find_pattern_sections(
        self, 
        content: str, 
        start_marker: str, 
        end_marker: str, 
        section_type: str
    ) -> List[Dict[str, Any]]:
        """
        Find all sections matching a start/end marker pattern.
        """
        sections = []
        
        # Escape regex special characters in markers
        start_pattern = re.escape(start_marker)
        end_pattern = re.escape(end_marker) if end_marker else None
        
        # Find all start positions
        start_matches = list(re.finditer(start_pattern, content))
        
        for i, start_match in enumerate(start_matches):
            start_pos = start_match.start()
            
            # Find the end position
            if end_pattern:
                # Look for end marker after this start marker
                search_start = start_match.end()
                # Don't go past the next start marker
                search_end = start_matches[i + 1].start() if i + 1 < len(start_matches) else len(content)
                
                end_match = re.search(end_pattern, content[search_start:search_end])
                end_pos = search_start + end_match.end() if end_match else search_end
            else:
                # No end marker, go to next start marker or end of document
                end_pos = start_matches[i + 1].start() if i + 1 < len(start_matches) else len(content)
            
            section_text = content[start_pos:end_pos]
            
            sections.append({
                'text': section_text,
                'type': section_type,
                'start_marker': start_marker,
                'end_marker': end_marker,
                'start_pos': start_pos,
                'end_pos': end_pos
            })
        
        return sections
    
    def _split_on_markers(self, content: str) -> List[Dict[str, Any]]:
        """
        Split content on boundary markers when no keep-together patterns defined.
        """
        if not self.boundary_markers:
            # No markers, return entire content as one section
            return [{'text': content, 'type': 'full_document'}]
        
        sections = []
        current_pos = 0
        
        # Create regex pattern for all markers
        marker_pattern = '|'.join(re.escape(m) for m in self.boundary_markers)
        
        for match in re.finditer(marker_pattern, content):
            # Add section before this marker
            if match.start() > current_pos:
                sections.append({
                    'text': content[current_pos:match.start()],
                    'type': 'pre_marker'
                })
            
            current_pos = match.start()
        
        # Add final section
        if current_pos < len(content):
            sections.append({
                'text': content[current_pos:],
                'type': 'final'
            })
        
        return sections
    
    def _split_large_section(self, text: str, section_type: str) -> List[str]:
        """
        Split a large section into smaller chunks while respecting paragraph boundaries.
        """
        chunks = []
        paragraphs = text.split('\n\n')
        
        current_chunk = []
        current_tokens = 0
        
        for para in paragraphs:
            para_tokens = self._count_tokens(para)
            
            if current_tokens + para_tokens > self.max_chunk_tokens and current_chunk:
                # Save current chunk and start new one
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = [para]
                current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens
        
        # Add final chunk
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        return chunks
    
    def _count_tokens(self, text: str) -> int:
        """
        Count tokens in text using tokenizer or fallback to word count.
        """
        if self.tokenizer:
            return self.tokenizer.count_tokens(text=text)
        else:
            # Rough estimate: 1 token ≈ 0.75 words
            return int(len(text.split()) * 1.33)
