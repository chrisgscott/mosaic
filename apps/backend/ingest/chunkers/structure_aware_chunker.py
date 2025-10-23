"""
Structure-Aware Chunker

Simple chunker that respects Docling's natural document structure.
No LLM calls, no byte offsets, no complexity.

Philosophy:
- Docling already parsed the document structure
- Use sections, paragraphs, and tables as natural boundaries
- Split large sections, merge small ones
- Fast, deterministic, free
"""

from typing import List, Dict, Any
import logging
import uuid

logger = logging.getLogger(__name__)


class StructureAwareChunker:
    """
    Simple chunker that uses Docling's document structure.
    
    Strategy:
    1. Iterate through Docling's structured elements
    2. Group paragraphs into sections
    3. Chunk when section reaches target size
    4. Tables become their own chunks
    """
    
    def __init__(self, target_size: int = 1000, min_size: int = 300, max_size: int = 2000):
        """
        Initialize chunker with size parameters.
        
        Args:
            target_size: Target chunk size in characters (default: 1000)
            min_size: Minimum chunk size (default: 300)
            max_size: Maximum chunk size before forced split (default: 2000)
        """
        self.target_size = target_size
        self.min_size = min_size
        self.max_size = max_size
        logger.info(f"StructureAwareChunker initialized (target={target_size}, min={min_size}, max={max_size})")
    
    def chunk_document(self, docling_doc, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk document using Docling's natural structure.
        
        Args:
            docling_doc: Docling Document object with structure
            document_id: Document ID for chunk references
            
        Returns:
            List of chunk dictionaries
        """
        chunks = []
        current_section = {
            "title": "",
            "level": 0,
            "paragraphs": []
        }
        
        # Export to markdown and process
        markdown = docling_doc.export_to_markdown()
        lines = markdown.split('\n')
        
        current_para = []
        
        for line in lines:
            # Detect section headers
            if line.startswith('#'):
                # Flush current paragraph
                if current_para:
                    para_text = '\n'.join(current_para).strip()
                    if para_text:
                        current_section["paragraphs"].append(para_text)
                    current_para = []
                
                # Flush current section if it has content
                if current_section["paragraphs"]:
                    chunks.extend(self._chunk_section(current_section, document_id, len(chunks)))
                
                # Start new section
                level = len(line) - len(line.lstrip('#'))
                title = line.lstrip('#').strip()
                current_section = {
                    "title": title,
                    "level": level,
                    "paragraphs": []
                }
            
            # Detect table markers
            elif line.startswith('|') and '|' in line[1:]:
                # Flush current paragraph
                if current_para:
                    para_text = '\n'.join(current_para).strip()
                    if para_text:
                        current_section["paragraphs"].append(para_text)
                    current_para = []
                
                # Tables are handled as part of paragraphs for now
                # Could be enhanced to extract as separate chunks
                current_para.append(line)
            
            # Regular content
            elif line.strip():
                current_para.append(line)
            
            # Empty line - paragraph boundary
            elif current_para:
                para_text = '\n'.join(current_para).strip()
                if para_text:
                    current_section["paragraphs"].append(para_text)
                current_para = []
        
        # Flush final paragraph
        if current_para:
            para_text = '\n'.join(current_para).strip()
            if para_text:
                current_section["paragraphs"].append(para_text)
        
        # Flush final section
        if current_section["paragraphs"]:
            chunks.extend(self._chunk_section(current_section, document_id, len(chunks)))
        
        logger.info(f"Created {len(chunks)} chunks from document structure")
        return chunks
    
    def _chunk_section(self, section: Dict[str, Any], document_id: str, start_index: int) -> List[Dict[str, Any]]:
        """
        Chunk a section based on size constraints.
        
        Args:
            section: Section dictionary with title, level, paragraphs
            document_id: Document ID
            start_index: Starting chunk index
            
        Returns:
            List of chunks for this section
        """
        chunks = []
        current_chunk_paras = []
        current_size = 0
        
        for para in section["paragraphs"]:
            para_size = len(para)
            
            # If adding this paragraph exceeds max_size, flush current chunk
            if current_size + para_size > self.max_size and current_chunk_paras:
                chunks.append(self._create_chunk(
                    section["title"],
                    section["level"],
                    current_chunk_paras,
                    document_id,
                    start_index + len(chunks)
                ))
                current_chunk_paras = [para]
                current_size = para_size
            
            # If adding this paragraph reaches target_size, flush current chunk
            elif current_size + para_size >= self.target_size and current_chunk_paras:
                current_chunk_paras.append(para)
                chunks.append(self._create_chunk(
                    section["title"],
                    section["level"],
                    current_chunk_paras,
                    document_id,
                    start_index + len(chunks)
                ))
                current_chunk_paras = []
                current_size = 0
            
            # Otherwise, accumulate
            else:
                current_chunk_paras.append(para)
                current_size += para_size
        
        # Flush remaining paragraphs
        if current_chunk_paras:
            # If too small and we have previous chunks, merge with last chunk
            if current_size < self.min_size and chunks:
                last_chunk = chunks[-1]
                last_chunk["content"] += "\n\n" + "\n\n".join(current_chunk_paras)
                last_chunk["metadata"]["char_count"] = len(last_chunk["content"])
            else:
                chunks.append(self._create_chunk(
                    section["title"],
                    section["level"],
                    current_chunk_paras,
                    document_id,
                    start_index + len(chunks)
                ))
        
        return chunks
    
    def _create_chunk(
        self,
        section_title: str,
        section_level: int,
        paragraphs: List[str],
        document_id: str,
        chunk_index: int
    ) -> Dict[str, Any]:
        """
        Create a chunk dictionary from section data.
        
        Args:
            section_title: Section heading
            section_level: Heading level (1-6)
            paragraphs: List of paragraph strings
            document_id: Document ID
            chunk_index: Chunk index in document
            
        Returns:
            Chunk dictionary
        """
        content = "\n\n".join(paragraphs)
        
        # Add section title as context if present
        if section_title:
            content = f"# {section_title}\n\n{content}"
        
        return {
            "id": str(uuid.uuid4()),  # Generate proper UUID
            "document_id": document_id,
            "chunk_index": chunk_index,
            "content": content,
            "metadata": {
                "section_title": section_title,
                "section_level": section_level,
                "chunk_type": "section",
                "char_count": len(content),
                "paragraph_count": len(paragraphs)
            }
        }
