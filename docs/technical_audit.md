# Mosaic Technical Audit

**Date**: November 28, 2025  
**Auditor**: Senior Staff Engineer Review  
**Scope**: Full codebase architecture analysis

---

## SECTION 1 — High-Level Summary

### What Mosaic *Actually Is* Today

Mosaic is a **production-ready RAG application** with a clean Supabase-centric architecture. It consists of:

1. **A document ingestion pipeline** (Python backend with Docling VLM, structure-aware chunking, embeddings)
2. **A hybrid search engine** (semantic + BM25 with Cohere reranking)
3. **A chat interface** (Vercel AI SDK with agentic tool selection)
4. **A knowledge graph system** (entity/relationship extraction, graph-enhanced search)
5. **An admin dashboard** (document management, entity management, settings)
6. **Multi-tenant infrastructure** (RLS, user isolation, API authentication)

### What It's Trying to Be

Based on architecture docs (`01_core_principles.md`), Mosaic aspires to be a **"multifloor traversal framework"**:
- Floor A: Text Semantics (embeddings)
- Floor B: Knowledge Graph (entities/relationships)
- Floor C: Structure & Provenance (documents/chunks)
- Floor D: Living Entities (curated knowledge pages)

### The Gap

**Floor D ("Living Entities") is documented but not implemented.** The "multifloor" vision is aspirational, not operational. The system is currently a solid RAG pipeline with an optional knowledge graph layer.

### The Good News

Unlike many projects with architectural debt, Mosaic's **core is clean**. The complexity is concentrated in **optional features** (7 unused chunkers, conditional RAG enhancements) rather than the critical path. The path to a shippable product is subtraction, not rewriting.

---

## SECTION 2 — Architecture Map

### Project Structure

```
mosaic/
├── apps/
│   ├── backend/ingest/          # Python document processing worker
│   │   ├── main.py              # Queue worker (pgmq polling)
│   │   ├── processors/          # Docling, embeddings, graph extraction
│   │   └── chunkers/            # 9 files, only 2 used
│   └── web/                     # Next.js frontend + API
│       ├── app/api/             # REST endpoints (search, chat, documents)
│       ├── lib/ai/              # Model gateway, prompts, tools
│       ├── lib/graph/           # Graph search (TS entity-extraction unused)
│       └── components/          # React UI components
├── supabase/
│   ├── migrations/              # 26 SQL migrations
│   └── functions/               # Edge functions (NOT USED)
└── docs/                        # Architecture docs, guides
```

### Data Flow

#### Ingestion Pipeline
```
Upload → Supabase Storage → pgmq queue → Python worker
                                              ↓
                                  DoclingProcessor (VLM extraction)
                                              ↓
                                  StructureAwareChunker
                                              ↓
                              [Optional] DocumentAugmentationChunker
                                              ↓
                                  EmbeddingsGenerator (OpenAI)
                                              ↓
                              [Optional] GraphExtractor (entities/relationships)
                                              ↓
                                  Supabase (chunks, embeddings, entities)
```

#### Query Pipeline
```
User Query → /api/search
                ↓
    ┌─────────────────────────────────────────────────┐
    │ [If complex query + settings enabled]           │
    │ - HyDE (hypothetical document generation)       │
    │ - Multi-Query (3 query variations)              │
    └─────────────────────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────┐
    │ Hybrid Search (always runs)                     │
    │ - Semantic search (pgvector cosine)             │
    │ - BM25 keyword search (ts_rank)                 │
    │ - RRF fusion                                    │
    └─────────────────────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────┐
    │ [If relationship query + settings enabled]      │
    │ - Entity semantic search                        │
    │ - 1-hop relationship traversal                  │
    │ - Chunk ID collection                           │
    └─────────────────────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────┐
    │ Cohere Reranking (when enabled)                 │
    └─────────────────────────────────────────────────┘
                ↓
            Results
```

#### Chat Pipeline
```
User Message → /api/chat
                ↓
    Load previous messages from DB
                ↓
    streamText() with tools:
    - search_documents (comprehensive)
    - quick_search (fast, skips enhancements)
    - deep_graph_search (extended graph traversal)
    - web_search (optional, Tavily)
                ↓
    AI decides which tool(s) to call
                ↓
    Tool calls /api/search internally
                ↓
    Stream response + save to DB
```

### Key Dependencies

| Component | Technology | Status |
|-----------|------------|--------|
| Database | Supabase (Postgres + pgvector) | ✅ Core |
| Queue | pgmq | ✅ Core |
| Document Processing | Docling + OpenAI VLM | ✅ Core |
| Embeddings | OpenAI text-embedding-3-small | ✅ Core |
| LLM | OpenAI (gpt-4o-mini, gpt-4o, gpt-4.1-nano) | ✅ Core |
| Reranking | Cohere rerank-english-v3.0 | ✅ Core |
| Frontend | Next.js 15 + Vercel AI SDK | ✅ Core |
| Edge Functions | Supabase Functions | ❌ Not used |

---

## SECTION 3 — Problem Areas

### 1. **Dead Code: 7 Unused Chunkers** (Severity: MEDIUM)

**Location**: `apps/backend/ingest/chunkers/`

**What's actually used** (imported in `main.py`):
- `structure_aware_chunker.py` ✅
- `document_augmentation_chunker.py` ✅

**What's NOT used** (never imported in production code):
- `agentic_chunker.py` - Only in test files
- `planner_executor_chunker.py` - Only in test files
- `sorting_hat.py` - Never imported
- `custom_boundary_chunker.py` - Only in test files
- `markdown_chunker.py` - Never imported
- `chunk_refiner.py` - Explicitly disabled via migration
- `hybrid_chunker.py` - Internal to structure_aware, not directly used

**Impact**: Cognitive load, maintenance burden, confusion about which chunker to use.

**Recommendation**: Delete all 7 unused chunkers. Keep only `structure_aware_chunker.py` and `document_augmentation_chunker.py`.

### 2. **Duplicate Tool Files** (Severity: LOW)

**Location**: `apps/web/lib/ai/`

- `tools.ts` - Old version, not imported
- `tools-fixed.ts` - Active version, imported in `chat/route.ts`

**Recommendation**: Delete `tools.ts`.

### 3. **Orphaned TypeScript Entity Extraction** (Severity: LOW)

**Location**: `apps/web/lib/graph/entity-extraction.ts`

This 389-line file is only used by `/api/graph/extract/route.ts`, which is **never called from the UI**. The Python `graph_extractor.py` handles all entity extraction during ingestion.

**Recommendation**: Delete both `entity-extraction.ts` and `api/graph/extract/route.ts`.

### 4. **Unused Supabase Edge Functions** (Severity: LOW)

**Location**: `supabase/functions/`

- `process-documents/index.ts` - Stub with TODO comments, never deployed
- `search/index.ts` - Duplicate of Next.js API route, never called

**Recommendation**: Delete both edge functions.

### 5. **Monolithic Search Route** (Severity: MEDIUM)

**Location**: `apps/web/app/api/search/route.ts` (731 lines)

Single file handles: authentication, settings, HyDE, multi-query, embeddings, hybrid search, graph search, augmented question processing, reranking, progress streaming, signal logging.

**Impact**: Hard to test, hard to modify, hard to understand.

**Recommendation**: Extract into modular components in `lib/search/`.

### 6. **GraphRAG Maintenance Burden** (Severity: MEDIUM-HIGH)

The knowledge graph system requires significant UI for cleanup:
- `cleanup-graph-dialog.tsx` (20KB)
- `cleanup-graph-page.tsx` (27KB)
- `noise-cleanup-page.tsx` (13KB)
- `merge-entities-dialog.tsx` (10KB)

This indicates the extraction produces noise that requires manual intervention.

**Recommendation**: Make graph extraction opt-in per document, not default-on.

### 7. **Settings Sprawl** (Severity: LOW)

Settings are controlled via:
- Database (`system_settings` table)
- Environment variables (`.env`)
- Hardcoded defaults in code

The Python backend has hardcoded prompts that don't sync with database prompts.

**Recommendation**: Consolidate to database-first with ENV fallbacks. Add Python settings integration for prompts.

---

## SECTION 4 — GraphRAG Evaluation

### Current Implementation

1. **Ingestion-time extraction** (`graph_extractor.py`):
   - LLM extracts 3-7 entities per chunk
   - Entities get embeddings for semantic search
   - Deduplication via pgvector similarity (0.85 threshold)
   - Parallel processing (5 workers)
   - **Runs by default** when `ENABLE_GRAPH_EXTRACTION=true`

2. **Query-time search** (`graph-search.ts`):
   - Keyword detection for "relationship queries"
   - Semantic entity search via pgvector
   - 1-hop relationship traversal
   - Chunk ID collection for context
   - **Only runs for relationship queries** (keyword matching)

3. **UI Management**:
   - Entity list, details, editing
   - Relationship management
   - Cleanup tools (60KB+ of code)

### Is It Helping?

**Marginally, for a narrow subset of queries.**

Graph search only triggers for queries containing relationship keywords ("how does", "related to", "connection", etc.). For most factual queries, it's bypassed entirely.

When triggered, it can help queries like "How is Company A connected to Company B?" but adds no value for "What is the strategic airlift requirement?"

### Is It Hurting?

**Yes, in three ways:**

1. **Ingestion Cost**: Every document pays the graph extraction tax:
   - ~$0.03-0.10 per document in LLM calls
   - 30-60 seconds additional processing time
   - Entity embeddings (separate from chunk embeddings)

2. **Noise Accumulation**: The extractor produces:
   - Generic entities ("production", "supply chains")
   - Duplicate entities (slight name variations)
   - Low-quality relationships
   - **Evidence**: 60KB+ of cleanup UI code exists because manual intervention is required

3. **Maintenance Burden**: 
   - Complex deduplication logic
   - Entity type/relationship type management
   - User confusion about what entities mean

### Verdict

**GraphRAG is a net negative in its current default-on configuration.**

The implementation is technically sound (follows R2R patterns, uses pgvector efficiently), but the ROI is negative for most use cases:
- High cost (time, money, maintenance)
- Low benefit (only helps relationship queries)
- Creates noise that requires cleanup

**Recommendation**: Change `ENABLE_GRAPH_EXTRACTION` default to `false`. Make it opt-in per document collection for users who specifically need relationship queries.

---

## SECTION 5 — Recommended Refactor Plan

### DELETE (Dead Code)

| Item | Location | Reason |
|------|----------|--------|
| `agentic_chunker.py` | `chunkers/` | Never imported in production |
| `planner_executor_chunker.py` | `chunkers/` | Never imported in production |
| `sorting_hat.py` | `chunkers/` | Never imported |
| `custom_boundary_chunker.py` | `chunkers/` | Never imported in production |
| `markdown_chunker.py` | `chunkers/` | Never imported |
| `chunk_refiner.py` | `chunkers/` | Explicitly disabled |
| `hybrid_chunker.py` | `chunkers/` | Not directly used |
| `tools.ts` | `lib/ai/` | Superseded by `tools-fixed.ts` |
| `entity-extraction.ts` | `lib/graph/` | Never called from UI |
| `api/graph/extract/route.ts` | `app/api/` | Endpoint never used |
| `process-documents/` | `supabase/functions/` | Stub, never deployed |
| `search/` | `supabase/functions/` | Duplicate, never called |

### DISABLE BY DEFAULT

| Item | Current Default | Recommendation |
|------|-----------------|----------------|
| Graph Extraction | `ENABLE_GRAPH_EXTRACTION=true` | Change to `false` |
| Document Augmentation | Enabled | Consider disabling (adds LLM cost) |
| HyDE | `search.useHyDE=true` | Keep enabled (low cost, conditional) |
| Multi-Query | `search.useMultiQuery=true` | Keep enabled (low cost, conditional) |

### EXTRACT / REFACTOR

| Item | Current State | Target State |
|------|---------------|--------------|
| Search route | 731-line monolith | Modular `lib/search/` with separate files for HyDE, multi-query, hybrid search, reranking |
| Settings | Split Python/TypeScript | Unified database-first with Python integration |

### KEEP AND STABILIZE

| Item | Why Keep |
|------|----------|
| `StructureAwareChunker` | Default, reliable, works well |
| `DocumentAugmentationChunker` | Optional wrapper, adds value when enabled |
| `DoclingProcessor` | Core value, excellent VLM extraction |
| `EmbeddingsGenerator` | Core functionality |
| `GraphExtractor` | Keep code, just disable by default |
| Hybrid Search (RRF) | Core search, always used |
| Cohere Reranking | High ROI, proven technique |
| `tools-fixed.ts` | Active chat tools |
| `graph-search.ts` | Used at query time when enabled |
| Vercel AI SDK chat | Modern, works well |
| Supabase + pgvector | Solid foundation |
| RLS multi-tenancy | Security essential |

### ADD (Only if High ROI)

| Item | Effort | ROI | Recommendation |
|------|--------|-----|----------------|
| Search quality metrics | Low | High | Add logging to measure search quality |
| Ingestion cost tracking | Low | Medium | Track LLM costs per document |
| Rename `tools-fixed.ts` → `tools.ts` | Trivial | Low | Clean up naming after deleting old file |

---

## SECTION 6 — Build-Forward Strategy

### The Core Question

Should Mosaic:
1. Become a **standalone RAG foundation** (engine)?
2. Become an **app built on an external RAG engine**?
3. **Split into both** (core engine + Mosaic UX)?

### Recommendation: **Option 1 — Standalone RAG Foundation (Simplified)**

### Justification

1. **The RAG core is already solid**: 
   - Docling extraction works well
   - Hybrid search with RRF is proven
   - Cohere reranking is high-ROI
   - Supabase + pgvector is a clean foundation
   - The critical path has no major issues

2. **The complexity is in optional features**:
   - 7 unused chunkers can be deleted
   - GraphRAG can be disabled by default
   - HyDE/Multi-Query are already conditional
   - The core pipeline is clean

3. **External RAG engines don't fit**:
   - Mosaic's value is the integrated Supabase architecture with RLS
   - The Docling VLM pipeline is custom and valuable
   - Replacing this with an external engine would require rewriting everything

4. **The "Living Entities" vision is premature**:
   - Floor D is documented but not implemented
   - Building it now would add complexity without proven value
   - Focus on shipping the working core first

### Concrete Strategy

#### Phase 1: Clean Up (1-2 days)

1. Delete 7 unused chunkers
2. Delete `tools.ts`, `entity-extraction.ts`, unused API route
3. Delete unused Supabase edge functions
4. Change `ENABLE_GRAPH_EXTRACTION` default to `false`
5. Rename `tools-fixed.ts` → `tools.ts`

#### Phase 2: Stabilize (1 week)

1. Refactor search route into modular components
2. Add search quality metrics
3. Document the simplified architecture
4. Test the core pipeline thoroughly

#### Phase 3: Ship (Ongoing)

1. Deploy with confidence
2. Measure actual usage of optional features
3. Re-enable GraphRAG only if relationship queries are common
4. Consider Living Entities only if there's clear user demand

### What Mosaic Should Become

**A focused, production-ready RAG platform** that:
- Ingests documents reliably (Docling + structure-aware chunking)
- Searches effectively (hybrid search + reranking)
- Answers questions accurately (Vercel AI SDK chat)
- Scales securely (Supabase + RLS)

**Not**:
- A research project for every RAG technique
- A knowledge graph platform (unless proven valuable)
- A multi-floor traversal framework (aspirational, not operational)

### Final Word

Mosaic has good bones. The Supabase-centric architecture, Docling integration, and Vercel AI SDK chat are solid. The problem is accumulated optional features that were built but never pruned.

**The path forward is subtraction, not addition.**

Delete the dead code, disable the expensive defaults, prove the core works reliably, then add features based on measured user need — not theoretical value.

---

## Appendix: Feature Usage Matrix

### Chunkers (2 of 9 used)

| File | Status | Evidence |
|------|--------|----------|
| `structure_aware_chunker.py` | ✅ USED | Imported in `main.py` line 18 |
| `document_augmentation_chunker.py` | ✅ USED | Imported in `main.py` line 19 |
| `agentic_chunker.py` | ❌ NOT USED | Only in test files |
| `planner_executor_chunker.py` | ❌ NOT USED | Only in test files |
| `sorting_hat.py` | ❌ NOT USED | Never imported |
| `custom_boundary_chunker.py` | ❌ NOT USED | Only in test files |
| `markdown_chunker.py` | ❌ NOT USED | Never imported |
| `chunk_refiner.py` | ❌ DISABLED | Migration 20251023 |
| `hybrid_chunker.py` | ❌ NOT USED | Internal to structure_aware |

### RAG Techniques (All used, conditionally)

| Technique | Status | Condition |
|-----------|--------|-----------|
| Hybrid Search (RRF) | ✅ Always | Core search function |
| Cohere Reranking | ✅ When enabled | `search.useReranking=true` |
| HyDE | ✅ When enabled + complex | `search.useHyDE=true` + 5+ words |
| Multi-Query | ✅ When enabled + complex | `search.useMultiQuery=true` + 5+ words |
| Graph Search | ✅ When enabled + relationship | `search.useGraphSearch=true` + keywords |
| Graph Extraction | ✅ When enabled | `ENABLE_GRAPH_EXTRACTION=true` |
| Document Augmentation | ✅ When enabled | `processing.enableDocumentAugmentation` |

### Other Dead Code

| Item | Status | Evidence |
|------|--------|----------|
| `tools.ts` | ❌ NOT USED | Superseded by `tools-fixed.ts` |
| `entity-extraction.ts` | ❌ NOT USED | Only used by unused API route |
| `api/graph/extract/route.ts` | ❌ NOT USED | Never called from UI |
| `supabase/functions/process-documents` | ❌ NOT USED | Stub with TODOs |
| `supabase/functions/search` | ❌ NOT USED | Duplicate of Next.js route |
