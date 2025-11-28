# Mosaic - Universal Knowledge Platform

**Transform documents into searchable, intelligent knowledge.**

Mosaic is a production-ready knowledge platform that transforms scattered documents into a unified, searchable knowledge base. Built for flexibility and scale, it provides semantic search, graph-based exploration, and API-first access for any application or workflow.

## 🎯 What It Does

When you ask: *"What are the strategic airlift requirements?"*

You get:
- **Semantic search results** with relevance scores
- **Context-aware responses** using advanced RAG techniques
- **Graph-based exploration** of related concepts
- **API access** for external tool integration
- **Real-time processing** with progress tracking

## 🏗️ Architecture

Mosaic uses a **layered knowledge architecture** supporting multiple retrieval strategies:

```
┌─────────────────────────────────────────────────┐
│ API Layer                                       │
│ Universal search endpoint for external tools    │
│ (REST API, authentication, feature control)    │
└──────────────┬──────────────────────────────────┘
               ↕
┌─────────────────────────────────────────────────┐
│ Search Layer                                    │
│ Hybrid search + Reranking + Multi-Query         │
│ (Semantic, BM25, Graph, HyDE)                  │
└──────────────┬──────────────────────────────────┘
               ↕
┌─────────────────────────────────────────────────┐
│ Knowledge Layer                                 │
│ Chunks + Entities + Relationships               │
│ (Vector embeddings, graph search)               │
└──────────────┬──────────────────────────────────┘
               ↕
┌─────────────────────────────────────────────────┐
│ Document Layer                                  │
│ Original files with processing metadata         │
│ (Docling VLM, chunking, provenance)            │
└─────────────────────────────────────────────────┘
```

## ✨ Core Features

### Production-Ready
- **Universal API** - RESTful search with authentication and feature control
- **Hybrid Search** - Semantic + BM25 with Cohere reranking
- **Smart Chunking** - Structure-aware with multiple strategies
- **Graph RAG** - Entity extraction and relationship mapping
- **Real-time Processing** - Async document processing with progress tracking
- **Settings System** - Database-driven configuration
- **Multi-tenant** - Row-level security and user isolation

### Advanced Features
- **Multi-Query Expansion** - Generate query variations for comprehensive results
- **HyDE** - Hypothetical document embeddings for complex queries
- **Graph Search** - Navigate entity relationships and connections
- **Feature Control** - External tools control search features (speed vs quality)

## 🚀 Quick Start

### For Web Users
1. Upload documents via the web interface
2. Search with natural language queries
3. Explore results with semantic and graph-based navigation

### For Developers
1. Use the universal `/api/search` endpoint
2. Control features via request parameters
3. Build custom applications on top of Mosaic

**[API Documentation](./docs/API.md)** - Complete integration guide

## 🚀 Quick Links

- **[API Documentation](./docs/API.md)** - Integration guide for external tools
- **[Documentation](./docs)** - Technical details and guides
- **[Architecture](./docs/architecture)** - System design and patterns
