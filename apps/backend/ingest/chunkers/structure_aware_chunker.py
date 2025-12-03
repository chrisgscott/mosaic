"""
Structure-Aware Chunker

Simple chunker that respects Docling's natural document structure.
No LLM calls, no byte offsets, no complexity.

Philosophy:
- Docling already parsed the document structure
- Use sections, paragraphs, and tables as natural boundaries
- Split large sections, merge small ones
- Breadcrumb headers provide hierarchical context
- Fast, deterministic, free
"""

from typing import List, Dict, Any, Optional
import logging
import uuid
import tiktoken

logger = logging.getLogger(__name__)


class StructureAwareChunker:
    """
    Simple chunker that uses Docling's document structure.
    
    Strategy:
    1. Iterate through Docling's structured elements
    2. Track heading hierarchy for breadcrumb context
    3. Group paragraphs into sections
    4. Chunk when section reaches target size
    5. Prepend breadcrumb headers to each chunk for context
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
        self.tokenizer = tiktoken.get_encoding("cl100k_base")  # For token counting
        
        # Track heading hierarchy for breadcrumbs (level -> title)
        self.heading_stack: List[Dict[str, Any]] = []
        
        logger.info(f"StructureAwareChunker initialized (target={target_size}, min={min_size}, max={max_size})")
    
    def _update_heading_stack(self, level: int, title: str) -> None:
        """
        Update the heading stack when a new heading is encountered.
        
        Maintains a stack of headings where each level replaces all deeper levels.
        Example: If we see H2, we keep H1 but replace any existing H2+ headings.
        
        Args:
            level: Heading level (1-6)
            title: Heading text
        """
        # Remove all headings at this level or deeper
        self.heading_stack = [h for h in self.heading_stack if h["level"] < level]
        # Add the new heading
        self.heading_stack.append({"level": level, "title": title})
    
    def _get_breadcrumb(self) -> str:
        """
        Generate breadcrumb header string from current heading stack.
        
        Returns:
            Markdown-formatted breadcrumb headers, e.g.:
            "# Chapter 1\n## Section 1.2\n### Subsection 1.2.1"
        """
        if not self.heading_stack:
            return ""
        
        breadcrumb_lines = []
        for heading in self.heading_stack:
            prefix = "#" * heading["level"]
            breadcrumb_lines.append(f"{prefix} {heading['title']}")
        
        return "\n".join(breadcrumb_lines)
    
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
            "paragraphs": [],
            "breadcrumb": ""
        }
        
        # Reset heading stack for this document
        self.heading_stack = []
        
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
                
                # Parse new heading
                level = len(line) - len(line.lstrip('#'))
                title = line.lstrip('#').strip()
                
                # Update heading stack for breadcrumb tracking
                self._update_heading_stack(level, title)
                
                # Start new section with current breadcrumb
                current_section = {
                    "title": title,
                    "level": level,
                    "paragraphs": [],
                    "breadcrumb": self._get_breadcrumb()
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
            section: Section dictionary with title, level, paragraphs, breadcrumb
            document_id: Document ID
            start_index: Starting chunk index
            
        Returns:
            List of chunks for this section
        """
        chunks = []
        current_chunk_paras = []
        current_size = 0
        breadcrumb = section.get("breadcrumb", "")
        
        for para in section["paragraphs"]:
            para_size = len(para)
            
            # If adding this paragraph exceeds max_size, flush current chunk
            if current_size + para_size > self.max_size and current_chunk_paras:
                chunks.append(self._create_chunk(
                    section["title"],
                    section["level"],
                    current_chunk_paras,
                    document_id,
                    start_index + len(chunks),
                    breadcrumb
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
                    start_index + len(chunks),
                    breadcrumb
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
                    start_index + len(chunks),
                    breadcrumb
                ))
        
        return chunks
    
    def _create_chunk(
        self,
        section_title: str,
        section_level: int,
        paragraphs: List[str],
        document_id: str,
        chunk_index: int,
        breadcrumb: str = ""
    ) -> Dict[str, Any]:
        """
        Create a chunk dictionary from section data.
        
        Args:
            section_title: Section heading (immediate parent)
            section_level: Heading level (1-6)
            paragraphs: List of paragraph strings
            document_id: Document ID
            chunk_index: Chunk index in document
            breadcrumb: Full heading hierarchy (e.g., "# Ch1\n## Sec1.2\n### Sub1.2.1")
            
        Returns:
            Chunk dictionary
        """
        content = "\n\n".join(paragraphs)
        
        # Add breadcrumb headers for hierarchical context
        # This gives the LLM full structural awareness
        if breadcrumb:
            content = f"{breadcrumb}\n\n{content}"
        elif section_title:
            # Fallback: just use section title if no breadcrumb
            content = f"# {section_title}\n\n{content}"
        
        # Calculate token count
        token_count = len(self.tokenizer.encode(content))
        
        return {
            "id": str(uuid.uuid4()),  # Generate proper UUID
            "document_id": document_id,
            "chunk_index": chunk_index,
            "content": content,
            "token_count": token_count,  # Add required token_count field
            "metadata": {
                "section_title": section_title,
                "section_level": section_level,
                "breadcrumb": breadcrumb,  # Store breadcrumb in metadata too
                "chunk_type": "section",
                "char_count": len(content),
                "paragraph_count": len(paragraphs)
            }
        }
