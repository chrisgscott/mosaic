# Simplified RAG Pipeline

**Date**: November 28, 2025  
**Status**: Active  
**Branch**: `refactor/simplify-rag-core`

---

## Overview

Mosaic's RAG pipeline has been simplified to focus on the 80% use case: **fast, accurate document retrieval with high-quality reranking**.

### Core Pipeline

```
User Query
    ↓
┌─────────────────┐
│  1. Embed Query │  OpenAI text-embedding-3-small
└────────┬────────┘
         ↓
┌─────────────────┐
│  2. Hybrid      │  Semantic (pgvector) + BM25 (pg_trgm)
│     Search      │  Combined via RRF (k=60)
└────────┬────────┘
         ↓
┌─────────────────┐
│  3. Rerank      │  Cohere rerank-english-v3.0
└────────┬────────┘
         ↓
    Results (top N)
```

### Optional Features (Off by Default)

- **Graph Search**: Entity-based retrieval for relationship queries
- **Multi-Query**: Query expansion for complex questions

---

## Design Principles

### 1. Simple by Default

The core pipeline has **no LLM calls** except for embedding. This means:
- Predictable latency (~500-800ms)
- Predictable cost (embedding + reranking only)
- No hallucination risk in retrieval

### 2. Opt-In Complexity

Advanced features are available but disabled by default:
- Enable via admin settings when needed
- Each feature adds latency and cost
- Users should understand the tradeoff

### 3. Quality Over Quantity

We prioritize **retrieval quality** over retrieval quantity:
- Hybrid search (semantic + keyword) catches more relevant chunks
- Cohere reranking dramatically improves result ordering
- Fewer, better results > many mediocre results

---

## Components

### Ingestion Pipeline

```
Document Upload
    ↓
┌─────────────────┐
│  DoclingProcessor│  VLM-powered extraction (gpt-4o)
│  (VLM)          │  Handles PDFs, images, tables
└────────┬────────┘
         ↓
┌─────────────────┐
│  StructureAware │  Respects document structure
│  Chunker        │  ~1000 chars per chunk
└────────┬────────┘
         ↓
┌─────────────────┐
│  Embeddings     │  text-embedding-3-small
│  Generator      │  1536 dimensions
└────────┬────────┘
         ↓
    Supabase (chunks table)
```

**Optional Ingestion Features (Off by Default):**
- Graph Extraction: Entity/relationship extraction
- Document Augmentation: Question generation per chunk

### Query Pipeline

```
/api/search POST
    ↓
┌─────────────────┐
│  Authenticate   │  Cookie or API key
└────────┬────────┘
         ↓
┌─────────────────┐
│  Load Settings  │  From system_settings table
└────────┬────────┘
         ↓
┌─────────────────┐
│  Embed Query    │  text-embedding-3-small
└────────┬────────┘
         ↓
┌─────────────────┐
│  Hybrid Search  │  search_chunks_hybrid RPC
│  (Supabase)     │  Semantic + BM25 + RRF
└────────┬────────┘
         ↓
┌─────────────────┐
│  [Optional]     │  If useGraphSearch=true
│  Graph Search   │  AND relationship query detected
└────────┬────────┘
         ↓
┌─────────────────┐
│  Rerank         │  Cohere rerank-english-v3.0
│  (Cohere)       │  If useReranking=true
└────────┬────────┘
         ↓
    JSON Response
```

### Chat Interface

```
User Message
    ↓
┌─────────────────┐
│  Tool Selection │  LLM decides which tool to use
│  (Agentic)      │  search_documents or quick_search
└────────┬────────┘
         ↓
┌─────────────────┐
│  Search API     │  /api/search
└────────┬────────┘
         ↓
┌─────────────────┐
│  Generate       │  LLM generates answer with citations
│  Response       │  Using retrieved context
└────────┬────────┘
         ↓
    Streamed Response
```

---

## Settings Reference

### Search Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `search.useReranking` | `true` | Enable Cohere reranking |
| `search.useGraphSearch` | `false` | Enable graph-enhanced search |
| `search.useMultiQuery` | `false` | Enable query expansion (deprecated) |

### Processing Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `processing.enableDocumentAugmentation` | `false` | Generate questions per chunk |
| `processing.questionsPerChunk` | `5` | Questions to generate (if enabled) |

---

## Removed Features

The following features were removed from the core pipeline:

### HyDE (Hypothetical Document Embeddings)

**What it was:** Generate a hypothetical answer to the query, then search using that answer's embedding.

**Why removed:**
- Added ~500ms latency (LLM call)
- Caused hallucinations with domain-specific acronyms
- Marginal improvement didn't justify complexity

### Query Complexity Detection

**What it was:** Detect "complex" queries and apply HyDE/multi-query only to those.

**Why removed:**
- Added code complexity
- Unpredictable behavior (sometimes applied, sometimes not)
- Better to have consistent, predictable pipeline

### Augmented Question Processing

**What it was:** At query time, if a generated question matched, replace it with the parent chunk.

**Why removed:**
- Added complexity to search logic
- Now filtered at search time (simpler)
- Document augmentation itself is off by default

---

## File Reference

### Core Files

| File | Purpose |
|------|---------|
| `app/api/search/route.ts` | Search API endpoint (~400 lines) |
| `lib/ai/tools-fixed.ts` | Agentic search tools |
| `lib/graph/graph-search.ts` | Graph-enhanced search (optional) |

### Ingestion Files

| File | Purpose |
|------|---------|
| `apps/backend/ingest/main.py` | Pipeline orchestration |
| `chunkers/structure_aware_chunker.py` | Document chunking |
| `processors/embeddings_generator.py` | Embedding generation |
| `processors/graph_extractor.py` | Entity extraction (optional) |

### Database

| Table | Purpose |
|-------|---------|
| `documents` | Document metadata |
| `chunks` | Text chunks with embeddings |
| `entities` | Knowledge graph entities (optional) |
| `relationships` | Entity relationships (optional) |
| `system_settings` | Configuration |

---

## Performance Characteristics

### Typical Latency

| Step | Time |
|------|------|
| Embedding | ~100ms |
| Hybrid Search | ~200-400ms |
| Reranking | ~200-300ms |
| **Total** | **~500-800ms** |

### With Graph Search

| Step | Time |
|------|------|
| Base pipeline | ~500-800ms |
| Graph search | +200-500ms |
| **Total** | **~700-1300ms** |

### Cost Per Query

| Component | Cost |
|-----------|------|
| Embedding | ~$0.0001 |
| Reranking | ~$0.001 |
| **Total** | **~$0.001** |

---

## Future Enhancements

These are documented but not implemented:

1. **Parent-Child Chunk Expansion**: Fetch parent/sibling chunks for more context
2. **Streaming Search**: Stream results as they're found
3. **Search Analytics**: Track query patterns and result quality
4. **Adaptive Reranking**: Adjust reranking based on query type
