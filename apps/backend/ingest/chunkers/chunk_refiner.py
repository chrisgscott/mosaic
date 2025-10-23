"""
Chunk Refiner - Post-processing optimization of chunks

Analyzes chunks after initial chunking and refines them by:
- Merging chunks that are semantically incomplete
- Splitting chunks that contain multiple concepts
- Adjusting boundaries for better coherence

This happens BEFORE embeddings/summaries/graph extraction, so downstream
work only happens once on good chunks.
"""

import logging
import json
from typing import List, Dict, Any, Tuple, Optional
from uuid import uuid4
from openai import OpenAI

logger = logging.getLogger(__name__)


class ChunkRefiner:
    """
    Refines chunks after initial chunking but before downstream processing.
    """
    
    def __init__(
        self, 
        openai_client: OpenAI = None, 
        model: str = "gpt-4o-mini",
        refinement_neighbors: int = 2
    ):
        """
        Initialize the chunk refiner.
        
        Args:
            openai_client: OpenAI client for analysis
            model: Model to use for refinement decisions
            refinement_neighbors: Number of neighboring chunks to analyze (like summary_neighbors)
        """
        self.openai_client = openai_client or OpenAI()
        self.model = model
        self.refinement_neighbors = refinement_neighbors
        
        logger.info(f"Initialized ChunkRefiner with model={self.model}, neighbors={self.refinement_neighbors}")
    
    def refine(
        self, 
        chunks: List[Dict[str, Any]], 
        document_context: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Refine chunks by analyzing semantic boundaries.
        
        Args:
            chunks: Initial chunks from chunker
            document_context: Optional context about document type/purpose
            
        Returns:
            Tuple of (refined_chunks, refinement_report)
        """
        if len(chunks) == 0:
            return [], {"status": "no_chunks"}
        
        logger.info(f"🔄 Refining {len(chunks)} initial chunks...")
        
        # Analyze chunks in batches for efficiency
        refinement_plan = self._analyze_chunks(chunks, document_context)
        
        # Apply refinements
        refined_chunks = self._apply_refinements(chunks, refinement_plan)
        
        # Generate report
        report = {
            "original_count": len(chunks),
            "refined_count": len(refined_chunks),
            "merges": len(refinement_plan.get('merges', [])),
            "splits": len(refinement_plan.get('splits', [])),
            "unchanged": len(chunks) - len(refinement_plan.get('merges', [])) - len(refinement_plan.get('splits', []))
        }
        
        logger.info(f"🔄 Refinement complete: {len(chunks)} → {len(refined_chunks)} chunks")
        logger.info(f"   Merges: {report['merges']}, Splits: {report['splits']}, Unchanged: {report['unchanged']}")
        
        return refined_chunks, report
    
    def _analyze_chunks(
        self, 
        chunks: List[Dict[str, Any]], 
        document_context: Optional[str]
    ) -> Dict[str, Any]:
        """
        Analyze chunks using neighbor context (same pattern as summary generation).
        
        For each chunk, looks at N neighbors before/after to determine:
        - Should it merge with previous chunk? (incomplete concept)
        - Should it merge with next chunk? (split mid-thought)
        - Should it be split? (multiple concepts)
        - Is it good as-is?
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        merge_candidates = []
        split_candidates = []
        
        # Analyze chunks in parallel with neighbor context
        max_workers = 10
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}
            
            for i, chunk in enumerate(chunks):
                # Get neighbors (same pattern as summary generation)
                start_idx = max(0, i - self.refinement_neighbors)
                end_idx = min(len(chunks), i + self.refinement_neighbors + 1)
                
                previous_chunks = [chunks[j] for j in range(start_idx, i)]
                next_chunks = [chunks[j] for j in range(i + 1, end_idx)]
                
                # Submit analysis task
                future = executor.submit(
                    self._analyze_chunk_with_neighbors,
                    chunk,
                    i,
                    previous_chunks,
                    next_chunks,
                    document_context
                )
                futures[future] = i
            
            # Collect results
            for future in as_completed(futures):
                chunk_idx = futures[future]
                try:
                    analysis = future.result()
                    
                    if analysis.get('should_merge_with_next'):
                        merge_candidates.append({
                            'start_index': chunk_idx,
                            'end_index': chunk_idx + 1,
                            'reason': analysis['merge_reason']
                        })
                    
                    if analysis.get('should_split'):
                        split_candidates.append({
                            'index': chunk_idx,
                            'split_points': analysis.get('split_points', []),
                            'reason': analysis['split_reason']
                        })
                        
                except Exception as e:
                    logger.error(f"Error analyzing chunk {chunk_idx}: {e}")
        
        return {
            'merges': merge_candidates,
            'splits': split_candidates
        }
    
    def _analyze_chunk_with_neighbors(
        self,
        chunk: Dict[str, Any],
        chunk_idx: int,
        previous_chunks: List[Dict[str, Any]],
        next_chunks: List[Dict[str, Any]],
        document_context: Optional[str]
    ) -> Dict[str, Any]:
        """
        Analyze a single chunk with its neighbors (same pattern as summary generation).
        
        Returns analysis with merge/split recommendations.
        """
        # Build context (same structure as summary generation)
        context_parts = []
        
        if previous_chunks:
            prev_text = "\n\n".join([c['content'][:300] + "..." for c in previous_chunks])
            context_parts.append(f"[PRECEDING CHUNKS - FOR CONTEXT]:\n{prev_text}")
        
        current_preview = chunk['content'][:500] + ("..." if len(chunk['content']) > 500 else "")
        context_parts.append(f"[CURRENT CHUNK - ANALYZE THIS]:\n{current_preview}")
        
        if next_chunks:
            next_text = "\n\n".join([c['content'][:300] + "..." for c in next_chunks])
            context_parts.append(f"[FOLLOWING CHUNKS - FOR CONTEXT]:\n{next_text}")
        
        full_context = "\n\n---\n\n".join(context_parts)
        
        prompt = f"""Analyze this chunk and its neighbors to determine if refinement is needed.

DOCUMENT CONTEXT: {document_context or 'General document'}

{full_context}

Determine:
1. Should CURRENT merge with NEXT chunk? (incomplete thought, split mid-sentence)
2. Should CURRENT be split? (multiple distinct concepts, >800 tokens with natural break)
3. Is CURRENT good as-is?

Output JSON:
{{
  "should_merge_with_next": true | false,
  "merge_reason": "Reason if merging",
  "should_split": true | false,
  "split_reason": "Reason if splitting",
  "split_points": ["Description of where to split"],
  "is_good": true | false
}}

Guidelines:
- Merge if: ends mid-sentence, incomplete concept, same topic continues in next
- Split if: multiple topics, clear shift, >800 tokens with paragraph break
- Good if: complete concept, single topic, appropriate size"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a chunk refinement analyst. Determine if chunks need merging or splitting."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error analyzing chunk with neighbors: {e}")
            return {'should_merge_with_next': False, 'should_split': False, 'is_good': True}
    
    def _analyze_batch(
        self, 
        batch: List[Dict[str, Any]], 
        document_context: Optional[str]
    ) -> Dict[str, Any]:
        """
        Analyze a batch of chunks for refinement opportunities.
        """
        # Build context for analysis
        chunk_summaries = []
        for i, chunk in enumerate(batch):
            chunk_summaries.append({
                'index': i,
                'preview': chunk['content'][:200] + "..." if len(chunk['content']) > 200 else chunk['content'],
                'token_count': chunk.get('token_count', 0)
            })
        
        prompt = f"""Analyze these chunks and identify refinement opportunities.

DOCUMENT CONTEXT: {document_context or 'General document'}

CHUNKS:
{json.dumps(chunk_summaries, indent=2)}

Identify:
1. **Merges**: Adjacent chunks that should be combined (incomplete concepts, split mid-thought)
2. **Splits**: Chunks containing multiple distinct concepts that should be separated

Output JSON:
{{
  "merges": [
    {{
      "start_index": 0,
      "end_index": 1,
      "reason": "Chunk 0 ends mid-sentence, chunk 1 completes the thought"
    }}
  ],
  "splits": [
    {{
      "index": 3,
      "split_points": ["After discussing X, the text shifts to Y"],
      "reason": "Chunk contains two distinct topics"
    }}
  ]
}}

Guidelines:
- Merge if: incomplete sentence, split concept, same topic continues
- Split if: multiple distinct topics, clear topic shift, >800 tokens with natural break
- Leave alone if: semantically complete, single concept, good size"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a chunk refinement expert. Analyze chunks and identify merge/split opportunities for better semantic coherence."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error analyzing batch: {e}")
            return {'merges': [], 'splits': []}
    
    def _apply_refinements(
        self, 
        chunks: List[Dict[str, Any]], 
        plan: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Apply refinement plan to chunks.
        
        CRITICAL: Prevent cascading merges by tracking which chunks are already merged.
        """
        # Start with original chunks
        refined = list(chunks)
        
        # Track which chunks have been merged (to prevent cascading merges)
        merged_indices = set()
        
        # Apply merges first (work backwards to preserve indices)
        merges = sorted(plan.get('merges', []), key=lambda x: x['start_index'], reverse=True)
        
        # Filter out overlapping merges
        valid_merges = []
        for merge in merges:
            start_idx = merge['start_index']
            end_idx = merge['end_index']
            
            # Skip if any chunk in this range is already merged
            if any(i in merged_indices for i in range(start_idx, end_idx + 1)):
                logger.debug(f"Skipping merge {start_idx}-{end_idx}: overlaps with previous merge")
                continue
            
            # Skip if end_idx is out of bounds
            if end_idx >= len(refined):
                logger.debug(f"Skipping merge {start_idx}-{end_idx}: out of bounds")
                continue
            
            valid_merges.append(merge)
            # Mark these indices as merged
            for i in range(start_idx, end_idx + 1):
                merged_indices.add(i)
        
        logger.info(f"   Filtered merges: {len(merges)} → {len(valid_merges)} (removed {len(merges) - len(valid_merges)} overlapping)")
        
        # Apply valid merges
        for merge in valid_merges:
            start_idx = merge['start_index']
            end_idx = merge['end_index']
            
            # Merge chunks (only merge start with immediate next, not cascading)
            merged_content = '\n\n'.join([
                refined[i]['content'] 
                for i in range(start_idx, end_idx + 1)
            ])
            
            merged_chunk = {
                'id': str(uuid4()),
                'document_id': refined[start_idx]['document_id'],
                'content': merged_content,
                'chunk_index': start_idx,  # Will be re-indexed later
                'token_count': self._count_tokens(merged_content),
                'summary': None,
                'metadata': {
                    **refined[start_idx].get('metadata', {}),
                    'refined': True,
                    'refinement_type': 'merge',
                    'merge_reason': merge['reason'],
                    'original_indices': list(range(start_idx, end_idx + 1))
                }
            }
            
            # Replace merged chunks with single chunk
            refined[start_idx:end_idx + 1] = [merged_chunk]
        
        # Apply splits (work forwards)
        splits = sorted(plan.get('splits', []), key=lambda x: x['index'])
        offset = 0  # Track index changes from previous splits
        
        for split in splits:
            idx = split['index'] + offset
            
            if idx < len(refined):
                original_chunk = refined[idx]
                split_chunks = self._split_chunk(original_chunk, split['split_points'])
                
                # Replace original with split chunks
                refined[idx:idx + 1] = split_chunks
                offset += len(split_chunks) - 1
        
        # Re-index all chunks
        for i, chunk in enumerate(refined):
            chunk['chunk_index'] = i
        
        return refined
    
    def _split_chunk(
        self, 
        chunk: Dict[str, Any], 
        split_points: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Split a chunk at specified points.
        """
        content = chunk['content']
        
        # Find split positions in content
        positions = []
        for point_desc in split_points:
            # Try to find natural paragraph breaks near the described point
            # This is a simple heuristic - could be improved
            paragraphs = content.split('\n\n')
            mid_point = len(paragraphs) // 2
            positions.append(mid_point)
        
        # Split into sections
        paragraphs = content.split('\n\n')
        sections = []
        last_pos = 0
        
        for pos in sorted(set(positions)):
            if pos > last_pos:
                section = '\n\n'.join(paragraphs[last_pos:pos])
                sections.append(section)
                last_pos = pos
        
        # Add final section
        if last_pos < len(paragraphs):
            section = '\n\n'.join(paragraphs[last_pos:])
            sections.append(section)
        
        # Create new chunks
        split_chunks = []
        for i, section in enumerate(sections):
            if section.strip():
                split_chunks.append({
                    'id': str(uuid4()),
                    'document_id': chunk['document_id'],
                    'content': section.strip(),
                    'chunk_index': chunk['chunk_index'],  # Will be re-indexed
                    'token_count': self._count_tokens(section),
                    'summary': None,
                    'metadata': {
                        **chunk.get('metadata', {}),
                        'refined': True,
                        'refinement_type': 'split',
                        'split_index': i,
                        'original_chunk_id': chunk['id']
                    }
                })
        
        return split_chunks if split_chunks else [chunk]
    
    def _count_tokens(self, text: str) -> int:
        """Rough token count estimate."""
        return int(len(text.split()) * 1.33)
