# Chunking Improvements Plan (Simplified Architecture)

**Date:** October 23, 2025  
**Status:** Revised - Back to Basics  
**Goal:** Simple, structure-aware base chunking + composable enhancements

---

## Executive Summary

**Current State (Overcomplicated):**
- ❌ **Too complex**: Sorting Hat → Multiple strategies → Byte offsets → Corrections → Mid-word cuts
- ❌ **Fighting self-inflicted problems**: Byte offset math, encoding issues, hallucinated chunks
- ❌ **Maintenance burden**: 4 chunking strategies, 3-pass processing, complex routing

**The Realization:**
We've been overengineering the base chunking layer. Docling already gives us excellent structure - we should use it directly.

**New Approach:**
```
Simple Base Chunking (Docling structure)
  ↓
Optional Enhancements (RAPTOR, propositions, etc.)
  ↓
High-quality chunks
```

**Key Principles:**
1. **Base chunking should be simple** - Use Docling's natural structure
2. **Enhancements are composable** - Stack them independently
3. **No LLM for base chunking** - Fast, deterministic, free
4. **LLM only for enhancements** - Where it adds real value

**Expected Impact:**
- **Simplicity**: 4 strategies → 1 base chunker (80% less code)
- **Quality**: No mid-word cuts, respects document structure
- **Speed**: No LLM calls for base chunking (10x faster)
- **Cost**: $0 base + optional enhancements
- **Maintainability**: Simple, testable, debuggable

---

## Phase 1: Simplify Base Chunking (Week 1)

### 1.1 Structure-Aware Base Chunker ⭐⭐⭐⭐⭐

**Problem:** Current chunking is overcomplicated with multiple strategies, byte offsets, and corrections.

**Solution:** Simple chunker that uses Docling's natural document structure.

**How It Works:**
1. Docling extracts document structure (sections, paragraphs, tables)
2. Use sections as natural chunk boundaries
3. If section too large, split on paragraphs
4. If section too small, merge with neighbors
5. Target size: ~1000 characters (flexible)

**Implementation:**
```python
# apps/backend/ingest/chunkers/structure_aware_chunker.py

class StructureAwareChunker:
    """
    Simple chunker that respects Docling's document structure.
    No LLM calls, no byte offsets, no complexity.
    """
    
    def __init__(self, target_size=1000, min_size=500, max_size=2000):
        self.target_size = target_size  # characters
        self.min_size = min_size
        self.max_size = max_size
    
    def chunk_document(self, docling_doc, document_id):
        """
        Chunk document using Docling's natural structure.
        """
        chunks = []
        
        # Iterate through Docling's structured elements
        for item in docling_doc.iterate_items():
            if item.type == "section_header":
                current_section = {
                    "title": item.text,
                    "level": item.level,
                    "content": []
                }
            
            elif item.type == "paragraph":
                current_section["content"].append(item.text)
                
                # Check if section is large enough to chunk
                section_text = "\n\n".join(current_section["content"])
                if len(section_text) >= self.target_size:
                    chunks.append(self._create_chunk(
                        current_section, 
                        document_id,
                        len(chunks)
                    ))
                    current_section["content"] = []
            
            elif item.type == "table":
                # Tables become their own chunks
                chunks.append(self._create_table_chunk(
                    item,
                    document_id,
                    len(chunks)
                ))
        
        return chunks
    
    def _create_chunk(self, section, document_id, index):
        """Create chunk from section data."""
        content = "\n\n".join(section["content"])
        
        return {
            "id": f"{document_id}_chunk_{index}",
            "document_id": document_id,
            "chunk_index": index,
            "content": content,
            "metadata": {
                "section_title": section["title"],
                "section_level": section["level"],
                "chunk_type": "section",
                "char_count": len(content)
            }
        }
```

**Benefits:**
- ✅ **Simple**: ~100 lines of code vs 1000+
- ✅ **Fast**: No LLM calls, instant chunking
- ✅ **Quality**: Respects document structure, no mid-word cuts
- ✅ **Free**: $0 cost for base chunking
- ✅ **Maintainable**: Easy to understand and debug

**Files to Create:**
- `apps/backend/ingest/chunkers/structure_aware_chunker.py`
- `apps/backend/ingest/tests/test_structure_aware_chunker.py`

**Files to Remove:**
- `apps/backend/ingest/chunkers/sorting_hat.py` (no longer needed)
- `apps/backend/ingest/chunkers/agentic_chunker.py` (no longer needed)
- `apps/backend/ingest/chunkers/planner_executor_chunker.py` (no longer needed)
- `apps/backend/ingest/chunkers/custom_boundary_chunker.py` (no longer needed)

**Files to Modify:**
- `apps/backend/ingest/main.py` (use StructureAwareChunker)

**Effort:** 4 hours  
**Impact:** Very High (massive simplification)  
**Cost:** $0  
**Dependencies:** None

**Success Criteria:**
- All documents chunk successfully
- No mid-word cuts
- Respects document structure
- 10x faster than current approach

---

---

## Phase 2: Composable Enhancements (Weeks 2-3)

**Note:** All enhancements work on top of the simple base chunker. They're independent and optional.

### 2.1 Document Augmentation (Question Generation) ⭐⭐⭐⭐⭐

**Problem:** HyDE makes up facts (especially for acronyms). We need better query-to-document matching without hallucination.

**Solution:** Generate questions from base chunks during ingestion, store alongside chunks.

**Why This Works:**
```
Current (with HyDE):
  Query: "What does TTI stand for?"
  HyDE generates: "TTI is Time To Interactive..." (WRONG!)
  Retrieves: Wrong documents

With Document Augmentation:
  During ingestion:
    Doc: "TTI (Tactical Training Institute) provides..."
    Generate: ["What does TTI stand for?", "What is TTI?", ...]
    Store: Original doc + questions
  
  During search:
    Query: "What does TTI stand for?"
    Matches: Generated question (exact match!)
    Returns: Original document (CORRECT!)
```

**Implementation:**
```python
class DocumentAugmentationChunker:
    """
    Generates questions from chunks to improve query matching.
    Replaces HyDE with a non-hallucinating alternative.
    """
    
    def __init__(self, base_chunker, questions_per_chunk=5):
        self.base_chunker = base_chunker
        self.questions_per_chunk = questions_per_chunk
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    def chunk_document(self, doc, document_id):
        # 1. Get base chunks
        chunks = self.base_chunker.chunk_document(doc, document_id)
        
        # 2. Generate questions for each chunk
        augmented_chunks = []
        for chunk in chunks:
            # Generate questions
            questions = self._generate_questions(chunk['content'])
            
            # Store original chunk
            augmented_chunks.append({
                **chunk,
                'type': 'ORIGINAL',
                'augmented_questions': questions
            })
            
            # Store questions as separate searchable items
            for question in questions:
                augmented_chunks.append({
                    'content': question,
                    'type': 'AUGMENTED_QUESTION',
                    'parent_chunk_id': chunk['chunk_id'],
                    'document_id': document_id,
                    'metadata': chunk['metadata']
                })
        
        return augmented_chunks
    
    def _generate_questions(self, chunk_content):
        """Generate questions that this chunk can answer."""
        prompt = f"""Generate {self.questions_per_chunk} questions that can be answered by this text.
        
Questions should:
- Be specific and factual
- Use terminology from the text
- Cover different aspects of the content
- Be phrased as users would ask them

Text: {chunk_content}

Return ONLY the questions, one per line."""
        
        response = self.llm.invoke(prompt)
        questions = [q.strip() for q in response.content.split('\n') if q.strip()]
        return questions[:self.questions_per_chunk]
```

**Database Changes:**
```sql
-- Add type column to chunks table
ALTER TABLE chunks ADD COLUMN chunk_type VARCHAR(50) DEFAULT 'ORIGINAL';
ALTER TABLE chunks ADD COLUMN parent_chunk_id UUID REFERENCES chunks(id);

-- Index for faster lookups
CREATE INDEX idx_chunks_type ON chunks(chunk_type);
CREATE INDEX idx_chunks_parent ON chunks(parent_chunk_id);
```

**Search Function Changes:**
```typescript
// In search function, after retrieving results
const processedResults = results.map(result => {
  if (result.chunk_type === 'AUGMENTED_QUESTION') {
    // Return the parent chunk, not the question
    return getParentChunk(result.parent_chunk_id);
  }
  return result;
});
```

**Files to Create:**
- `apps/backend/ingest/chunkers/document_augmentation_chunker.py`
- `supabase/migrations/20251023_add_chunk_augmentation.sql`

**Files to Modify:**
- `apps/backend/ingest/main.py` (add to chunking pipeline)
- `supabase/functions/search/index.ts` (handle augmented questions)

**Effort:** 1 day  
**Impact:** Very High (replaces HyDE, no hallucination)  
**Dependencies:** None

**Success Criteria:**
- Questions generated for all chunks
- Search matches questions and returns parent chunks
- Better precision than HyDE on factual queries

---

### 2.2 Proposition Chunking (Atomic Facts) ⭐⭐⭐⭐⭐

**Problem:** Chunks contain multiple concepts, making retrieval less precise.

**Solution:** Extract atomic propositions (single facts) from each chunk.

**Example:**
```
Original chunk:
"Paul Graham's essay 'Founder Mode,' published in September 2024, challenges 
conventional wisdom about scaling startups."

Atomic propositions:
1. "Paul Graham published an essay called 'Founder Mode'"
2. "The essay 'Founder Mode' was published in September 2024"
3. "The essay 'Founder Mode' challenges conventional wisdom about scaling startups"
4. "Paul Graham's essay is about scaling startups"
```

**Implementation:**
```python
class PropositionChunker:
    """
    Extracts atomic propositions from chunks.
    Based on research: https://doi.org/10.48550/arXiv.2312.06648
    """
    
    def __init__(self, base_chunker):
        self.base_chunker = base_chunker
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    
    def chunk_document(self, doc, document_id):
        # 1. Get base chunks
        chunks = self.base_chunker.chunk_document(doc, document_id)
        
        # 2. Extract propositions from each chunk
        all_items = []
        for chunk in chunks:
            # Extract propositions
            propositions = self._extract_propositions(chunk['content'])
            
            # Quality check
            valid_propositions = self._quality_check(propositions, chunk['content'])
            
            # Store chunk
            all_items.append({
                **chunk,
                'type': 'CHUNK',
                'proposition_count': len(valid_propositions)
            })
            
            # Store propositions
            for prop in valid_propositions:
                all_items.append({
                    'content': prop,
                    'type': 'PROPOSITION',
                    'parent_chunk_id': chunk['chunk_id'],
                    'document_id': document_id,
                    'metadata': chunk['metadata']
                })
        
        return all_items
    
    def _extract_propositions(self, text):
        """Extract atomic propositions from text."""
        prompt = """Extract atomic propositions from this text. Each proposition should:

1. Express a single fact
2. Be understandable without context
3. Use full names, not pronouns
4. Include relevant dates/qualifiers
5. Contain one subject-predicate relationship

Text: {text}

Return propositions as a JSON array of strings."""
        
        response = self.llm.with_structured_output(PropositionList).invoke(
            prompt.format(text=text)
        )
        return response.propositions
    
    def _quality_check(self, propositions, original_text):
        """Grade propositions on accuracy, clarity, completeness, conciseness."""
        valid = []
        for prop in propositions:
            scores = self._grade_proposition(prop, original_text)
            if all(score >= 7 for score in scores.values()):
                valid.append(prop)
        return valid
    
    def _grade_proposition(self, proposition, original_text):
        """Grade a proposition on 4 criteria (1-10 scale)."""
        prompt = """Grade this proposition on:
- Accuracy: How well it reflects the original text (1-10)
- Clarity: How easy to understand without context (1-10)
- Completeness: Includes necessary details (1-10)
- Conciseness: Concise without losing info (1-10)

Proposition: {proposition}
Original: {original_text}

Return JSON with scores."""
        
        response = self.llm.with_structured_output(PropositionGrades).invoke(
            prompt.format(proposition=proposition, original_text=original_text)
        )
        return {
            'accuracy': response.accuracy,
            'clarity': response.clarity,
            'completeness': response.completeness,
            'conciseness': response.conciseness
        }
```

**Database Changes:**
```sql
-- Extend chunk_type enum
ALTER TYPE chunk_type ADD VALUE 'PROPOSITION';

-- Add proposition-specific metadata
ALTER TABLE chunks ADD COLUMN quality_scores JSONB;
```

**Files to Create:**
- `apps/backend/ingest/chunkers/proposition_chunker.py`
- `apps/backend/ingest/tests/test_proposition_chunker.py`
- `supabase/migrations/20251024_add_propositions.sql`

**Files to Modify:**
- `apps/backend/ingest/main.py` (add to pipeline)

**Effort:** 2-3 days  
**Impact:** Very High (precise retrieval)  
**Dependencies:** None

**Success Criteria:**
- Propositions extracted from all chunks
- Quality threshold: 7/10 on all metrics
- Search can target propositions or chunks

---

### 2.2 Chunk Size Normalization (Optional) ⭐⭐⭐

**Problem:** Mixed chunk sizes can cause embedding bias - smaller chunks often rank higher in similarity search even when larger chunks have better overall information.

**Solution:** Add optional score normalization based on chunk size to balance precision vs completeness.

**Why This Matters:**
```
Small chunk (128 tokens): "TTI stands for Tactical Training Institute"
  → Focused embedding, high similarity score (0.92)
  → But minimal context

Large chunk (512 tokens): "TTI (Tactical Training Institute) provides..."
  → Diluted embedding, lower similarity score (0.78)
  → But comprehensive information

Problem: Small chunk ranks higher despite large chunk being more useful
```

**Implementation:**
```typescript
// In supabase/functions/search/index.ts, after reranking

function normalizeByChunkSize(results: SearchResult[]): SearchResult[] {
  return results.map(result => {
    // Calculate size bonus (logarithmic scale)
    // Larger chunks get slight boost (up to +0.1 for 1024 tokens)
    const sizeBonus = Math.log(result.chunk_size / 256) * 0.05;
    
    return {
      ...result,
      size_bonus: sizeBonus,
      final_score: result.rerank_score + sizeBonus
    };
  }).sort((a, b) => b.final_score - a.final_score);
}

// Usage (optional, controlled by feature flag)
if (systemSettings['search.normalizeChunkSize']) {
  finalResults = normalizeByChunkSize(finalResults);
}
```

**Feature Flag:**
```sql
INSERT INTO system_settings (category, key, value, description) VALUES
  ('search', 'search.normalizeChunkSize', false, 'Normalize scores by chunk size');
```

**Files to Modify:**
- `supabase/functions/search/index.ts` (add normalization function)

**Effort:** 2 hours  
**Impact:** Medium (improves balance between precision and context)  
**Dependencies:** Per-document chunk sizing (Phase 1.1)

**Success Criteria:**
- Optional normalization available
- Can be toggled via system settings
- Larger chunks get slight ranking boost
- A/B test shows improved user satisfaction

---

### 2.3 Hierarchical Storage ⭐⭐⭐⭐

**Problem:** Results lack context. Users need to see surrounding information.

**Solution:** Store document hierarchy (Document → Section → Chunk → Proposition).

**Implementation:**
```sql
-- Add hierarchical metadata
ALTER TABLE documents ADD COLUMN structure JSONB;

ALTER TABLE chunks ADD COLUMN section_id UUID;
ALTER TABLE chunks ADD COLUMN section_title TEXT;
ALTER TABLE chunks ADD COLUMN hierarchy_level INTEGER;
ALTER TABLE chunks ADD COLUMN sibling_order INTEGER;

-- Create sections table
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level INTEGER NOT NULL,
  parent_section_id UUID REFERENCES sections(id),
  content_preview TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sections_document ON sections(document_id);
CREATE INDEX idx_sections_parent ON sections(parent_section_id);
CREATE INDEX idx_chunks_section ON chunks(section_id);
```

**Chunker Changes:**
```python
def chunk_with_hierarchy(doc, document_id):
    """
    Extract document structure and preserve hierarchy.
    """
    # 1. Parse document structure
    structure = parse_document_structure(doc)
    # Returns: {
    #   'title': 'Document Title',
    #   'sections': [
    #     {'title': 'Section 1', 'level': 1, 'content': '...', 'subsections': [...]},
    #     ...
    #   ]
    # }
    
    # 2. Store sections
    section_ids = store_sections(structure, document_id)
    
    # 3. Chunk within sections
    chunks = []
    for section in structure['sections']:
        section_chunks = chunk_section(
            section['content'],
            section_id=section_ids[section['title']],
            section_title=section['title'],
            level=section['level']
        )
        chunks.extend(section_chunks)
    
    return chunks
```

**Search Enhancement:**
```typescript
// After retrieving results, optionally expand context
async function expandContext(results: SearchResult[]): Promise<EnrichedResult[]> {
  return Promise.all(results.map(async (result) => {
    const [section, neighbors, propositions] = await Promise.all([
      getSection(result.section_id),
      getNeighborChunks(result.chunk_id, n=2),
      getPropositions(result.chunk_id)
    ]);
    
    return {
      ...result,
      section_context: section,
      neighbor_chunks: neighbors,
      atomic_facts: propositions
    };
  }));
}
```

**Files to Create:**
- `supabase/migrations/20251025_add_hierarchy.sql`
- `apps/backend/ingest/processors/structure_parser.py`

**Files to Modify:**
- `apps/backend/ingest/chunkers/hybrid_chunker.py` (add hierarchy)
- `supabase/functions/search/index.ts` (add context expansion)

**Effort:** 2 days  
**Impact:** High (better UX, more context)  
**Dependencies:** None

**Success Criteria:**
- All chunks linked to sections
- Search can expand context on demand
- UI shows hierarchical breadcrumbs

---

## Phase 3: Advanced Enhancements (Week 4+)

### 3.1 CRAG (Corrective RAG) ⭐⭐⭐⭐

**Problem:** Sometimes our knowledge base doesn't have the answer, but we return low-confidence results anyway.

**Solution:** Detect low-confidence results and fall back to web search.

**Implementation:**
```typescript
// In search function, after reranking
const topResult = rerankedResults[0];

if (topResult.rerank_score < 0.5) {
  console.log('[CRAG] Low confidence, falling back to web search');
  
  // Search web (DuckDuckGo, Tavily, etc.)
  const webResults = await searchWeb(query);
  
  // Combine and re-rank
  const combinedResults = [...rerankedResults, ...webResults];
  const finalResults = await rerankResults(query, combinedResults);
  
  return {
    results: finalResults,
    source: 'hybrid',
    confidence: 'low',
    used_web_fallback: true
  };
}
```

**Files to Create:**
- `supabase/functions/search/web_search.ts`
- `supabase/functions/search/crag.ts`

**Files to Modify:**
- `supabase/functions/search/index.ts` (add CRAG logic)

**Effort:** 2 days  
**Impact:** Medium (handles edge cases)  
**Dependencies:** Web search API (DuckDuckGo, Tavily, etc.)

**Success Criteria:**
- Detects low-confidence results (rerank_score < 0.5)
- Falls back to web search
- Combines and re-ranks all results

---

### 3.2 Context Enrichment (Neighbor Retrieval) ⭐⭐⭐

**Problem:** Retrieved chunks might be missing context from surrounding chunks.

**Solution:** Automatically include N neighboring chunks with each result.

**Implementation:**
```typescript
async function enrichWithNeighbors(
  results: SearchResult[], 
  numNeighbors: number = 1
): Promise<EnrichedResult[]> {
  return Promise.all(results.map(async (result) => {
    // Get chunk metadata
    const chunkIndex = result.metadata.chunk_index;
    const documentId = result.document_id;
    
    // Get neighbors
    const neighbors = await supabase
      .from('chunks')
      .select('*')
      .eq('document_id', documentId)
      .gte('metadata->chunk_index', chunkIndex - numNeighbors)
      .lte('metadata->chunk_index', chunkIndex + numNeighbors)
      .order('metadata->chunk_index', { ascending: true });
    
    // Concatenate with overlap handling
    const enrichedContent = concatenateChunks(neighbors.data);
    
    return {
      ...result,
      enriched_content: enrichedContent,
      neighbor_count: neighbors.data.length
    };
  }));
}
```

**Files to Modify:**
- `supabase/functions/search/index.ts` (add neighbor retrieval)
- `apps/backend/ingest/chunkers/hybrid_chunker.py` (add chunk_index to metadata)

**Effort:** 1 day  
**Impact:** Medium (more context)  
**Dependencies:** chunk_index in metadata

**Success Criteria:**
- Each result includes N neighbors
- Overlap handled correctly
- Optional (can be toggled)

---

### 3.3 Adaptive Retrieval ⭐⭐⭐

**Problem:** Different query types need different retrieval strategies.

**Solution:** Classify queries and route to appropriate strategy.

**Implementation:**
```typescript
async function adaptiveSearch(query: string, userId: string) {
  // 1. Classify query
  const queryType = await classifyQuery(query);
  // Types: 'factual', 'analytical', 'opinion', 'contextual'
  
  // 2. Route to appropriate strategy
  switch (queryType) {
    case 'factual':
      // Use proposition search + reranking
      return factualSearch(query, userId);
    
    case 'analytical':
      // Use multi-query + diverse results
      return analyticalSearch(query, userId);
    
    case 'opinion':
      // Find multiple viewpoints
      return opinionSearch(query, userId);
    
    case 'contextual':
      // Personalize based on user history
      return contextualSearch(query, userId);
    
    default:
      // Standard search
      return standardSearch(query, userId);
  }
}
```

**Files to Create:**
- `supabase/functions/search/adaptive_search.ts`
- `supabase/functions/search/query_classifier.ts`

**Files to Modify:**
- `supabase/functions/search/index.ts` (add adaptive routing)

**Effort:** 3 days  
**Impact:** Medium-High (better for diverse queries)  
**Dependencies:** Query classification

**Success Criteria:**
- Queries classified into 4 types
- Each type has optimized strategy
- Measurable improvement per type

---

## Implementation Timeline

### Week 1: Quick Wins
- **Day 1**: Per-document chunk size optimization (extend Sorting Hat)
- **Day 2**: Testing & validation of chunk size analysis
- **Day 3-5**: Document augmentation (question generation)

### Week 2: Propositions
- **Day 1-3**: Proposition extraction
- **Day 4-5**: Quality checking & testing

### Week 3: Hierarchy & Normalization
- **Day 1-2**: Database schema & migrations (hierarchy)
- **Day 3**: Chunk size normalization (search function)
- **Day 4-5**: Structure parsing & search integration

### Week 4+: Advanced
- **As needed**: CRAG, Context enrichment, Adaptive retrieval

---

## Success Metrics

### Quantitative
- **Precision**: 75% → 90% (+15%)
- **Recall**: 80% → 85% (+5%)
- **Response time**: <500ms (maintain)
- **Cost per query**: $0.02 → $0.015 (-25%)

### Qualitative
- Users find answers faster
- Fewer "not found" results
- Better context in results
- More accurate factual answers

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Increased ingestion time** | Medium | Process in parallel, async |
| **Higher storage costs** | Low | Propositions are small, compress |
| **LLM API costs** | Medium | Use gpt-4o-mini, batch requests |
| **Breaking changes** | High | Feature flags, gradual rollout |
| **Quality degradation** | High | Extensive testing, benchmarks |

---

## Feature Flags

All improvements should be behind feature flags:

```sql
-- Add to system_settings
INSERT INTO system_settings (category, key, value, description) VALUES
  ('chunking', 'chunking.perDocumentSize', true, 'Analyze each document for optimal chunk size'),
  ('chunking', 'chunking.usePropositions', true, 'Extract atomic propositions'),
  ('chunking', 'chunking.useAugmentation', true, 'Generate questions'),
  ('chunking', 'chunking.useHierarchy', true, 'Store document hierarchy'),
  ('search', 'search.normalizeChunkSize', false, 'Normalize scores by chunk size'),
  ('search', 'search.useCRAG', false, 'Enable CRAG fallback'),
  ('search', 'search.enrichNeighbors', true, 'Include neighbor chunks'),
  ('search', 'search.useAdaptive', false, 'Adaptive query routing');
```

---

## Testing Strategy

### Unit Tests
- Proposition extraction accuracy
- Question generation quality
- Hierarchy parsing correctness

### Integration Tests
- End-to-end search with new features
- Performance benchmarks
- Cost analysis

### A/B Testing
- Old chunking vs new chunking
- Measure: precision, recall, user satisfaction
- Duration: 2 weeks per phase

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)
- Deploy to dev environment
- Test with team
- Gather feedback

### Phase 2: Beta Users (Week 3-4)
- Deploy to 10% of users
- Monitor metrics
- Fix issues

### Phase 3: Full Rollout (Week 5+)
- Deploy to all users
- Monitor closely
- Iterate based on feedback

---

## Cost Analysis

### One-Time Costs (Ingestion)
- **Proposition extraction**: ~$0.10 per document
- **Question generation**: ~$0.05 per document
- **Quality checking**: ~$0.02 per document
- **Total**: ~$0.17 per document

### Ongoing Costs (Per Query)
- **Current**: $0.02 (Multi-Query + Reranking)
- **With improvements**: $0.015 (better chunks = fewer queries)
- **Savings**: 25%

### ROI
- **Investment**: $0.17 per document (one-time)
- **Savings**: $0.005 per query (ongoing)
- **Break-even**: 34 queries per document
- **Expected**: 100+ queries per document
- **ROI**: 3x+

---

## Final Architecture

### Simple & Composable

```
PDF
  ↓
Docling (extraction + structure parsing)
  ↓
StructureAwareChunker (base chunks, free, fast)
  ↓
Optional Enhancements (composable, independent):
  ├─ Question Generation ($0.05/doc)
  ├─ Proposition Extraction ($0.10/doc)
  ├─ RAPTOR Hierarchical Summaries ($0.15/doc)
  ├─ Contextual Enrichment ($0.02/doc)
  └─ Graph Extraction (already implemented)
  ↓
High-Quality Chunks
```

### Benefits of New Approach

**vs Current (Complex):**
- ✅ 80% less code (4 strategies → 1 base)
- ✅ 10x faster (no LLM for base)
- ✅ $0 base cost (vs $0.07-0.30)
- ✅ No mid-word cuts
- ✅ No byte offset issues
- ✅ Easy to understand & debug

**Enhancements:**
- ✅ Independent (can enable/disable)
- ✅ Composable (stack as needed)
- ✅ Testable (each layer separate)
- ✅ Cost-controlled (pay for what you use)

---

## Next Steps

1. **Approve simplified approach** - Rip out complexity, start fresh
2. **Implement StructureAwareChunker** - 4 hours, replaces 4 strategies
3. **Test with existing documents** - Verify quality improvement
4. **Add enhancements incrementally** - Start with question generation
5. **Measure & iterate** - Track precision, recall, user satisfaction

---

## Questions for Discussion

1. **Agree to simplify?** - Remove Sorting Hat, Agentic, Planner-Executor, Custom Boundary?
2. **Timeline**: 1 week for base + 2 weeks for enhancements?
3. **Which enhancements first?** - Question generation? Propositions? RAPTOR?
4. **Testing strategy**: A/B test base chunker vs current?
5. **Rollout**: Deploy base immediately, then add enhancements?

---

## References

### Research Papers
- [Proposition Chunking](https://doi.org/10.48550/arXiv.2312.06648)
- [RAPTOR: Recursive Abstractive Processing](https://arxiv.org/abs/2401.18059)
- [CRAG: Corrective RAG](https://arxiv.org/abs/2401.15884)

### Code Examples
- [RAG Techniques Repository](https://github.com/NirDiamant/RAG_TECHNIQUES)
- [LangChain Semantic Chunking](https://python.langchain.com/docs/how_to/semantic-chunker/)

### Internal Docs
- `/Users/chrisgscott/projects/meet-mosaic/docs/RAG_Techniques/`
- Current search implementation: `supabase/functions/search/index.ts`
- Current chunking: `apps/backend/ingest/chunkers/hybrid_chunker.py`
