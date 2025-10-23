# Chunking Improvements Plan

**Date:** October 22, 2025  
**Status:** Proposed  
**Goal:** Improve chunking quality to maximize the effectiveness of our existing world-class retrieval system (Multi-Query + Reranking + Hybrid Search)

---

## Executive Summary

**Current State:**
- ✅ **Excellent retrieval**: Multi-Query, Cohere Reranking, Hybrid Search (RRF)
- ⚠️ **Good chunking**: Semantic chunking with HybridChunker (256 tokens fixed)
- ❌ **Missing**: Per-document optimization, atomic propositions, hierarchical storage

**The Opportunity:**
Our retrieval is top-tier, but it can only work with the chunks we give it. By improving chunking quality, we can dramatically improve search results without changing retrieval logic.

**Key Insight from Research:**
Different documents need different chunk sizes, even within the same project. Per-document analysis (not document type classification) is the optimal approach.

**Expected Impact:**
- **Precision**: 75% → 90% (+15%)
- **Recall**: 80% → 85% (+5%)
- **User Satisfaction**: Good → Excellent (+20%)
- **Cost per query**: $0.02 → $0.015 (-25%)

**Major Changes from Original Plan:**
1. **Per-Document Chunk Sizing**: Extend Sorting Hat to analyze each document and recommend optimal chunk size (128, 256, 512, or 1024 tokens) based on text characteristics
2. **No Manual Benchmarking**: Automatic analysis using fast heuristics (no LLM needed)
3. **Mixed Chunk Sizes**: Acceptable with our Multi-Query + Reranking stack; optional normalization in Phase 2
4. **Zero Configuration**: Fully automatic, transparent, and overridable

---

## Phase 1: Quick Wins (Week 1)

### 1.1 Per-Document Chunk Size Optimization ⭐⭐⭐⭐⭐

**Problem:** Different documents need different chunk sizes, even within the same project. A one-size-fits-all approach is suboptimal.

**Solution:** Extend Sorting Hat to analyze each document and automatically recommend optimal chunk size based on document characteristics.

**Why Per-Document:**
- Technical docs with dense content → 128 tokens (precise)
- Well-structured articles → 256 tokens (balanced)
- Long-form narratives → 512 tokens (contextual)
- Same "document type" can have vastly different characteristics

**Implementation:**
```python
# Extend sorting_hat.py

def _analyze_for_chunk_size(self, doc_text: str) -> dict:
    """
    Fast heuristic-based chunk size analysis.
    No LLM needed - just text statistics!
    """
    # Calculate metrics
    sentences = sent_tokenize(doc_text)
    paragraphs = doc_text.split('\n\n')
    
    avg_sentence_len = np.mean([len(s.split()) for s in sentences])
    avg_para_len = np.mean([len(p.split()) for p in paragraphs if p.strip()])
    
    # Detect structure
    has_headers = bool(re.search(r'^#{1,6}\s', doc_text, re.MULTILINE))
    has_lists = bool(re.search(r'^\s*[-*•]\s', doc_text, re.MULTILINE))
    has_code = bool(re.search(r'```|`[^`]+`', doc_text))
    
    structure_score = sum([has_headers, has_lists, has_code]) / 3
    
    # Information density (technical terms, numbers, acronyms)
    technical_terms = len(re.findall(r'\b[A-Z]{2,}\b', doc_text))
    numbers = len(re.findall(r'\b\d+\.?\d*\b', doc_text))
    density_score = (technical_terms + numbers) / len(doc_text.split())
    
    # Decision logic
    if avg_sentence_len < 15 and density_score > 0.15:
        # Dense, technical: small chunks
        return {
            'optimal_size': 128,
            'reasoning': 'Dense technical content with short sentences',
            'confidence': 0.9
        }
    
    elif structure_score > 0.6 and avg_para_len < 100:
        # Well-structured, medium paragraphs: medium chunks
        return {
            'optimal_size': 256,
            'reasoning': 'Well-structured with clear sections',
            'confidence': 0.85
        }
    
    elif avg_para_len > 150:
        # Long-form narrative: large chunks
        return {
            'optimal_size': 512,
            'reasoning': 'Long-form narrative content',
            'confidence': 0.8
        }
    
    else:
        # Default: medium chunks
        return {
            'optimal_size': 256,
            'reasoning': 'Standard mixed content',
            'confidence': 0.7
        }

def route_document(self, doc_text: str, document_id: str) -> dict:
    """
    Analyze document and recommend:
    1. Chunking strategy (hybrid, agentic, planner-executor)
    2. Chunk size (128, 256, 512, 1024)
    3. Other parameters (overlap, etc.)
    """
    analysis = self.analyze_document(doc_text)
    
    # Choose strategy (existing logic)
    strategy = self._choose_strategy(analysis)
    
    # Choose chunk size (NEW!)
    chunk_size_analysis = self._analyze_for_chunk_size(doc_text)
    chunk_size = chunk_size_analysis['optimal_size']
    
    # Calculate overlap (proportional to chunk size)
    overlap = int(chunk_size * 0.2)  # 20% overlap
    
    config = {
        'strategy': strategy,
        'chunk_size': chunk_size,
        'chunk_overlap': overlap,
        'reasoning': {
            'strategy': analysis.get('strategy_reasoning', ''),
            'chunk_size': chunk_size_analysis['reasoning']
        },
        'confidence': {
            'strategy': analysis.get('strategy_confidence', 0.8),
            'chunk_size': chunk_size_analysis['confidence']
        }
    }
    
    # Save to database
    self._save_config(document_id, config)
    
    return config
```

**Handling Mixed Chunk Sizes:**

Mixed chunk sizes create minor issues (embedding bias toward smaller chunks), but our Multi-Query + Reranking system handles it well. We'll add optional size normalization in Phase 2:

```typescript
// Optional: Normalize reranking scores by chunk size
const normalized = rerankedResults.map(r => ({
  ...r,
  final_score: r.rerank_score * (1 + Math.log(r.chunk_size / 256) * 0.05)
}));
```

**Files to Modify:**
- `apps/backend/ingest/chunkers/sorting_hat.py` (add chunk size analysis)
- `apps/backend/ingest/main.py` (use chunk_size from config)

**Files to Create:**
- `apps/backend/ingest/tests/test_chunk_size_analysis.py`

**Effort:** 4 hours  
**Impact:** Very High (automatic per-document optimization)  
**Cost:** $0 (no LLM calls, just text statistics)  
**Dependencies:** None

**Success Criteria:**
- Chunk size automatically determined for each document
- Reasoning and confidence logged
- Config stored in database
- Can be overridden manually if needed

**Example Outputs:**
```python
# Technical API docs
{
  'strategy': 'hybrid',
  'chunk_size': 128,
  'chunk_overlap': 25,
  'reasoning': {
    'strategy': 'Well-structured with clear sections',
    'chunk_size': 'Dense technical content with short sentences'
  }
}

# Strategy Tactics card deck
{
  'strategy': 'agentic',
  'chunk_size': 256,
  'chunk_overlap': 50,
  'reasoning': {
    'strategy': 'Variable structure with inconsistent markers',
    'chunk_size': 'Medium-length cards with mixed content'
  }
}

# Long-form article
{
  'strategy': 'hybrid',
  'chunk_size': 512,
  'chunk_overlap': 100,
  'reasoning': {
    'strategy': 'Clear hierarchical structure',
    'chunk_size': 'Long-form narrative with large paragraphs'
  }
}
```

---

### 1.2 Document Augmentation (Question Generation) ⭐⭐⭐⭐⭐

**Problem:** HyDE makes up facts (especially for acronyms). We need better query-to-document matching without hallucination.

**Solution:** Generate questions from documents during ingestion, store alongside chunks.

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

## Phase 2: Foundational Improvements (Weeks 2-3)

### 2.1 Proposition Chunking (Atomic Facts) ⭐⭐⭐⭐⭐

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

## Next Steps

1. **Review this plan** - Discuss priorities, timeline, resources
2. **Approve Phase 1** - Get buy-in for quick wins
3. **Set up benchmarking** - Create test queries and metrics
4. **Start implementation** - Begin with chunk size optimization
5. **Iterate** - Measure, learn, improve

---

## Questions for Discussion

1. **Priority**: Do we agree on the Phase 1 priorities?
2. **Timeline**: Is 4 weeks realistic for Phases 1-3?
3. **Resources**: Who will work on this? Full-time or part-time?
4. **Testing**: What's our testing strategy? A/B test everything?
5. **Rollout**: Gradual or all-at-once?
6. **Metrics**: What metrics matter most to us?
7. **Budget**: Are we comfortable with $0.17 per document ingestion cost?

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
