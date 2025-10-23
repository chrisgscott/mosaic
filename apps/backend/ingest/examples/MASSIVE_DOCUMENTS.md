# Handling Massive Documents (850+ pages, 158MB+)

For documents that exceed even large context windows (>1M tokens), the Planner-Executor pattern uses a **two-pass hierarchical approach**.

## The Problem

Your 850-page, 158MB PDF is likely **3-5M tokens** - too large even for Gemini 2.0 Flash's 2M context window.

## The Solution: Two-Pass Hierarchical Planning

### Pass 1: Section Mapping (Coarse)
**Model**: Gemini 2.0 Flash (or GPT-4.1)  
**Input**: Document sample (beginning, middle, end)  
**Output**: High-level section map

```json
{
  "sections": [
    {
      "id": "s_001",
      "title": "Chapter 1: Introduction",
      "byte_range": {"start": 0, "end": 150000},
      "estimated_chunks": 45,
      "type": "chapter",
      "key_topics": ["overview", "scope", "methodology"]
    },
    {
      "id": "s_002",
      "title": "Chapter 2: Literature Review",
      "byte_range": {"start": 150000, "end": 420000},
      "estimated_chunks": 85,
      "type": "chapter",
      "key_topics": ["prior work", "gaps", "frameworks"]
    }
    // ... 48 more sections
  ]
}
```

**Cost**: ~$0.02 (one call with sampled content)

### Pass 2: Per-Section Chunk Plans (Fine) - PARALLEL
**Model**: gpt-4o-mini (cheaper)  
**Input**: Each section's full text + global context  
**Output**: Detailed chunk plan for that section  
**Parallelism**: 10 sections at once

```python
# Process 50 sections in parallel (10 at a time)
with ThreadPoolExecutor(max_workers=10) as executor:
    for section in sections:
        # Each section gets its own detailed chunk plan
        future = executor.submit(
            create_section_chunk_plan,
            section_text,
            section_meta,
            global_map  # Knows about other sections
        )
```

**Cost**: ~$0.10-0.20 (50 sections × $0.002-0.004 each)

## How It Works

### 1. Section Map Creation
The planner analyzes **samples** from your 850-page document:
- First 50K chars (pages 1-50)
- Middle 50K chars (pages 400-450)
- Last 50K chars (pages 800-850)

From this, it infers the document structure:
- "This is a research paper with 12 chapters"
- "Each chapter has 3-5 major sections"
- "Chapters 1-3 are intro, 4-10 are results, 11-12 are discussion"

### 2. Parallel Section Processing
Each of the 50 sections gets processed **independently and in parallel**:

```
Section 1 (Chapter 1) → gpt-4o-mini → 45 chunks
Section 2 (Chapter 2) → gpt-4o-mini → 85 chunks
Section 3 (Chapter 3) → gpt-4o-mini → 62 chunks
...
(all happening simultaneously)
```

Each section planner knows:
- Its own content (full text)
- Its position in the document (section 5 of 50)
- The global structure (chapter titles, topics)

### 3. Global Re-indexing
After all sections are processed, chunks are re-indexed globally:

```json
{
  "chunk_index": 0,
  "section_id": "s_001",
  "section_path": "Chapter 1 > Introduction",
  ...
},
{
  "chunk_index": 45,
  "section_id": "s_002",
  "section_path": "Chapter 2 > Literature Review > Prior Work",
  ...
}
```

## Configuration

```json
{
  "strategy": "planner_executor",
  "planner_model": "gemini-2.0-flash-exp",
  "executor_model": "gpt-4o-mini",
  "max_planner_tokens": 1000000,
  "section_parallel_workers": 10,
  "max_chunk_tokens": 500,
  "overlap_ratio": 0.15
}
```

**Key settings:**
- `max_planner_tokens`: Threshold for two-pass (default: 1M)
- `section_parallel_workers`: How many sections to process at once (default: 10)

## Cost Breakdown: 850-page PDF

**Assumptions:**
- 850 pages ≈ 3.5M tokens
- 50 major sections (chapters/parts)
- ~2000 total chunks

**Pass 1: Section Mapping**
- Model: Gemini 2.0 Flash
- Input: 150K tokens (samples)
- Output: 5K tokens (section map)
- Cost: ~$0.02

**Pass 2: Section Chunk Plans** (parallel)
- Model: gpt-4o-mini
- Sections: 50
- Avg input per section: 70K tokens
- Avg output per section: 3K tokens
- Cost per section: ~$0.004
- Total: 50 × $0.004 = **$0.20**

**Pass 3: Enrichment** (parallel)
- Model: gpt-4o-mini
- Chunks: 2000
- Avg input per chunk: 600 tokens
- Avg output per chunk: 150 tokens
- Cost per chunk: ~$0.0002
- Total: 2000 × $0.0002 = **$0.40**

**TOTAL: ~$0.62**

**Compare to:**
- Re-processing bad chunks: $50-100
- Manual chunking: Days of work

## Benefits

### 1. Scalability
- Handles documents of ANY size
- Linear cost scaling (not exponential)
- Parallel processing = fast

### 2. Global Awareness
- Section map provides document-wide context
- Each section planner knows its place in the whole
- Cross-references and relationships preserved

### 3. Cost Efficiency
- Only expensive model for high-level structure
- Cheap model for detailed work
- Parallel execution reduces wall-clock time

### 4. Reliability
- Smaller sections = more reliable planning
- Validation per section
- Graceful degradation (failed sections don't break whole doc)

## Example: Your 850-page PDF

```json
{
  "strategy": "planner_executor",
  "planner_model": "gemini-2.0-flash-exp",
  "executor_model": "gpt-4o-mini",
  "max_planner_tokens": 1000000,
  "section_parallel_workers": 10,
  "document_type": "research_paper",
  "instructions": "This is a comprehensive research paper with multiple chapters. Preserve chapter structure, identify key sections (intro, methods, results, discussion), and maintain cross-references between sections."
}
```

**Processing:**
1. Planner samples your 850 pages → creates 50-section map (~30 sec)
2. 50 sections processed in parallel (10 at a time) → 2000 chunks (~5 min)
3. 2000 chunks enriched in parallel → titles, summaries, keywords (~3 min)

**Total time: ~8-10 minutes**  
**Total cost: ~$0.60-0.80**

## When to Use Two-Pass

The system automatically uses two-pass when:
- Document exceeds `max_planner_tokens` (default: 1M)
- Estimated at ~500+ pages for typical documents

You can force it by setting:
```json
{
  "max_planner_tokens": 500000  // Lower threshold
}
```

Or disable it by setting:
```json
{
  "max_planner_tokens": 10000000  // Very high threshold
}
```

## Limitations

### Section Boundaries
- Relies on document having clear structure (chapters, sections)
- Works poorly for unstructured documents (transcripts, logs)
- For unstructured docs, use sliding window instead

### Cross-Section References
- Chunks in different sections may not know about each other during planning
- Mitigated by passing global section map to each planner
- Consider post-processing to link related chunks

### Memory Usage
- All sections processed in memory simultaneously
- For truly massive docs (10K+ pages), may need disk-based processing
- Current implementation handles up to ~5K pages comfortably

## Future Enhancements

- [ ] Adaptive section sizing (split large sections further)
- [ ] Cross-section relationship detection
- [ ] Incremental processing (process new sections only)
- [ ] Disk-based processing for 10K+ page documents
- [ ] Section caching (reuse plans for similar sections)
