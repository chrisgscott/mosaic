"""
Structure-Aware Chunker

Simple chunker that respects Docling's natural document structure.
Optional LLM calls for table summarization to improve retrieval.

Philosophy:
- Docling already parsed the document structure
- Use sections, paragraphs, and tables as natural boundaries
- Tables are kept atomic (never split mid-table)
- Tables get natural language summaries for better retrieval
- Split large sections, merge small ones
- Breadcrumb headers provide hierarchical context
- Fast, deterministic, mostly free (table summaries optional)
"""

from typing import List, Dict, Any, Optional
import logging
import uuid
import tiktoken

from .table_summarizer import TableSummarizer

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
    
    def __init__(
        self, 
        target_size: int = 1000, 
        min_size: int = 300, 
        max_size: int = 2000,
        summarize_tables: bool = True,
        table_summary_model: str = "gpt-4o-mini"
    ):
        """
        Initialize chunker with size parameters.
        
        Args:
            target_size: Target chunk size in characters (default: 1000)
            min_size: Minimum chunk size (default: 300)
            max_size: Maximum chunk size before forced split (default: 2000)
            summarize_tables: Whether to generate natural language summaries for tables (default: True)
            table_summary_model: Model to use for table summarization (default: gpt-4o-mini)
        """
        self.target_size = target_size
        self.min_size = min_size
        self.max_size = max_size
        self.tokenizer = tiktoken.get_encoding("cl100k_base")  # For token counting
        
        # Track heading hierarchy for breadcrumbs (level -> title)
        self.heading_stack: List[Dict[str, Any]] = []
        
        # Table summarizer for improved retrieval
        self.table_summarizer = TableSummarizer(
            model=table_summary_model,
            enabled=summarize_tables
        )
        
        logger.info(f"StructureAwareChunker initialized (target={target_size}, min={min_size}, max={max_size}, summarize_tables={summarize_tables})")
    
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
        in_table = False
        table_lines = []
        table_header = None  # Store header row for potential splitting
        
        for line in lines:
            # Detect section headers
            if line.startswith('#'):
                # Flush any in-progress table
                if table_lines:
                    table_text = '\n'.join(table_lines)
                    current_section["paragraphs"].append(("table", table_text, len(table_lines) - 2))  # -2 for header and separator
                    table_lines = []
                    table_header = None
                    in_table = False
                
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
            
            # Detect table markers - accumulate entire table as atomic unit
            elif line.startswith('|') and '|' in line[1:]:
                # Flush current paragraph before starting table
                if current_para and not in_table:
                    para_text = '\n'.join(current_para).strip()
                    if para_text:
                        current_section["paragraphs"].append(para_text)
                    current_para = []
                
                in_table = True
                table_lines.append(line)
                
                # Capture header row (first row of table)
                if table_header is None and not line.startswith('|-'):
                    table_header = line
            
            # End of table - non-table line encountered
            elif in_table:
                # Flush the complete table as atomic unit
                if table_lines:
                    table_text = '\n'.join(table_lines)
                    # Store as tuple: ("table", content, row_count) for metadata
                    row_count = sum(1 for l in table_lines if l.startswith('|') and not l.startswith('|-'))
                    current_section["paragraphs"].append(("table", table_text, row_count - 1))  # -1 for header
                    table_lines = []
                    table_header = None
                in_table = False
                
                # Process the current line normally
                if line.strip():
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
        
        # Flush any remaining table
        if table_lines:
            table_text = '\n'.join(table_lines)
            row_count = sum(1 for l in table_lines if l.startswith('|') and not l.startswith('|-'))
            current_section["paragraphs"].append(("table", table_text, row_count - 1))
        
        # Flush final paragraph
        if current_para:
            para_text = '\n'.join(current_para).strip()
            if para_text:
                current_section["paragraphs"].append(para_text)
        
        # Flush final section
        if current_section["paragraphs"]:
            chunks.extend(self._chunk_section(current_section, document_id, len(chunks)))
        
        # Count tables across all chunks
        total_tables = sum(c["metadata"].get("table_count", 0) for c in chunks)
        chunks_with_tables = sum(1 for c in chunks if c["metadata"].get("has_table", False))
        tables_with_summaries = sum(1 for c in chunks if c["metadata"].get("has_table_summary", False))
        
        logger.info(f"Created {len(chunks)} chunks from document structure")
        if total_tables > 0:
            logger.info(f"Tables: {total_tables} tables in {chunks_with_tables} chunks (kept atomic)")
            if tables_with_summaries > 0:
                logger.info(f"Table summaries: {tables_with_summaries} tables summarized for improved retrieval")
        return chunks
    
    def _chunk_section(self, section: Dict[str, Any], document_id: str, start_index: int) -> List[Dict[str, Any]]:
        """
        Chunk a section based on size constraints.
        
        Tables are kept atomic - they are never split across chunks.
        If a table is too large, it gets its own chunk (even if over max_size).
        
        Args:
            section: Section dictionary with title, level, paragraphs, breadcrumb
            document_id: Document ID
            start_index: Starting chunk index
            
        Returns:
            List of chunks for this section
        """
        chunks = []
        current_chunk_paras = []
        current_chunk_tables = 0  # Track number of tables in current chunk
        current_size = 0
        breadcrumb = section.get("breadcrumb", "")
        
        for para in section["paragraphs"]:
            # Check if this is a table tuple: ("table", content, row_count)
            is_table = isinstance(para, tuple) and len(para) == 3 and para[0] == "table"
            
            if is_table:
                table_content = para[1]
                table_row_count = para[2]
                
                # Generate table summary for improved retrieval
                table_summary = self.table_summarizer.summarize_table(
                    table_content,
                    context=breadcrumb or section.get("title", "")
                )
                
                # Format table with summary prepended
                formatted_table = self.table_summarizer.format_chunk_with_summary(
                    table_content, 
                    table_summary
                )
                para_size = len(formatted_table)
                
                # Tables are atomic - if we have content, flush it first
                if current_chunk_paras and current_size + para_size > self.target_size:
                    chunks.append(self._create_chunk(
                        section["title"],
                        section["level"],
                        current_chunk_paras,
                        document_id,
                        start_index + len(chunks),
                        breadcrumb,
                        table_count=current_chunk_tables
                    ))
                    current_chunk_paras = []
                    current_chunk_tables = 0
                    current_size = 0
                
                # Add table (with summary) to current chunk
                current_chunk_paras.append(formatted_table)
                current_chunk_tables += 1
                current_size += para_size
                
                # If table alone exceeds max_size, flush it as its own chunk
                if para_size > self.max_size:
                    chunks.append(self._create_chunk(
                        section["title"],
                        section["level"],
                        current_chunk_paras,
                        document_id,
                        start_index + len(chunks),
                        breadcrumb,
                        table_count=current_chunk_tables,
                        table_row_count=table_row_count,
                        has_table_summary=table_summary is not None
                    ))
                    current_chunk_paras = []
                    current_chunk_tables = 0
                    current_size = 0
            else:
                # Regular paragraph
                para_size = len(para)
                
                # If adding this paragraph exceeds max_size, flush current chunk
                if current_size + para_size > self.max_size and current_chunk_paras:
                    chunks.append(self._create_chunk(
                        section["title"],
                        section["level"],
                        current_chunk_paras,
                        document_id,
                        start_index + len(chunks),
                        breadcrumb,
                        table_count=current_chunk_tables
                    ))
                    current_chunk_paras = [para]
                    current_chunk_tables = 0
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
                        breadcrumb,
                        table_count=current_chunk_tables
                    ))
                    current_chunk_paras = []
                    current_chunk_tables = 0
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
                last_chunk["metadata"]["table_count"] = last_chunk["metadata"].get("table_count", 0) + current_chunk_tables
            else:
                chunks.append(self._create_chunk(
                    section["title"],
                    section["level"],
                    current_chunk_paras,
                    document_id,
                    start_index + len(chunks),
                    breadcrumb,
                    table_count=current_chunk_tables
                ))
        
        return chunks
    
    def _create_chunk(
        self,
        section_title: str,
        section_level: int,
        paragraphs: List[str],
        document_id: str,
        chunk_index: int,
        breadcrumb: str = "",
        table_count: int = 0,
        table_row_count: Optional[int] = None,
        has_table_summary: bool = False
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
            table_count: Number of tables in this chunk
            table_row_count: Row count if chunk is a single large table
            has_table_summary: Whether the table has an LLM-generated summary
            
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
        
        # Build metadata
        metadata = {
            "section_title": section_title,
            "section_level": section_level,
            "breadcrumb": breadcrumb,
            "chunk_type": "section",
            "char_count": len(content),
            "paragraph_count": len(paragraphs)
        }
        
        # Add table metadata if present
        if table_count > 0:
            metadata["has_table"] = True
            metadata["table_count"] = table_count
            metadata["has_table_summary"] = has_table_summary
        if table_row_count is not None:
            metadata["table_row_count"] = table_row_count
        
        return {
            "id": str(uuid.uuid4()),
            "document_id": document_id,
            "chunk_index": chunk_index,
            "content": content,
            "token_count": token_count,
            "metadata": metadata
        }
