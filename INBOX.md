# INBOX

## 💡 Enhancements & Ideas

### Adaptive Response Depth & Retrieval Matching

**Context:** Currently, all queries use the same retrieval and generation approach regardless of whether the user wants a quick answer or a comprehensive analysis. This creates unnecessary cost and latency for simple queries while potentially under-serving complex research needs.

**Proposal:**

**1. User-Controlled Response Depth**
Allow users to select response depth before or during their query:

- **Quick (30 seconds, ~$0.001)**: Brief, direct answer
  - Retrieval: Top 3-5 chunks, basic semantic search only
  - Generation: Short response (100-200 tokens)
  - Use case: "What is X?", "When did Y happen?"

- **Standard (1-2 minutes, ~$0.005)**: Balanced answer with context
  - Retrieval: Top 10-15 chunks, hybrid search + reranking
  - Generation: Medium response (300-500 tokens)
  - Use case: Most queries, default setting

- **Detailed (2-5 minutes, ~$0.02)**: Comprehensive analysis
  - Retrieval: Top 20-30 chunks, full hybrid + graph traversal
  - Generation: Long response (800-1200 tokens)
  - Use case: "Explain the relationship between X and Y", "Summarize all information about Z"

**2. Deep Research Mode (CrewAI + o4-mini-deep-research)**
Separate mode for multi-page research documents with interactive clarification:

- **Pre-Query Clarification**: Ask user clarifying questions upfront
  - "What aspects of X are most important?"
  - "What's your intended use for this research?"
  - "Any specific time period or context?"

- **Multi-Agent Research Crew**:
  - **Research Agent**: Gathers all relevant information across documents
  - **Analysis Agent**: Synthesizes findings and identifies patterns
  - **Critique Agent**: Identifies gaps and contradictions
  - **Writing Agent**: Produces structured, multi-page document

- **Deep Reasoning with o4-mini-deep-research**: Use o4-mini-deep-research for complex reasoning tasks
  - Cross-document synthesis
  - Contradiction resolution
  - Causal relationship analysis
  - Strategic recommendations

- **Output Format**: Multi-page markdown document with:
  - Executive summary
  - Detailed findings by topic
  - Source citations throughout
  - Methodology notes
  - Confidence levels for claims

**Implementation Considerations:**

- **UI Design**: Toggle or dropdown for response depth on search/chat interface
- **Cost Transparency**: Show estimated cost/time before query execution
- **Progressive Enhancement**: Start with Quick/Standard/Detailed, add Deep Research later
- **Model Selection**: 
  - Quick/Standard: GPT-4o-mini
  - Detailed: GPT-4o
  - Deep Research: o1-mini for reasoning + GPT-4o for writing
- **Retrieval Optimization**: Match retrieval strategy to response depth to avoid over-fetching

**Benefits:**
- Faster responses for simple queries
- Cost optimization (don't use expensive retrieval for quick answers)
- Better UX (users control depth vs speed tradeoff)
- Enables true research workflows with Deep Research mode

**Priority:** Medium-High (Standard depth levels), Medium (Deep Research mode)

**Estimated Effort:**
- Response depth levels: 3-5 days
- Deep Research mode: 2-3 weeks

---

### Kibo UI Component Library Integration

**Context:** Mosaic currently uses shadcn/ui components directly. Kibo UI is a curated collection of enhanced shadcn components with additional features, better defaults, and improved accessibility.

**Proposal:** Evaluate and potentially migrate to Kibo UI for improved component quality and developer experience.

**What is Kibo UI?**
- Built on top of shadcn/ui (same foundation we're already using)
- Enhanced components with better defaults and additional features
- Improved accessibility and keyboard navigation
- More polished animations and interactions
- Additional component variants and compositions
- Documentation: https://www.kibo-ui.com/docs/setup

**Potential Benefits:**
- **Better UX**: More polished components out of the box
- **Faster Development**: Pre-built component compositions reduce custom work
- **Accessibility**: Enhanced ARIA support and keyboard navigation
- **Consistency**: Better design system cohesion across components
- **Maintenance**: Less custom component code to maintain

**Migration Considerations:**
- **Compatibility**: Kibo UI is built on shadcn, so migration should be straightforward
- **Bundle Size**: Evaluate if additional features increase bundle size significantly
- **Customization**: Ensure we can still customize components as needed
- **Breaking Changes**: Test existing components to ensure no regressions
- **Learning Curve**: Team needs to familiarize with Kibo-specific patterns

**Evaluation Criteria:**
1. Does it provide meaningful improvements over current shadcn components?
2. Is the bundle size increase acceptable?
3. Does it maintain or improve accessibility?
4. Can we easily customize components for Mosaic's needs?
5. Is the documentation clear and comprehensive?

**Recommended Approach:**
1. **Audit Current Components**: List all shadcn components currently in use
2. **Kibo Comparison**: Compare Kibo versions of same components
3. **Prototype**: Build a test page with Kibo components
4. **Performance Test**: Measure bundle size and runtime performance
5. **Decision**: Migrate if benefits outweigh costs, otherwise stay with shadcn

**Priority:** Low-Medium (Nice to have, not critical)

**Estimated Effort:**
- Evaluation: 1-2 days
- Migration (if approved): 3-5 days depending on component count

---

## 🐛 Bugs & Issues

*No items pending - INBOX is clean!*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 19, 2025)
All major enhancement proposals migrated to **Phase 10: Advanced Graph & Document Intelligence**:

1. **Entity Deduplication & Merge Assistant** → Phase 10.1 (High Priority, 1-2 weeks)
   - Manual merge workflow
   - Automated duplicate detection
   - AI-assisted merge intelligence

2. **Generic Entity Detection & Cleanup** → Phase 10.2 (Medium Priority, 3-4 days)
   - Detection & flagging of generic entities
   - Review & cleanup UI

3. **Document Organization System** → Phase 10.3 (Medium-High Priority, 1-2 weeks)
   - Folder/subfolder hierarchy
   - Tagging system
   - AI-powered organization suggestions

4. **Document-Level Intelligence & Graph Integration** → Phase 10.4 (High Priority, 2-3 weeks)
   - Document summarization & metadata
   - Auto-tagging from content
   - Documents as graph entities
   - Staleness detection & freshness tracking
   - Document clustering & discovery

5. **Temporal Data Management & Versioning** → Phase 10.5 (Medium-High Priority, 1 week)
   - Basic temporal metadata
   - Document versioning
   - Temporal search weighting

6. **Intelligent Source Discovery** → Phase 10.6 (Medium-High Priority, 1-2 weeks)
   - Knowledge gap analysis
   - Web source discovery
   - Automated source ingestion

7. **Adaptive Chunk Quality Enhancement** → Phase 10.7 (Medium-High Priority, 1-2 weeks)
   - Automatic quality detection
   - Selective LLM post-processing
   - On-demand re-chunking UI

8. **OCR Cleanup Pre-Processing** → Phase 10.8 (Medium Priority, 1 week)
   - Scanned document detection
   - Conservative OCR cleanup
   - Verification & rollback
   - UI & user control

9. **Prompt Management System** → Phase 10.9 (Medium Priority, 1 week)
   - Prompt settings page
   - Database-driven prompt management
   - Version tracking

### Moved to BUILD_PLAN.md (October 17, 2025)
- **Living Entities** → Phase 9 (4-6 weeks)
  - Template-based entity pages
  - CrewAI update crew
  - UI components
  - Integration with ingestion pipeline

### Previous Moves (October 17, 2025)
- **Entity & Relationship Description Synthesis** → Phase 5.7: Enterprise Graph Architecture
- **Corpus-Level Entity Management** → Phase 5.4: Graph Management UI (approach chosen)
- **Two-Level Graph Architecture** → Phase 5.7: Enterprise Graph Architecture  
- **Hierarchical Graph Traversal** → Phase 6 Enhancements

### Previous Moves (October 16, 2025)
- **HyDE Query Enhancement Tuning** → Phase 6 Enhancements (Medium Priority)
- **Graph Extractor Entity Quality Improvement** → Phase 6 Enhancements (Medium Priority)
- **PGMQ Queue State Corruption Fix** → Phase 6 Enhancements (High Priority)

### Previous Migrations (January 16, 2025)
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements
- Frontend Display Issues → TO_PROCESS.md
- Infrastructure Cleanup → TO_PROCESS.md
- Advanced RAG Patterns → TO_PROCESS.md
- Operational Decisions → TO_PROCESS.md

### Already Implemented (Removed from INBOX)
- Docling with VLM ✅ Deployed and working
- Parallel Page Processing ✅ Implemented in Docling processor

---

## How to Use This File

When new ideas or enhancements come up:

1. **Add them here first** - Quick capture without overthinking
2. **Run /cleanup workflow** - Periodically move items to BUILD_PLAN or TO_PROCESS
3. **Keep it clean** - INBOX should be empty or near-empty most of the time

---

*Last cleaned: October 19, 2025*
*Last updated: October 19, 2025 - Added Adaptive Response Depth, Deep Research Mode, and Kibo UI evaluation*
