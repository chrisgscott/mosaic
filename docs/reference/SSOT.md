# Mosaic Reference: Single Source of Truth

**Status:** Technical Reference Library | **Updated:** October 30, 2025

This document organizes all technical references, implementation guides, and external research into a single navigable hub.

---

## Implementation References

### 📋 [RAG Best Practices](./RAG_BEST_PRACTICES.md)
**Purpose:** Current implementation status and roadmap for RAG features

**Key Content:**
- Implemented features (Phase 6.5.1 complete)
- Planned enhancements (Phases 6.5.2-6.5.3)
- Critical gaps and fixes
- Production readiness checklist
- Metrics to track

**Use When:**
- Planning RAG improvements
- Understanding current capabilities
- Setting development priorities

### 🤖 [AI SDK Patterns](./ai-sdk-patterns.md)
**Purpose:** Vercel AI SDK integration patterns and best practices

**Key Content:**
- Currently implemented patterns
- Recommended next implementations:
  - Caching middleware (high priority)
  - Human-in-the-loop (medium priority)
  - Multi-step tool calls (medium priority)
- RAG-specific patterns
- Performance optimizations

**Use When:**
- Integrating with Vercel AI SDK
- Implementing new AI features
- Optimizing AI performance

### 📊 [Chunk Metadata](./chunk_metadata.md)
**Purpose:** Technical reference for chunk metadata structure

**Key Content:**
- Complete metadata schema
- Use cases for each field
- Example implementations
- Future enhancement ideas
- Storage considerations

**Use When:**
- Working with chunk data
- Implementing citations
- Building search features

---

## Advanced Techniques

### 🔗 [DEG-RAG](./DEG-RAG.md)
**Purpose:** Graph denoising techniques for knowledge quality

**Key Content:**
- Entity resolution across documents
- Triple reflection for relationship pruning
- Evidence-based verification with quotes
- Directionality corrections
- Implementation phases and priorities

**Use When:**
- Improving graph quality
- Implementing entity deduplication
- Reducing relationship noise

### 💰 [LLM Pricing](./LLM_PRICING.md)
**Purpose:** Cost optimization strategies for LLM usage

**Key Content:**
- 304x price difference between models
- Sweet spot recommendations
- Prompt caching discounts (75%)
- Model ladder strategy
- Cost per operation estimates

**Use When:**
- Selecting models for tasks
- Budget planning
- Performance-cost tradeoffs

### 🧠 [Cognitive Cartography](./COGNITIVE_CARTOGRAPHY.md)
**Purpose:** Conceptual foundation for multi-floor architecture

**Key Content:**
- Multi-floor traversal theory
- Human-AI parity principles
- Temporal modeling concepts
- Knowledge abstraction layers
- Philosophical underpinnings

**Use When:**
- Understanding system design
- Planning architectural changes
- Explaining Mosaic's approach

---

## Comparative Analysis

### ⚔️ [RAG Comparison](./rag-comparison.md)
**Purpose:** Comparison with Vercel's RAG implementation

**Key Content:**
- Architecture comparison
- Feature differences
- Performance considerations
- Technology stack comparison
- What Mosaic does better

**Use When:**
- Evaluating architectural decisions
- Understanding competitive advantages
- Justifying technology choices

### 🔍 [Search Comparison](./search-comparison.md)
**Purpose:** Search implementation analysis

**Key Content:**
- Simple vs advanced search pipelines
- Query enhancement techniques
- Hybrid search implementation
- Performance tradeoffs
- Feature completeness

**Use When:**
- Optimizing search performance
- Understanding search architecture
- Evaluating search quality

---

## External Research

### 📚 [Advanced Chunking](./advanced-chunking.md)
**Purpose:** External article on chunking strategies

**Key Content:**
- Why most chunking strategies fail
- Layout-aware chunking benefits
- Domain-specific playbooks
- Table and image handling
- Evaluation metrics

**Use When:**
- Improving chunking strategies
- Debugging poor RAG performance
- Learning from industry research

### 🔗 [Relationship Expansion](./relationship_expansion.md)
**Purpose:** Advanced graph techniques for relationship discovery

**Key Content:**
- Relationship Expansion Generation (REG)
- Query-driven expansion
- Pattern-based discovery
- Implementation considerations
- Performance implications

**Use When:**
- Enhancing graph connectivity
- Implementing relationship discovery
- Advanced graph features

---

## Historical References (Moved to Archive)

### 📦 [AI SDK Migration Tests](../archive/AI_SDK_MIGRATION_TESTS.md)
**Status:** Complete - Moved to archive
- Migration test plan from raw OpenAI to Vercel AI SDK
- No longer needed after successful migration

---

## Reference Usage Guide

### For Developers
1. **Implementation Questions:** Start with RAG Best Practices and AI SDK Patterns
2. **Technical Details:** Use Chunk Metadata and specific feature docs
3. **Architecture Decisions:** Review comparative analyses
4. **Advanced Features:** Explore DEG-RAG and relationship expansion

### For System Designers
1. **System Architecture:** Cognitive Cartography for conceptual foundation
2. **Performance Optimization:** LLM Pricing for cost considerations
3. **Technology Choices:** Comparative analyses for rationale
4. **Future Planning:** Advanced techniques for roadmap

### For Researchers
1. **Industry Best Practices:** Advanced Chunking article
2. **Innovative Techniques:** DEG-RAG and relationship expansion
3. **Performance Analysis:** Comparative studies
4. **Cost Analysis:** LLM pricing strategies

---

## Reference Maintenance

### Adding New References
1. **Categorize:** Determine if it's implementation, technique, analysis, or research
2. **Summarize:** Extract key content and use cases
3. **Link:** Update this SSoT with brief description
4. **Cross-Reference:** Link from relevant feature docs

### Review Schedule
- **Quarterly:** Review all references for currency
- **As Needed:** Update when major features are implemented
- **Annual:** Archive outdated references

---

## Related Documents

- **Architecture:**
  - [Architecture SSoT](../architecture/SSOT.md) - System design and principles

- **Features:**
  - [Features SSoT](../features/SSOT.md) - Feature documentation and status

- **Guides:**
  - [Guides SSoT](../guides/SSOT.md) - User and developer guides

- **Completed:**
  - [Completed Features](../completed/) - Implementation details and test plans

---

*This SSoT organizes all technical references. For specific implementation details, refer to individual reference documents or the relevant feature documentation.*
