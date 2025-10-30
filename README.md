# Mosaic - Living Knowledge Platform

**Transform documents into living, structured knowledge.**

Mosaic is not just another RAG system - it's a **living knowledge platform** that transforms scattered documents into comprehensive, always-current, structured knowledge pages. Built on a multifloor architecture, it enables deep reasoning across text, entities, and curated knowledge.

## 🎯 The Vision

When a user asks: *"What do I need to know about Antimony for a 40-ton purchase?"*

They don't get 50 scattered search results. They get:
- **A comprehensive Living Entity page** with structured sections (supply chain, pricing, geopolitics, applications)
- **Full traceability** via multifloor bridges (entity → chunks → documents)
- **Always current** - auto-updated as new information arrives
- **Explorable relationships** - navigate to suppliers, mines, technologies

## 🏗️ Multifloor Architecture

Mosaic uses a **multifloor traversal framework** - a topic-agnostic system supporting multi-hop reasoning and layered data:

```
┌─────────────────────────────────────────────────┐
│ Floor D: Living Entities                        │
│ Curated, structured knowledge pages             │
│ (Materials, Suppliers, Technologies, etc.)      │
└──────────────┬──────────────────────────────────┘
               ↕ bridges
┌─────────────────────────────────────────────────┐
│ Floor B: Graph Entities                         │
│ Auto-extracted entities & relationships         │
│ (11 entity types, 12 relationship types)        │
└──────────────┬──────────────────────────────────┘
               ↕ bridges
┌─────────────────────────────────────────────────┐
│ Floor A: Chunks                                 │
│ Text chunks with vector embeddings              │
│ (Structure-aware, semantic search)              │
└──────────────┬──────────────────────────────────┘
               ↕ bridges
┌─────────────────────────────────────────────────┐
│ Floor C: Documents                              │
│ Original files with full provenance             │
│ (Docling VLM processing, audit trail)           │
└─────────────────────────────────────────────────┘
```

**Trail Engine** enables multi-hop traversal across all floors for complex queries.

## ✨ Core Features

### Production-Ready (Phases 1-8 Complete)
- **Docling VLM Processing** - 20-40x faster than alternatives
- **Smart Chunking** - Structure-aware (simple, fast, free) + Agentic options
- **Graph RAG** - Selective entity extraction (3-7 per chunk, optimized)
- **Hybrid Search** - Semantic + BM25 with RRF, Cohere reranking
- **Vector Search** - pgvector with 0.85 similarity deduplication
- **Graph Management** - Full CRUD UI, visualization, AI cleanup
- **Settings System** - Database-driven models and prompts
- **Real-time Updates** - Supabase Realtime for processing status

### Next: The Killer Features
- **Multifloor Architecture** (3-5 days) - Foundation for everything
- **DEG-RAG** (1-2 weeks) - Graph denoising for quality
- **Living Entities** (2-3 weeks) - Curated knowledge pages with CrewAI auto-updates

## 🚀 Quick Links

- **[Master Plan](./PLAN.md)** - Current priorities and roadmap
- **[Synthesis](./SYNTHESIS.md)** - Executive summary of vision and architecture
- **[Orientation](./ORIENTATION.md)** - Complete project overview
- **[Living Entities](./LIVING_ENTITIES_SUMMARY.md)** - The killer feature explained
- **[Documentation](./docs)** - Technical details and guides
