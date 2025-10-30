# TO_PROCESS - Items Requiring Decisions

This file contains ideas and features that need further discussion or decisions before they can be added to the BUILD_PLAN.

---

## Decision Needed: Data Preparation Strategy

**Context:** We've defined a lightweight data prep strategy in BUILD_PLAN Phase 2.5, but need to decide:

**Questions:**
1. Should we implement Phase 2.5 (Data Prep) before or after Phase 3 (Frontend)?
   - **Before:** Better data quality from the start, but delays frontend work
   - **After:** Get to working product faster, add validation later

2. Which Phase 2 optional features should we prioritize?
   - Language detection (if multi-language projects expected)
   - PII detection (if handling sensitive user data)
   - OCR quality validation (if dealing with scanned documents)

3. Should we build project-specific schemas now or start with a generic schema?
   - **Generic:** Faster to implement, works for all projects
   - **Project-specific:** Better validation, but requires defining schemas upfront

**Current Status:** Deferred to Phase 2.5 (Optional)

**Decision Required By:** Before starting Phase 4 (Document Management)

**Reference:** [BUILD_PLAN.md - Phase 2.5](./BUILD_PLAN.md#25-data-prep--validation-optional)

---

## Decision Needed: Performance Optimization Priorities

**Context:** We have many performance optimization ideas in Phase 7, but most require R2R core modifications.

**Questions:**
1. Should we contribute optimizations to R2R upstream or fork/modify locally?
   - **Upstream:** Benefits everyone, but slower process
   - **Local:** Faster implementation, but maintenance burden

2. Which optimizations should we prioritize (if any)?
   - Parallel embedding batch processing
   - Parallel database storage writes
   - Concurrent chunk enrichment
   - Streaming storage during embedding
   - Adaptive concurrency limits

3. Should we wait for performance issues before optimizing?
   - **Yes:** Don't optimize prematurely, measure first
   - **No:** Implement known optimizations proactively

**Current Status:** Phase 7.1 (Low Priority)

**Decision Required By:** After Phase 4 is complete and we have real usage data

**Reference:** [BUILD_PLAN.md - Phase 7.1](./BUILD_PLAN.md#71-performance-optimizations)

---

## Decision Needed: Advanced Feature Sequencing

**Context:** Phase 6 has multiple high-value features. Need to decide implementation order.

**Options:**
1. **Quick Wins First:**
   - 6.2 Contextual Retrieval (1-2 days) → immediate search quality improvement
   - Then 6.1 Hierarchical Chunking (1-2 weeks)
   - Then 6.3 Entity Extraction (2-3 weeks)
   - Skip 6.4 RAPTOR (optional)

2. **Foundation First:**
   - 6.1 Hierarchical Chunking (1-2 weeks) → enables other features
   - Then 6.2 Contextual Retrieval (1-2 days)
   - Then 6.3 Entity Extraction (2-3 weeks)
   - Then 6.4 RAPTOR (2-3 weeks) if needed

3. **User-Driven:**
   - Wait until Phase 4 is complete
   - Gather user feedback on search quality
   - Prioritize based on actual pain points

**Recommendation:** Option 1 (Quick Wins First) - Get immediate value, then build foundation

**Decision Required By:** Before starting Phase 6

**Reference:** [BUILD_PLAN.md - Phase 6](./BUILD_PLAN.md#phase-6-advanced-features--future)

---

## Decision Needed: CrewAI Integration Scope

**Context:** Phase 5 includes CrewAI integration, but scope is undefined.

**Questions:**
1. What specific crews/agents do we need?
   - Research crew (defined in PROJECT_STRUCTURE.md)
   - Analysis crew?
   - Summarization crew?
   - Custom domain-specific crews?

2. Should agents have access to:
   - R2R search only?
   - R2R + web search (Tavily)?
   - R2R + web search + code execution?
   - R2R + web search + code execution + custom tools?

3. How should agent results be presented?
   - In chat interface (mixed with regular chat)?
   - Separate agent interface?
   - Both?

**Current Status:** Phase 5 (Low Priority)

**Decision Required By:** Before starting Phase 5

**Reference:** [BUILD_PLAN.md - Phase 5](./BUILD_PLAN.md#phase-5-crewai-integration--future)

---

## Decision Needed: Monitoring & Observability Tools

**Context:** Phase 7.2 includes monitoring, but tooling is undefined.

**Questions:**
1. Which monitoring solution?
   - OpenTelemetry (industry standard, more complex)
   - Custom metrics with Prometheus + Grafana
   - Simple logging + CloudWatch/Datadog
   - Built-in FastAPI metrics

2. What level of observability?
   - Basic (request counts, latency, errors)
   - Intermediate (+ per-operation metrics, costs)
   - Advanced (+ distributed tracing, custom events)

3. Where to store metrics?
   - Self-hosted (Prometheus + Grafana)
   - Cloud service (Datadog, New Relic, CloudWatch)
   - Supabase (custom tables)

**Current Status:** Phase 7.2 (Medium Priority)

**Decision Required By:** Before starting Phase 7

**Reference:** [BUILD_PLAN.md - Phase 7.2](./BUILD_PLAN.md#72-monitoring--observability)

---

## Decision Needed: DEG-RAG Implementation

**Context:** DEG-RAG (Denoising Knowledge Graphs for RAG) is a research-backed approach for improving knowledge graph quality through automated entity deduplication and relation pruning.

**What It Solves:**
- Cross-document entity deduplication (R2R only dedupes within documents)
- Weak/contradictory relationship pruning
- Directionality corrections (e.g., "A part_of B" vs "B part_of A")
- Automated graph quality maintenance at scale

**Implementation Approach:**
- Separate `kg_ops` schema (non-invasive, doesn't modify R2R core)
- Background jobs (hourly/nightly/weekly)
- LLM verification for borderline cases
- Full audit trail

**Questions:**

1. **When to implement?**
   - **After Phase 6.3:** Wait until entity extraction works and we have real data
   - **During Phase 6.3:** Integrate as part of entity extraction refinement
   - **Never:** Manual review is sufficient for our scale

2. **What scope?**
   - **MVP:** Entity dedup + basic relation pruning only
   - **Full:** Add LLM verification, directionality fixes, monitoring
   - **Hybrid:** Start with MVP, expand based on observed issues

3. **Cost tolerance?**
   - LLM verification adds API costs for borderline cases
   - Can mitigate with auto-accept thresholds and cheaper models
   - Is automated cleanup worth the cost vs manual review?

4. **Scale considerations?**
   - **High value** if: >100s of documents, cross-doc entities critical
   - **Low value** if: <50 documents, manual review acceptable
   - What's our expected document volume?

**Recommendation:** 
- Add as Phase 6.5 (after Phase 6.3 Entity Extraction Refinement)
- Start with MVP (entity dedup + basic pruning)
- Expand to full implementation if graph quality issues emerge

**Decision Required By:** After Phase 6.3 is complete and we have real usage data

**Reference:** [DEG-RAG.md](./DEG-RAG.md)

**Related:** [BUILD_PLAN.md - Phase 6.3](./BUILD_PLAN.md#63-entity-extraction-refinement)

---

## Decision Needed: REG (Relation Expansion) Implementation

**Context:** REG (Relation Expansion) is a complementary module to DEG-RAG that discovers missed relationships in the knowledge graph through evidence-based verification.

**What It Solves:**
- Under-extraction (missed relationships between known entities)
- Cross-document connections LLM didn't catch
- Co-mention patterns that imply relationships
- Graph recall (completeness) vs DEG-RAG's precision (cleanliness)

**Implementation Approach:**
- Multiple candidate generation strategies (co-mention, neighborhood gaps, pattern mining, query-guided)
- Evidence retrieval from source documents
- LLM verification with required quotes
- Provenance tracking for all inserted relations
- Reuses DEG-RAG's direction/contradiction checking

**Questions:**

1. **Should we implement this at all?**
   - **Yes, if:** Graph recall is measurably low, users hit "no results" on answerable questions
   - **No, if:** Graph extraction already captures most relationships, manual addition is acceptable
   - **Alternative:** Simpler manual relationship seeding with evidence requirements

2. **When to implement?**
   - **After Phase 6.5 (DEG-RAG):** REG needs a clean graph to search over
   - **Never:** If complexity doesn't justify marginal recall gains
   - **Depends:** Measure graph recall after DEG-RAG before deciding

3. **What scope?**
   - **MVP:** Co-mention heuristic only + manual review UI
   - **Targeted:** Focus on specific high-value relation types (supplies, acquired, etc.)
   - **Full:** All strategies (co-mention, neighborhood, patterns, query-guided, anchored re-extract)

4. **Cost tolerance?**
   - LLM verification for every candidate relation
   - Evidence retrieval and re-extraction
   - Higher costs than DEG-RAG due to discovery overhead
   - Can mitigate with caps, batching, cheaper models

5. **Complexity vs. simpler alternatives?**
   - **Full REG:** Very high complexity (9/10)
   - **Manual seeding:** Admin UI to add relations with evidence (3/10)
   - **Pattern-only:** Just pattern mining, skip other strategies (5/10)

**Recommendation:** 
- Evaluate AFTER Phase 6.5 (DEG-RAG) is complete
- Measure graph recall and user query success rate
- Start with manual relationship seeding if recall issues are minor
- Implement REG MVP (co-mention only) if recall issues are significant
- Only implement full REG if automated expansion is critical at scale

**Decision Required By:** After Phase 6.5 is complete and graph recall is measured

**Reference:** [relationship_expansion.md](./relationship_expansion.md)

**Related:** 
- [DEG-RAG.md](./DEG-RAG.md) - Must be implemented first
- [BUILD_PLAN.md - Phase 6.3](./BUILD_PLAN.md#63-entity-extraction-refinement)

**Key Insight:** REG is the "find what's missing" complement to DEG-RAG's "clean what exists." Together they produce a graph that is both lean and complete.

**UPDATE:** A superior approach (Query-Driven Graph Expansion) has been added to BUILD_PLAN as Phase 6.5. This uses actual user queries and returned chunks to discover missing relationships, which is more precise and valuable than generic REG heuristics. Consider implementing Phase 6.5 instead of full REG.

---

## Notes

- Review this file before starting each new phase
- Move items to BUILD_PLAN once decisions are made
- Archive items that are no longer relevant
- Keep this file lean - only items that genuinely need decisions
