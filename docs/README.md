# Mosaic Documentation

**Welcome to the Mosaic RAG Platform documentation.** This hub provides access to all project documentation, organized by purpose and maintained as Single Sources of Truth (SSoT).

---

## 🚀 Quick Start

### New to Mosaic?
1. **[Getting Started Guide](./guides/getting_started.md)** - Set up your development environment
2. **[Architecture SSoT](./architecture/SSOT.md)** - Understand the system design
3. **[Features SSoT](./features/SSOT.md)** - Explore implemented and planned features
4. **[BUILD_PLAN.md](../BUILD_PLAN.md)** - View the development roadmap

### For Users
- **[Getting Started Guide](./guides/getting_started.md)** - Setup and basic usage
- **[Features SSoT](./features/SSOT.md)** - Learn about available features

### For Developers
- **[Getting Started Guide](./guides/getting_started.md)** - Development setup
- **[Architecture SSoT](./architecture/SSOT.md)** - System architecture
- **[Reference SSoT](./reference/SSOT.md)** - Technical references

---

## 📚 Documentation Structure

### Single Sources of Truth (SSoT)
These are the authoritative documents that synthesize information from multiple sources.

| SSoT | Purpose | Last Updated |
|-----|---------|--------------|
| **[Architecture SSoT](./architecture/SSOT.md)** | System design, principles, and technical architecture | Oct 30, 2025 |
| **[Features SSoT](./features/SSOT.md)** | Complete feature documentation and implementation status | Oct 30, 2025 |
| **[Guides SSoT](./guides/SSOT.md)** | User and developer guides (hub document) | Oct 30, 2025 |
| **[Reference SSoT](./reference/SSOT.md)** | Technical references and implementation guides | Oct 30, 2025 |
| **[Completed SSoT](./completed/SSOT.md)** | Archive of completed implementations | Oct 30, 2025 |

### Core Documentation Areas

#### 🏗️ [Architecture](./architecture/)
System design and technical architecture
- **SSoT:** [Architecture SSoT](./architecture/SSOT.md) - Complete architecture reference
- [Core Principles](./architecture/01_core_principles.md) - Multifloor model fundamentals
- [Ingestion Pipeline](./architecture/02_ingestion_pipeline.md) - Document processing flow

#### ⚡ [Features](./features/)
Implemented and planned features
- **SSoT:** [Features SSoT](./features/SSOT.md) - All feature documentation
- [Agentic Chunking](./features/agentic_chunking.md) - Advanced document chunking
- [Graph RAG](./features/graph_rag.md) - Knowledge extraction and search
- [Graph Learning](./features/graph-learning.md) - Search pattern analysis
- [Reranking](./features/reranking.md) - Search precision improvement
- [Structured Data](./features/structured-data-approch.md) - Table handling strategy

#### 📖 [Guides](./guides/)
User and developer documentation
- **SSoT:** [Guides SSoT](./guides/SSOT.md) - Guide hub and standards
- [Getting Started](./guides/getting_started.md) - Development setup and onboarding

#### 📋 [Reference](./reference/)
Technical references and implementation guides
- **SSoT:** [Reference SSoT](./reference/SSOT.md) - Technical reference library
- [RAG Best Practices](./reference/RAG_BEST_PRACTICES.md) - Implementation status and roadmap
- [AI SDK Patterns](./reference/ai-sdk-patterns.md) - Vercel AI SDK integration
- [Chunk Metadata](./reference/chunk_metadata.md) - Chunk structure reference
- [DEG-RAG](./reference/DEG-RAG.md) - Graph denoising techniques
- [LLM Pricing](./reference/LLM_PRICING.md) - Cost optimization strategies
- [Cognitive Cartography](./reference/COGNITIVE_CARTOGRAPHY.md) - Multi-floor architecture concepts
- [RAG Comparison](./reference/rag-comparison.md) - vs Vercel RAG implementation
- [Search Comparison](./reference/search-comparison.md) - Search implementation analysis
- [Advanced Chunking](./reference/advanced-chunking.md) - External research on chunking
- [Relationship Expansion](./reference/relationship_expansion.md) - Advanced graph techniques

#### ✅ [Completed](./completed/)
Archive of completed implementations
- **SSoT:** [Completed SSoT](./completed/SSOT.md) - Implementation archive
- [Architecture Decision](./completed/ARCHITECTURE_DECISION.md) - Unified search pipeline
- [Model Dropdown](./completed/MODEL_DROPDOWN_IMPLEMENTATION.md) - Model selection system
- [Agentic Chunking Summary](./completed/AGENTIC_CHUNKING_SUMMARY.md) - Implementation details
- [Graph Performance Fix](./completed/GRAPH_EXTRACTION_PERFORMANCE_FIX.md) - Optimization details
- [Phase 6.5 Complete](./completed/PHASE_6.5_COMPLETE.md) - RAG chat implementation
- [Prompt Management](./completed/PROMPT_MANAGEMENT_SYSTEM.md) - Centralized prompts
- [And more...] - All completed features and fixes

#### 📦 [Archive](./archive/)
Obsolete documentation retained for historical reference
- AI SDK Migration Tests
- Hardcoded Models Cleanup
- Original R2R project documents
- Phase documents superseded by newer architecture

---

## 🎯 Key Concepts

### The Multifloor Model
Mosaic organizes knowledge across four floors:
- **Floor A:** Text Semantics (embeddings)
- **Floor B:** Symbolic/Relational (knowledge graph)
- **Floor C:** Structure & Provenance (documents, chunks)
- **Floor D:** Living Entities (curated knowledge pages)

### Core Technologies
- **Supabase:** Postgres-native database with pgvector
- **Vercel AI SDK:** Streaming chat and model management
- **Docling:** VLM-powered document extraction
- **OpenAI:** Primary LLM with structured outputs
- **Cohere:** Search reranking for precision

### Key Features
- **Hybrid Search:** Semantic + BM25 + Graph + Reranking
- **Advanced Chunking:** Structure-aware + Agentic + Planner-Executor
- **Knowledge Graph:** Automatic extraction with deduplication
- **RAG Chat:** Streaming responses with source citations
- **Flexible Configuration:** Settings-driven operation

---

## 🔄 Documentation Maintenance

### How Documentation is Organized
1. **SSoT Documents:** Authoritative synthesis of each area
2. **Specific Documents:** Detailed implementation guides
3. **Archive:** Historical reference only
4. **Cross-References:** All documents link to relevant SSoTs

### Contributing to Documentation
1. **Update SSoT First:** Always update the relevant SSoT when making changes
2. **Link from SSoT:** Reference specific documents from the SSoT
3. **Keep Current:** Update dates and status when features change
4. **Follow Standards:** Use established templates and styles

### Review Schedule
- **SSoT Documents:** Reviewed quarterly for accuracy
- **Implementation Docs:** Updated with feature changes
- **Archive:** Cleaned up annually
- **Cross-References:** Checked during each review

---

## 🔍 Finding Information

### By Role
- **Product Manager:** Architecture SSoT, Features SSoT, BUILD_PLAN.md
- **Developer:** Architecture SSoT, Reference SSoT, Getting Started
- **Designer:** Guides SSoT, Features SSoT
- **DevOps:** Architecture SSoT, Reference SSoT, Completed SSoT

### By Task
- **Setup Development:** Getting Started Guide
- **Understand Architecture:** Architecture SSoT
- **Implement Feature:** Features SSoT → Reference SSoT
- **Debug Issue:** Completed SSoT → Reference SSoT
- **Plan Roadmap:** BUILD_PLAN.md → Features SSoT

### By Topic
- **Search:** Features SSoT (Search section) → RAG Best Practices
- **Chunking:** Features SSoT (Chunking section) → Advanced Chunking
- **Graph:** Features SSoT (Graph section) → DEG-RAG
- **Chat:** Features SSoT (Chat section) → RAG Best Practices
- **Performance:** Reference SSoT → LLM Pricing

---

## 📄 Project Documents

### Planning & Management
- **[BUILD_PLAN.md](../BUILD_PLAN.md)** - Master development roadmap
- **[INBOX.md](../INBOX.md)** - Ideas and feature requests
- **[TO_PROCESS.md](../TO_PROCESS.md)** - Items requiring decisions
- **[BUGS.md](../BUGS.md)** - Known issues and bugs

### Executive Overview
- **[ORIENTATION.md](./executive/ORIENTATION.md)** - Project overview and status
- **[SYNTHESIS.md](./executive/SYNTHESIS.md)** - Direction and priorities

---

## 🤝 Getting Help

### Documentation Issues
- Found outdated information? Please update the relevant SSoT
- Missing documentation? Create an issue in INBOX.md
- Confusing structure? Suggest improvements in TO_PROCESS.md

### Technical Questions
- Check the Reference SSoT for technical details
- Review Completed SSoT for implementation examples
- Consult Architecture SSoT for design decisions

### Feature Requests
- Add to INBOX.md for new ideas
- Move to TO_PROCESS.md for detailed planning
- Include in BUILD_PLAN.md when approved

---

*This documentation is maintained as part of the Mosaic project. Last updated: October 30, 2025*
