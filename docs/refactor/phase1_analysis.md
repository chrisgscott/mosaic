# Phase 1 Analysis: Current RAG and Augmentation Behavior

**Date**: November 28, 2025  
**Branch**: `refactor/simplify-rag-core`

---

## Current Core RAG Path

### Ingestion Pipeline (`apps/backend/ingest/`)

```
Document Upload → Supabase Storage → pgmq queue
                                          ↓
                              DoclingProcessor (VLM extraction)
                                          ↓
                              StructureAwareChunker (base)
                                          ↓
                    [If ENABLE_DOCUMENT_AUGMENTATION=true]
                              DocumentAugmentationChunker (wrapper)
                              - Generates 5 questions per chunk via LLM
                              - Stores questions as AUGMENTED_QUESTION chunks
                                          ↓
                              EmbeddingsGenerator
                              - Embeds ALL chunks (original + questions)
                                          ↓
                    [If ENABLE_GRAPH_EXTRACTION=true]
                              GraphExtractor
                              - Extracts entities/relationships via LLM
                                          ↓
                              Supabase (chunks, embeddings, entities)
```

**Key Files:**
- `main.py` - Orchestrates pipeline, reads settings
- `chunkers/structure_aware_chunker.py` - Base chunker (no LLM)
- `chunkers/document_augmentation_chunker.py` - Question generation wrapper
- `processors/embeddings_generator.py` - OpenAI embeddings
- `processors/graph_extractor.py` - Entity/relationship extraction

**Current Defaults (from `main.py` lines 56-60):**
```python
ENABLE_GRAPH_EXTRACTION = settings_service.get_bool('search.useGraphSearch', True, ...)  # DEFAULT: TRUE
ENABLE_DOCUMENT_AUGMENTATION = settings_service.get_bool('processing.enableDocumentAugmentation', True, ...)  # DEFAULT: TRUE
QUESTIONS_PER_CHUNK = settings_service.get_int('processing.questionsPerChunk', 5, ...)  # DEFAULT: 5
```

### Query Pipeline (`apps/web/app/api/search/route.ts`)

```
User Query → /api/search
                ↓
    [If complex query + search.useHyDE=true]
        generateHyDE() - Creates hypothetical answer via LLM
                ↓
    [If complex query + search.useMultiQuery=true]
        generateMultiQuery() - Creates 3 query variations via LLM
                ↓
    Generate embeddings for all queries (original + HyDE + variations)
                ↓
    search_chunks_hybrid() - Semantic + BM25 with RRF
    - Searches ALL chunks (including AUGMENTED_QUESTION)
                ↓
    [If relationship query + search.useGraphSearch=true]
        graphEnhancedSearch() - Entity semantic search + graph traversal
                ↓
    [If search.useReranking=true]
        rerankResults() - Cohere rerank
                ↓
    processAugmentedResults() - Replace question chunks with parent chunks
                ↓
    Return results
```

**Current Defaults (from `route.ts` lines 28-33):**
```typescript
// Fallback defaults if DB unavailable
"search.useHyDE": true,
"search.useMultiQuery": true,
"search.useReranking": true,
"search.useGraphSearch": true,
```

---

## Augmentation and HyDE Behavior

### HyDE (Hypothetical Document Embeddings)

**Location:** `apps/web/app/api/search/route.ts` lines 100-124

**How it works:**
1. `shouldUseHyDE(query)` checks if query is "complex" (5+ words, question words, etc.)
2. If complex AND `search.useHyDE=true`, calls `generateHyDE(query)`
3. Uses `gpt-4.1-nano` (quick model) to generate a hypothetical answer
4. Embeds the hypothetical answer instead of/alongside the original query
5. Searches using the hypothetical embedding

**Prompt (from `prompts.ts` lines 68-72):**
```
You are an expert assistant. Given a user's question, write a detailed, 
comprehensive answer that would perfectly answer their question. This 
hypothetical answer will be used to find similar documents.
```

**Problem:** HyDE can hallucinate facts, especially for domain-specific acronyms and terminology. The hypothetical answer may contain incorrect information that then biases retrieval.

### Document Augmentation (Question Generation)

**Location:** `apps/backend/ingest/chunkers/document_augmentation_chunker.py`

**How it works:**
1. Wraps `StructureAwareChunker`
2. For each base chunk, calls LLM to generate 5 questions
3. Stores questions as separate chunks with:
   - `chunk_type = 'AUGMENTED_QUESTION'`
   - `parent_chunk_id = <original chunk ID>`
4. Questions get their own embeddings
5. At query time, if a question matches, `processAugmentedResults()` replaces it with the parent chunk

**Schema (from migration `20251024_add_chunk_augmentation.sql`):**
```sql
ALTER TABLE chunks ADD COLUMN chunk_type VARCHAR(50) DEFAULT 'ORIGINAL';
ALTER TABLE chunks ADD COLUMN parent_chunk_id UUID REFERENCES chunks(id);
```

**Cost:** ~$0.01-0.02 per chunk for question generation (5 questions × gpt-4o-mini)

**Philosophy (from docstring):**
> "HyDE hallucinates facts (especially for acronyms). Instead, generate questions FROM the actual document content."

**Problem:** While better than HyDE, this still:
- Adds LLM cost at ingestion time
- Increases index size (5x more chunks)
- Adds complexity to retrieval (must replace questions with parents)
- Questions may not match user's actual phrasing

---

## Graph Behavior

### Graph Extraction (Ingestion)

**Location:** `apps/backend/ingest/processors/graph_extractor.py`

**Triggered by:** `ENABLE_GRAPH_EXTRACTION=true` (default: TRUE)

**How it works:**
1. For each chunk, extracts entities and relationships via LLM
2. Deduplicates entities using pgvector similarity (0.85 threshold)
3. Stores in `entities` and `relationships` tables
4. Generates embeddings for entity descriptions

**Cost:** ~$0.03-0.10 per document in LLM calls + 30-60 seconds processing time

### Graph Search (Query)

**Location:** `apps/web/lib/graph/graph-search.ts`

**Triggered by:** 
- `search.useGraphSearch=true` (default: TRUE)
- AND `isRelationshipQuery(query)` returns true (keyword detection)

**How it works:**
1. `isRelationshipQuery()` checks for keywords like "how does", "related to", "connection"
2. If triggered, calls `graphEnhancedSearch()`
3. Searches entities semantically
4. Traverses relationships (1-3 hops)
5. Collects chunk IDs from related entities
6. Adds those chunks to search results

**Problem:** Only helps for relationship queries (small subset). Adds noise for factual queries.

---

## Key Files Involved

### Ingestion
| File | Purpose | LLM Calls |
|------|---------|-----------|
| `main.py` | Pipeline orchestration | None |
| `structure_aware_chunker.py` | Base chunking | None |
| `document_augmentation_chunker.py` | Question generation | Yes (5 per chunk) |
| `embeddings_generator.py` | Embedding generation | Yes (OpenAI) |
| `graph_extractor.py` | Entity extraction | Yes (per chunk) |

### Query
| File | Purpose | LLM Calls |
|------|---------|-----------|
| `api/search/route.ts` | Search orchestration | HyDE + Multi-Query |
| `lib/graph/graph-search.ts` | Graph traversal | None |
| `lib/ai/prompts.ts` | Prompt templates | N/A |
| `lib/ai/tools-fixed.ts` | Chat tools | Calls search API |

### Schema
| Migration | Purpose |
|-----------|---------|
| `20241015_create_chunks_table.sql` | Base chunks table |
| `20251024_add_chunk_augmentation.sql` | chunk_type, parent_chunk_id |
| `20251016_graph_rag_schema.sql` | entities, relationships tables |
| `20251017_create_system_settings.sql` | Settings with defaults |

---

## Settings Summary

| Setting | Default | Location | Purpose |
|---------|---------|----------|---------|
| `search.useHyDE` | `true` | DB + route.ts | Enable HyDE at query time |
| `search.useMultiQuery` | `true` | DB + route.ts | Enable multi-query at query time |
| `search.useReranking` | `true` | DB + route.ts | Enable Cohere reranking |
| `search.useGraphSearch` | `true` | DB + route.ts + main.py | Enable graph search + extraction |
| `processing.enableDocumentAugmentation` | `true` | main.py | Enable question generation |
| `processing.questionsPerChunk` | `5` | main.py | Questions per chunk |

---

## Summary of What Needs to Change

### Phase 2: Remove HyDE and Question Augmentation ✅ COMPLETED

**Changes Made:**
1. ✅ Removed `generateHyDE()` and all HyDE code paths from search route
2. ✅ Removed `shouldUseHyDE()` complexity detection
3. ✅ Changed `ENABLE_DOCUMENT_AUGMENTATION` default to `false` in `main.py`
4. ✅ Changed `ENABLE_GRAPH_EXTRACTION` default to `false` in `main.py`
5. ✅ Updated search to filter out `AUGMENTED_QUESTION` chunks at search time
6. ✅ Simplified search route from 731 lines to ~400 lines
7. ✅ Simplified tools from 3 search tools to 2 core + 1 optional graph
8. ✅ Marked HyDE and multiQuery prompts as deprecated

**New Search Pipeline:**
```
Query → Embed → Hybrid Search → [Optional: Graph] → Rerank → Return
```

**New Defaults:**
- `search.useReranking`: `true` (high-value, low-risk)
- `search.useGraphSearch`: `false` (optional, enable if needed)
- `search.useMultiQuery`: `false` (removed from core)
- `processing.enableDocumentAugmentation`: `false`

### Phase 3: Structural Hierarchy ⏸️ DEFERRED

**Current State:** The `StructureAwareChunker` already stores good metadata:
- `section_title` - heading text
- `section_level` - heading level (1-6)
- `chunk_type` - "section"
- `paragraph_count` - number of paragraphs

**Deferred Work:** Adding parent-child relationships between chunks would add complexity without clear immediate benefit. The current structure is sufficient for the 80% use case.

**Future Enhancement (if needed):**
1. Track parent sections during chunking
2. Store `parent_chunk_id` for hierarchical chunks
3. Add retrieval step to fetch parent/sibling chunks for context expansion

### Phase 4: Tighten GraphRAG
1. ✅ Changed `ENABLE_GRAPH_EXTRACTION` default to `false`
2. ✅ Changed `search.useGraphSearch` default to `false`
3. Keep code but isolate it clearly

### Phase 5: Refactor Search ✅ COMPLETED (Simplified)

**Current State:** The search route is now ~400 lines, well-organized with clear sections:
- Settings loading
- Reranking function
- Types
- Main POST handler (numbered steps 1-9)

**Decision:** Further modularization (extracting to `lib/search/`) would be over-engineering. The current file is:
- Clear - single path, no branching
- Documented - good comments explaining each step
- Maintainable - easy to understand and modify

**Future Enhancement (if needed):**
1. Extract reranking to `lib/search/rerank.ts`
2. Extract settings to `lib/search/settings.ts`
3. Create `lib/search/index.ts` with core search function
