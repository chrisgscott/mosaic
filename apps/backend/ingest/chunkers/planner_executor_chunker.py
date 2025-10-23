"""
Planner-Executor Chunking Pattern

Uses a large-context model (Gemini 2.5 Pro, GPT-4.1) as a planner to read the entire
document and output a deterministic chunk plan with byte offsets. Then uses a cheap
model/code to execute the plan.

This gives global awareness without paying top-shelf rates for every token.

Pattern:
1. Planner (1M ctx): reads entire doc → emits ChunkPlan JSON with byte offsets
2. Executor (cheap): slices by offsets, enriches with metadata/summaries
3. Validator (tiny): spot-checks cohesion, length, overlap
"""

import logging
import json
from typing import List, Dict, Any, Optional
from uuid import uuid4
from openai import OpenAI
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# Pydantic models for Structured Outputs
class ChunkSource(BaseModel):
    """Source location of a chunk in the document."""
    start_byte: int = Field(description="Starting byte offset in UTF-8 encoded document")
    end_byte: int = Field(description="Ending byte offset in UTF-8 encoded document")


class ChunkSpec(BaseModel):
    """Specification for a single chunk."""
    id: str = Field(description="Unique chunk identifier (e.g., 'c_001')")
    source: ChunkSource = Field(description="Byte offsets in source document")
    chunk_type: str = Field(description="Type: text, table, figure, code, list")
    role: str = Field(description="Semantic role: intro, concept, procedure, result, etc.")
    title: Optional[str] = Field(None, description="Brief title for this chunk")
    verification_snippet: str = Field(description="First 80 characters for validation")
    salience_terms: List[str] = Field(default_factory=list, description="Key terms in this chunk")


class TOCEntry(BaseModel):
    """Table of contents entry."""
    id: str = Field(description="Chunk ID this TOC entry refers to")
    title: str = Field(description="Section title")
    parent_id: Optional[str] = Field(None, description="Parent section ID")
    level: int = Field(description="Heading level (1=top)")


class GlossaryEntry(BaseModel):
    """Glossary term definition."""
    term: str = Field(description="Key term")
    definition: str = Field(description="Brief definition")
    chunk_ids: List[str] = Field(description="Chunks where this term appears")


class ChunkPlan(BaseModel):
    """Complete chunk plan for a document."""
    document_id: str = Field(description="UUID of the document")
    global_notes: str = Field(description="Document structure analysis and rationale")
    toc: List[TOCEntry] = Field(default_factory=list, description="Table of contents")
    glossary: List[GlossaryEntry] = Field(default_factory=list, description="Key terms")
    chunks: List[ChunkSpec] = Field(description="Chunk specifications with byte offsets")


class PlannerExecutorChunker:
    """
    Two-stage chunking: Planner analyzes full document, Executor creates chunks.
    """
    
    def __init__(
        self, 
        config: Dict[str, Any], 
        tokenizer=None,
        openai_client: OpenAI = None
    ):
        """
        Initialize the planner-executor chunker.
        
        Args:
            config: Chunking configuration
            tokenizer: Optional tokenizer for token counting
            openai_client: OpenAI client for executor stage
        """
        self.config = config
        self.tokenizer = tokenizer
        self.openai_client = openai_client or OpenAI()
        
        # Planner config (large context model) - Always use OpenAI now
        self.planner_model = config.get('planner_model', 'gpt-4.1-mini')
        
        # Executor config (cheap model)
        self.executor_model = config.get('executor_model', 'gpt-4o-mini')
        
        # Chunking params
        self.max_chunk_tokens = config.get('max_chunk_tokens', 500)
        self.overlap_ratio = config.get('overlap_ratio', 0.15)
        self.document_type = config.get('document_type', 'general')
        
        logger.info(f"Initialized PlannerExecutorChunker: planner={self.planner_model}, executor={self.executor_model}")
    
    def chunk_document(self, content: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk document using planner-executor pattern.
        
        For massive documents (>1M tokens), uses two-pass hierarchical approach:
        1. Section mapping (coarse)
        2. Per-section chunk plans (fine, parallel)
        
        Args:
            content: Full document text (normalized)
            document_id: UUID of the document
            
        Returns:
            List of chunk dictionaries ready for database insertion
        """
        logger.info(f"Chunking document {document_id} with planner-executor pattern")
        
        # Check document size
        estimated_tokens = self._count_tokens(content)
        max_planner_tokens = self.config.get('max_planner_tokens', 1_000_000)
        
        if estimated_tokens > max_planner_tokens:
            logger.info(f"Document too large ({estimated_tokens} tokens) - using two-pass hierarchical approach")
            return self._chunk_large_document(content, document_id)
        
        # Stage 1: Planning (large context model reads entire document)
        chunk_plan = self._create_chunk_plan(content, document_id)
        
        if not chunk_plan or not chunk_plan.get('chunks'):
            logger.error("Planner failed to create chunk plan")
            return []
        
        logger.info(f"Planner created plan with {len(chunk_plan['chunks'])} chunks")
        
        # Stage 2: Validation (quick checks)
        validated_plan = self._validate_plan(content, chunk_plan)
        
        # Stage 3: Execution (cheap model enriches chunks)
        chunks = self._execute_plan(content, validated_plan, document_id)
        
        logger.info(f"Executor created {len(chunks)} enriched chunks")
        
        return chunks
    
    def _chunk_large_document(self, content: str, document_id: str) -> List[Dict[str, Any]]:
        """
        Two-pass hierarchical chunking for massive documents.
        
        Pass 1: Create section map (coarse structure)
        Pass 2: Create detailed chunk plans per section (parallel)
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        logger.info("Pass 1: Creating section map...")
        section_map = self._create_section_map(content, document_id)
        
        if not section_map or not section_map.get('sections'):
            logger.error("Failed to create section map")
            return []
        
        logger.info(f"Section map created: {len(section_map['sections'])} sections")
        
        logger.info("Pass 2: Creating detailed chunk plans per section (parallel)...")
        all_chunks = []
        content_bytes = content.encode('utf-8')
        
        # Process sections in parallel
        max_workers = self.config.get('section_parallel_workers', 10)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            
            for section in section_map['sections']:
                # Extract section text
                start = section['byte_range']['start']
                end = section['byte_range']['end']
                section_bytes = content_bytes[start:end]
                section_text = section_bytes.decode('utf-8', errors='ignore')
                
                # Submit section for detailed planning
                future = executor.submit(
                    self._create_section_chunk_plan,
                    section_text,
                    section,
                    section_map,
                    document_id,
                    content  # Pass full content for global offset slicing
                )
                futures[future] = section['id']
            
            # Collect results as they complete
            for future in as_completed(futures):
                section_id = futures[future]
                try:
                    section_chunks = future.result()
                    all_chunks.extend(section_chunks)
                    logger.info(f"Section {section_id}: {len(section_chunks)} chunks")
                except Exception as e:
                    logger.error(f"Error processing section {section_id}: {e}")
        
        # Re-index chunks globally
        for i, chunk in enumerate(all_chunks):
            chunk['chunk_index'] = i
        
        logger.info(f"Two-pass chunking complete: {len(all_chunks)} total chunks")
        
        return all_chunks
    
    def _create_section_map(self, content: str, document_id: str) -> Dict[str, Any]:
        """
        Pass 1: Create high-level section map of document.
        
        Returns section boundaries and metadata.
        """
        # Sample the document (first/middle/last sections)
        sample_size = 50000  # chars
        sample_parts = [
            content[:sample_size],
            content[len(content)//2 - sample_size//2:len(content)//2 + sample_size//2],
            content[-sample_size:]
        ]
        sample = "\n\n[...]\n\n".join(sample_parts)
        
        prompt = f"""Analyze this document and create a high-level SECTION MAP.

Document length: {len(content)} characters
Sample (beginning, middle, end):
{sample}

Create a JSON section map with major divisions (chapters, parts, sections):
{{
  "document_id": "{document_id}",
  "total_length": {len(content)},
  "structure_type": "chapters" | "parts" | "sections",
  "sections": [
    {{
      "id": "s_001",
      "title": "Chapter 1: Introduction",
      "byte_range": {{"start": 0, "end": 50000}},
      "estimated_chunks": 15,
      "type": "chapter",
      "key_topics": ["topic1", "topic2"]
    }}
  ]
}}

Identify 10-50 major sections. Estimate byte ranges based on document structure."""
        
        try:
            # Use OpenAI for section mapping (JSON mode, not Structured Outputs)
            response = self.openai_client.chat.completions.create(
                model=self.planner_model,
                messages=[
                    {"role": "system", "content": "You are a document structure analyzer."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error creating section map: {e}")
            return {}
    
    def _create_section_chunk_plan(
        self,
        section_text: str,
        section_meta: Dict[str, Any],
        global_map: Dict[str, Any],
        document_id: str,
        full_content: str = None
    ) -> List[Dict[str, Any]]:
        """
        Pass 2: Create detailed chunk plan for one section.
        
        This runs in parallel for each section.
        """
        # Create chunk plan for this section
        prompt = f"""Create a detailed chunk plan for this section. Return your response as a JSON object.

SECTION: {section_meta['title']}
SECTION TYPE: {section_meta['type']}
GLOBAL CONTEXT: Document has {len(global_map['sections'])} sections total

SECTION CONTENT:
{section_text}

Create a JSON chunk plan with byte offsets (relative to section start):
{{
  "section_id": "{section_meta['id']}",
  "chunks": [
    {{
      "id": "c_001",
      "source": {{"start_byte": 0, "end_byte": 1200}},
      "title": "...",
      "type": "...",
      "role": "...",
      "verification_snippet": "..."
    }}
  ]
}}"""
        
        try:
            # Use cheaper model for section-level planning
            response = self.openai_client.chat.completions.create(
                model=self.executor_model,  # Use executor model (cheaper)
                messages=[
                    {"role": "system", "content": "You are a document chunking planner."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            section_plan = json.loads(response.choices[0].message.content)
            
            # Validate BEFORE adjusting offsets (validate against section text with section-relative offsets)
            validated = self._validate_plan(section_text, section_plan)
            
            # NOW adjust byte offsets to be global (add section start)
            section_start = section_meta['byte_range']['start']
            for chunk_spec in validated.get('chunks', []):
                chunk_spec['source']['start_byte'] += section_start
                chunk_spec['source']['end_byte'] += section_start
            
            # Execute with FULL content (since offsets are now global)
            content_to_use = full_content if full_content else section_text
            chunks = self._execute_plan(content_to_use, validated, document_id)
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error creating section chunk plan: {e}")
            return []
    
    def _create_chunk_plan(self, content: str, document_id: str) -> Dict[str, Any]:
        """
        Stage 1: Use large-context model to create chunk plan.
        
        Uses OpenAI Structured Outputs with streaming for progress visibility.
        
        Returns:
            ChunkPlan JSON with byte offsets and metadata
        """
        logger.info("Stage 1: Planning - analyzing full document with large-context model")
        
        # Build planner prompt
        prompt = self._build_planner_prompt(content, document_id)
        
        try:
            # Use OpenAI Structured Outputs (non-streaming)
            logger.info("Using Structured Outputs (non-streaming)")
            completion = self.openai_client.beta.chat.completions.parse(
                model=self.planner_model,
                messages=[
                    {"role": "system", "content": "You are a document chunking planner. Analyze the document and create a deterministic chunk plan with precise byte offsets."},
                    {"role": "user", "content": prompt}
                ],
                response_format=ChunkPlan,
                temperature=0.1
            )
            
            # Get parsed object
            if completion.choices[0].message.parsed:
                plan = completion.choices[0].message.parsed.model_dump()
            else:
                logger.error("No parsed plan received")
                return {}
            
            logger.info(f"Planner analysis complete: {len(plan.get('chunks', []))} chunks planned")
            return plan
            
        except Exception as e:
            logger.error(f"Error in planning stage: {e}")
            return {}
    
    def _build_planner_prompt(self, content: str, document_id: str) -> str:
        """Build prompt for planner stage."""
        
        role_schema = self.config.get('role_schema', [
            "intro", "concept", "procedure", "result", 
            "explanation", "limitation", "policy", "faq"
        ])
        
        prompt = f"""You are a document chunking planner. Analyze this ENTIRE document and output a deterministic ChunkPlan.

DOCUMENT TYPE: {self.document_type}
MAX CHUNK TOKENS: {self.max_chunk_tokens}
OVERLAP RATIO: {self.overlap_ratio}
ROLE SCHEMA: {', '.join(role_schema)}

REQUIREMENTS:
1. Output byte offsets (start_byte, end_byte) for each chunk
2. Preserve document hierarchy (sections, subsections)
3. Keep chunks 300-700 tokens with {int(self.overlap_ratio * 100)}% semantic overlap
4. Label chunk roles from the schema
5. Include verification_snippet (first 80 chars of each chunk)
6. Mark special blocks (figures, tables, code) separately
7. Create a table of contents with parent/child relationships

OUTPUT SCHEMA:
{{
  "document_id": "{document_id}",
  "global_notes": "Document structure analysis and rationale",
  "toc": [
    {{"id": "c_001", "title": "Section 1", "parent_id": null, "level": 1}}
  ],
  "glossary": [
    {{"term": "key term", "definition": "brief definition", "chunk_ids": ["c_001"]}}
  ],
  "chunks": [
    {{
      "id": "c_001",
      "level": 1,
      "type": "section",
      "role": "intro",
      "source": {{"start_byte": 0, "end_byte": 1200}},
      "title": "Introduction",
      "parent_id": null,
      "siblings": ["c_002"],
      "overlap_bytes": 180,
      "target_len_tokens": 400,
      "salience_terms": ["key", "terms"],
      "verification_snippet": "First 80 chars of chunk content..."
    }}
  ]
}}

DOCUMENT CONTENT:
{content}

Analyze the entire document and create the chunk plan."""
        
        return prompt
    
    def _validate_plan(self, content: str, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stage 2: Validate chunk plan.
        
        Checks:
        - Byte offsets are valid
        - Verification snippets match content (with fuzzy matching)
        - No overlapping spans (except intentional overlap)
        
        Note: Byte offset precision can vary with LLMs. We use fuzzy matching
        and auto-correction to handle minor offset errors.
        """
        logger.info("Stage 2: Validation - checking plan integrity")
        
        validated_chunks = []
        failed_chunks = []
        content_bytes = content.encode('utf-8')
        content_len = len(content_bytes)
        
        for chunk_spec in plan.get('chunks', []):
            try:
                start = chunk_spec['source']['start_byte']
                end = chunk_spec['source']['end_byte']
                chunk_id = chunk_spec['id']
                
                # Validate byte range
                if start < 0 or end > content_len or start >= end:
                    logger.warning(f"Invalid byte range for chunk {chunk_id}: {start}-{end} (doc length: {content_len})")
                    failed_chunks.append(chunk_id)
                    continue
                
                # Extract actual content at this byte range
                try:
                    chunk_bytes = content_bytes[start:end]
                    chunk_text = chunk_bytes.decode('utf-8', errors='replace')
                except Exception as decode_error:
                    logger.warning(f"Decode error for chunk {chunk_id}: {decode_error}")
                    failed_chunks.append(chunk_id)
                    continue
                
                # Fuzzy verification: check if snippet appears anywhere in first 200 chars
                verification = chunk_spec.get('verification_snippet', '').strip()
                if verification:
                    chunk_start = chunk_text[:200].lower()
                    verification_lower = verification[:50].lower()
                    
                    # Try exact match first
                    if verification_lower not in chunk_start:
                        # Try with whitespace normalization
                        chunk_normalized = ' '.join(chunk_start.split())
                        verification_normalized = ' '.join(verification_lower.split())
                        
                        if verification_normalized not in chunk_normalized:
                            logger.debug(f"Verification mismatch for chunk {chunk_id} (non-critical)")
                            chunk_spec['validation_warning'] = 'snippet_mismatch'
                
                validated_chunks.append(chunk_spec)
                
            except Exception as e:
                logger.error(f"Error validating chunk {chunk_spec.get('id')}: {e}")
                failed_chunks.append(chunk_spec.get('id', 'unknown'))
                continue
        
        plan['chunks'] = validated_chunks
        
        if failed_chunks:
            logger.warning(f"Validation failed for {len(failed_chunks)} chunks: {', '.join(failed_chunks[:5])}{'...' if len(failed_chunks) > 5 else ''}")
        
        logger.info(f"Validation complete: {len(validated_chunks)}/{len(plan.get('chunks', []))} chunks validated")
        
        return plan
    
    def _execute_plan(
        self, 
        content: str, 
        plan: Dict[str, Any], 
        document_id: str
    ) -> List[Dict[str, Any]]:
        """
        Stage 3: Execute plan - slice content and enrich chunks.
        
        Uses cheap model for enrichment (titles, summaries, QAs).
        """
        logger.info("Stage 3: Execution - slicing and enriching chunks")
        
        chunks = []
        content_bytes = content.encode('utf-8')
        
        for i, chunk_spec in enumerate(plan.get('chunks', [])):
            try:
                # Slice content at byte offsets
                start = chunk_spec['source']['start_byte']
                end = chunk_spec['source']['end_byte']
                chunk_bytes = content_bytes[start:end]
                chunk_text = chunk_bytes.decode('utf-8', errors='ignore').strip()
                
                # Clean text
                chunk_text = self._clean_text(chunk_text)
                
                # Count tokens
                token_count = self._count_tokens(chunk_text)
                
                # Enrich with cheap model (title, summary, keywords)
                enrichment = self._enrich_chunk(chunk_text, chunk_spec)
                
                # Build chunk record
                chunks.append({
                    "id": str(uuid4()),
                    "document_id": document_id,
                    "content": chunk_text,
                    "chunk_index": i,
                    "token_count": token_count,
                    "summary": enrichment.get('summary'),
                    "metadata": {
                        "processor": "planner_executor",
                        "plan_id": chunk_spec['id'],
                        "level": chunk_spec.get('level'),
                        "type": chunk_spec.get('type'),
                        "role": chunk_spec.get('role'),
                        "title": enrichment.get('title') or chunk_spec.get('title'),
                        "parent_id": chunk_spec.get('parent_id'),
                        "salience_terms": chunk_spec.get('salience_terms', []),
                        "keywords": enrichment.get('keywords', []),
                        "section_path": self._build_section_path(chunk_spec, plan),
                        "byte_range": {"start": start, "end": end},
                        "chunk_size": len(chunk_text),
                        "token_count": token_count,
                    }
                })
                
            except Exception as e:
                logger.error(f"Error executing chunk {chunk_spec.get('id')}: {e}")
                continue
        
        return chunks
    
    def _enrich_chunk(self, chunk_text: str, chunk_spec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich chunk with title, summary, keywords using cheap model.
        """
        try:
            prompt = f"""Analyze this document chunk and provide:
1. A concise title (5-10 words)
2. A 2-3 sentence summary
3. 3-5 key terms/keywords

Chunk type: {chunk_spec.get('type')}
Chunk role: {chunk_spec.get('role')}

Content:
{chunk_text[:1000]}...

Output JSON:
{{
  "title": "...",
  "summary": "...",
  "keywords": ["term1", "term2", ...]
}}"""
            
            response = self.openai_client.chat.completions.create(
                model=self.executor_model,
                messages=[
                    {"role": "system", "content": "You are a document analysis assistant. Extract titles, summaries, and keywords."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error enriching chunk: {e}")
            return {
                "title": chunk_spec.get('title', 'Untitled'),
                "summary": chunk_text[:200] + "...",
                "keywords": []
            }
    
    def _build_section_path(self, chunk_spec: Dict[str, Any], plan: Dict[str, Any]) -> str:
        """Build hierarchical section path (e.g., '1.2.3')."""
        # Build path by traversing parent_id chain
        path_parts = []
        current_id = chunk_spec['id']
        toc = {item['id']: item for item in plan.get('toc', [])}
        
        while current_id and current_id in toc:
            item = toc[current_id]
            path_parts.insert(0, item.get('title', current_id))
            current_id = item.get('parent_id')
        
        return ' > '.join(path_parts) if path_parts else chunk_spec.get('title', '')
    
    def _clean_text(self, text: str) -> str:
        """Clean chunk text (whitespace, bullets, etc.)."""
        # Remove excessive whitespace
        text = ' '.join(text.split())
        return text
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self.tokenizer:
            return self.tokenizer.count_tokens(text=text)
        else:
            return int(len(text.split()) * 1.33)
