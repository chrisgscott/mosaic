"""
Agentic Chunker - Uses LLM to intelligently identify semantic chunk boundaries.

Instead of rigid pattern matching, this chunker:
1. Analyzes document structure semantically
2. Identifies logical boundaries (cards, topics, concepts)
3. Creates chunks that preserve semantic coherence

Perfect for documents with:
- Variable structure (different card types)
- Contextual headings (Purpose, Identify, Connect, etc.)
- Complex layouts (multi-column, mixed content)
"""

import logging
import json
from typing import List, Dict, Any, Optional
from uuid import uuid4
from openai import OpenAI

logger = logging.getLogger(__name__)


class AgenticChunker:
    """
    Uses LLM to analyze document structure and create semantically coherent chunks.
    """
    
    def __init__(self, config: Dict[str, Any], tokenizer=None, openai_client: OpenAI = None):
        """
        Initialize the agentic chunker.
        
        Args:
            config: Chunking configuration
            tokenizer: Optional tokenizer for token counting
            openai_client: OpenAI client for LLM calls
        """
        self.config = config
        self.tokenizer = tokenizer
        self.openai_client = openai_client or OpenAI()
        
        # Get model from config or use default
        self.model = config.get('model', 'gpt-4o-mini')
        self.max_chunk_tokens = config.get('max_chunk_tokens', 512)
        self.chunk_overlap = config.get('chunk_overlap', 50)
        
        # Document-specific instructions
        self.document_type = config.get('document_type', 'general')
        self.chunking_instructions = config.get('instructions', self._get_default_instructions())
        
        logger.info(f"Initialized AgenticChunker with model={self.model}")
    
    def _get_default_instructions(self) -> str:
        """Get default chunking instructions based on document type."""
        
        if self.document_type == 'card_deck':
            return """
This is a card deck document where each card represents a complete concept or tactic.
Each card typically has:
- A category label (e.g., "Purpose", "Recipe", "Identify")
- A title
- A description
- Steps or details
- A footer/attribution

Your task: Identify the boundaries of each card so that each card becomes a single chunk.
Cards should be kept together as complete semantic units.
"""
        
        return """
Analyze this document and identify natural semantic boundaries where chunks should be split.
Consider:
- Topic changes
- Section boundaries
- Conceptual completeness
- Logical groupings

Create chunks that are semantically coherent and self-contained.
"""
    
    def chunk_document(self, content: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk document using LLM to identify semantic boundaries.
        
        Args:
            content: Full document text
            document_id: UUID of the document
            
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        logger.info(f"Chunking document {document_id} with AgenticChunker")
        
        # Step 1: Analyze document structure
        structure = self._analyze_structure(content)
        
        # Step 2: Identify chunk boundaries
        boundaries = self._identify_boundaries(content, structure)
        
        # Step 3: Extract chunks based on boundaries
        chunks = self._extract_chunks(content, boundaries, document_id)
        
        logger.info(f"Created {len(chunks)} chunks using agentic analysis")
        
        return chunks
    
    def _analyze_structure(self, content: str) -> Dict[str, Any]:
        """
        Use LLM to analyze document structure.
        
        Returns:
            Structure analysis including document type, sections, patterns
        """
        logger.info("Analyzing document structure with LLM...")
        
        prompt = f"""Analyze the structure of this document and identify its organizational patterns.

Document:
{content[:3000]}... [truncated]

Provide a JSON response with:
{{
  "document_type": "card_deck" | "article" | "manual" | "reference" | "other",
  "primary_structure": "cards" | "chapters" | "sections" | "paragraphs",
  "repeating_patterns": ["pattern1", "pattern2"],
  "section_markers": ["marker1", "marker2"],
  "notes": "Any observations about the structure"
}}
"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a document structure analyst. Analyze documents and identify their organizational patterns."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            structure = json.loads(response.choices[0].message.content)
            logger.info(f"Document structure: {structure.get('document_type')} with {structure.get('primary_structure')}")
            
            return structure
            
        except Exception as e:
            logger.error(f"Error analyzing structure: {e}")
            return {
                "document_type": "unknown",
                "primary_structure": "paragraphs",
                "repeating_patterns": [],
                "section_markers": []
            }
    
    def _identify_boundaries(self, content: str, structure: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Use LLM to identify chunk boundaries in the document.
        
        Returns:
            List of boundary positions with metadata
        """
        logger.info("Identifying chunk boundaries with LLM...")
        
        # Split content into manageable segments for analysis
        segments = self._split_into_segments(content, max_chars=4000)
        
        all_boundaries = []
        cumulative_offset = 0
        
        for i, segment in enumerate(segments):
            logger.debug(f"Analyzing segment {i+1}/{len(segments)}")
            
            prompt = f"""{self.chunking_instructions}

Document segment:
{segment}

Identify the positions where chunks should be split. For each boundary, provide:
- The approximate character position (0-indexed from start of this segment)
- A brief description of what's at that boundary
- The type of boundary (e.g., "card_start", "topic_change", "section_break")

Provide a JSON object with a "boundaries" array:
{{
  "boundaries": [
    {{
      "position": 0,
      "description": "Start of 'Default Disaster' card",
      "boundary_type": "card_start"
    }},
    {{
      "position": 450,
      "description": "Start of 'Better Now' card",
      "boundary_type": "card_start"
    }}
  ]
}}
"""
            
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a document chunking expert. Identify semantic boundaries where documents should be split into chunks."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                
                result = json.loads(response.choices[0].message.content)
                boundaries = result.get('boundaries', [])
                
                # Adjust positions for cumulative offset
                for boundary in boundaries:
                    boundary['position'] += cumulative_offset
                    all_boundaries.append(boundary)
                
                cumulative_offset += len(segment)
                
            except Exception as e:
                logger.error(f"Error identifying boundaries in segment {i}: {e}")
                continue
        
        logger.info(f"Identified {len(all_boundaries)} chunk boundaries")
        
        return all_boundaries
    
    def _extract_chunks(
        self, 
        content: str, 
        boundaries: List[Dict[str, Any]], 
        document_id: str
    ) -> List[Dict[str, Any]]:
        """
        Extract chunks based on identified boundaries.
        
        Args:
            content: Full document text
            boundaries: List of boundary positions
            document_id: UUID of the document
            
        Returns:
            List of chunk dictionaries
        """
        chunks = []
        
        # Sort boundaries by position
        sorted_boundaries = sorted(boundaries, key=lambda x: x['position'])
        
        # Add start and end boundaries if not present
        if not sorted_boundaries or sorted_boundaries[0]['position'] > 0:
            sorted_boundaries.insert(0, {
                'position': 0,
                'description': 'Document start',
                'boundary_type': 'start'
            })
        
        if not sorted_boundaries or sorted_boundaries[-1]['position'] < len(content):
            sorted_boundaries.append({
                'position': len(content),
                'description': 'Document end',
                'boundary_type': 'end'
            })
        
        # Extract chunks between boundaries
        for i in range(len(sorted_boundaries) - 1):
            start_boundary = sorted_boundaries[i]
            end_boundary = sorted_boundaries[i + 1]
            
            start_pos = start_boundary['position']
            end_pos = end_boundary['position']
            
            chunk_text = content[start_pos:end_pos].strip()
            
            if not chunk_text:
                continue
            
            token_count = self._count_tokens(chunk_text)
            
            # If chunk is too large, split it further
            if token_count > self.max_chunk_tokens:
                sub_chunks = self._split_large_chunk(chunk_text)
                for j, sub_chunk_text in enumerate(sub_chunks):
                    sub_token_count = self._count_tokens(sub_chunk_text)
                    chunks.append({
                        "id": str(uuid4()),
                        "document_id": document_id,
                        "content": sub_chunk_text.strip(),
                        "chunk_index": len(chunks),
                        "token_count": sub_token_count,
                        "summary": None,
                        "metadata": {
                            "processor": "agentic",
                            "boundary_type": start_boundary.get('boundary_type', 'unknown'),
                            "boundary_description": start_boundary.get('description', ''),
                            "is_subsection": True,
                            "subsection_index": j,
                            "chunk_size": len(sub_chunk_text),
                            "token_count": sub_token_count,
                        }
                    })
            else:
                chunks.append({
                    "id": str(uuid4()),
                    "document_id": document_id,
                    "content": chunk_text,
                    "chunk_index": len(chunks),
                    "token_count": token_count,
                    "summary": None,
                    "metadata": {
                        "processor": "agentic",
                        "boundary_type": start_boundary.get('boundary_type', 'unknown'),
                        "boundary_description": start_boundary.get('description', ''),
                        "chunk_size": len(chunk_text),
                        "token_count": token_count,
                    }
                })
        
        return chunks
    
    def _split_into_segments(self, content: str, max_chars: int = 4000) -> List[str]:
        """
        Split content into segments for analysis.
        
        Args:
            content: Full document text
            max_chars: Maximum characters per segment
            
        Returns:
            List of content segments
        """
        if len(content) <= max_chars:
            return [content]
        
        segments = []
        current_pos = 0
        
        while current_pos < len(content):
            end_pos = min(current_pos + max_chars, len(content))
            
            # Try to break at paragraph boundary
            if end_pos < len(content):
                last_para = content[current_pos:end_pos].rfind('\n\n')
                if last_para > max_chars * 0.7:  # At least 70% of max
                    end_pos = current_pos + last_para
            
            segments.append(content[current_pos:end_pos])
            current_pos = end_pos
        
        return segments
    
    def _split_large_chunk(self, text: str) -> List[str]:
        """
        Split a large chunk into smaller pieces at paragraph boundaries.
        """
        chunks = []
        paragraphs = text.split('\n\n')
        
        current_chunk = []
        current_tokens = 0
        
        for para in paragraphs:
            para_tokens = self._count_tokens(para)
            
            if current_tokens + para_tokens > self.max_chunk_tokens and current_chunk:
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = [para]
                current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens
        
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        return chunks
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self.tokenizer:
            return self.tokenizer.count_tokens(text=text)
        else:
            # Rough estimate
            return int(len(text.split()) * 1.33)
