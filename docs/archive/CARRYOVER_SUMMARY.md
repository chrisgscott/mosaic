# What to Carry Over from mosaic-r2r to mosaic

**Created:** 2025-10-29  
**Purpose:** Document all valuable work from the R2R experiment to port back to the original Mosaic build

---

## 🎯 Executive Summary

After thorough analysis, we've determined that **your previous Mosaic build is objectively better than R2R** in almost every way. This document captures what should be carried over from this R2R experiment.

**Recommendation:** Return to `/Users/chrisgscott/projects/mosaic` and add only the multi-floor architecture.

---

## ✅ What to Carry Over

### 1. **Multi-Floor Architecture** (CRITICAL)

**Why:** This is the ONLY thing R2R taught us that we didn't already have.

**Files to Port:**
- `migrations/004_auto_bridge_refresh.sql` - Bridge generation function
- `migrations/005_graph_pull_function.sql` - Graph pull with correct ID mapping
- `apps/api/services/graph_manager.py` - Graph pull orchestration
- `apps/api/services/trail_engine.py` - Multi-floor traversal engine
- `apps/api/services/trail_parser.py` - Trail YAML parser
- `apps/api/routes/trails.py` - Trail API endpoints

**Documentation:**
- `docs/MULTIFLOOR_ARCHITECTURE.md` - Complete architecture spec
- `docs/ORGANIZATIONAL_HIERARCHY.md` - How floors relate
- `docs/GRAPH_AUTOMATION.md` - Automation patterns
- `COGNITIVE_CARTOGRAPHY.md` - Conceptual foundation

**Database Schema:**
```sql
-- Core tables
mosaic.floor_bridges
mosaic.temporal_versions (future)
mosaic.custom_floors (future)
mosaic.trail_executions

-- Functions
mosaic.pull_graph_entities(collection_id)
mosaic.refresh_floor_bridges(collection_id)
```

**Integration Points:**
- After graph extraction completes → call `pull_graph_entities()`
- After graph pull completes → call `refresh_floor_bridges()`
- Expose trail execution via API: `POST /trails/execute`

---

### 2. **DEG-RAG Concepts** (HIGH VALUE)

**Why:** Graph denoising is critical for quality, and we don't have this yet.

**Files to Reference:**
- `DEG-RAG.md` - Complete implementation guide
- `relationship_expansion.md` - Relation expansion (REG) module

**Key Concepts:**
1. **Entity Resolution** - Cross-document entity deduplication
2. **Triple Reflection** - Relationship pruning and validation
3. **Evidence-Based Verification** - LLM verification with quotes
4. **Directionality Corrections** - Fix reversed relationships

**Implementation Priority:**
- Phase 1: Entity resolution (merge duplicates across documents)
- Phase 2: Relationship pruning (remove weak/contradictory edges)
- Phase 3: Query-driven expansion (discover missing edges from user queries)

**Database Schema:**
```sql
-- Auxiliary schema for DEG-RAG operations
kg_ops.candidate_merges
kg_ops.candidate_relation_prune
kg_ops.candidate_new_relations (REG)
kg_ops.audit_log
```

---

### 3. **LLM Pricing Strategy** (COST OPTIMIZATION)

**Why:** Systematic approach to model selection saves 85-90% on costs.

**File:** `LLM_PRICING.md`

**Key Insights:**
- **304x price difference** between cheapest (gpt-5-nano) and most expensive (gpt-5-pro)
- **Sweet spot:** gpt-5-mini or gpt-4.1-mini for most tasks
- **Prompt caching:** 75% discount on repeated context
- **Model ladder:** Start cheap, escalate only when needed

**Recommended Tiers:**
- Ultra-Budget (<$0.05/100pg): gpt-5-nano, gpt-4.1-nano
- Budget ($0.05-$0.15): gpt-4.1-mini, gpt-5-mini
- Mid-Tier ($0.20-$0.50): o3, gpt-4.1
- Premium ($0.50-$1.00): gpt-5, Claude Sonnet 4.5

---

### 4. **R2R Bug Fixes** (LESSONS LEARNED)

**Why:** Document what NOT to do and what we fixed.

**Files:**
- `R2R_BUG_FIX.md` - Entity extraction XML truncation
- `R2R_BUG_FIX_2.md` - Graph pull ID mapping bug

**Key Lessons:**
1. **Don't trust R2R's graph.pull()** - Build your own SQL-based pull
2. **ID mapping is broken** - Use temporary mapping tables
3. **Token limits matter** - Increased from 2048 to 4096
4. **Deduplication timing** - Defer expensive operations until after dedup

**Our Solutions:**
- Custom SQL function for graph pull (faster, more reliable)
- Correct ID mapping with temporary tables
- Deferred embedding generation (70% cost savings)

---

### 5. **Admin UI Patterns** (FRONTEND)

**Why:** Document management UI is solid and should be ported.

**Files to Port:**
- `apps/web/components/admin/documents-table.tsx`
- `apps/web/components/admin/upload-dialog.tsx`
- `apps/web/app/api/documents/` routes

**Features:**
- Document list with search/filter
- Drag-and-drop upload
- Status tracking
- Bulk operations

**Note:** Your previous build already has better graph management UI. Keep that!

---

### 6. **Graph Pipeline Optimization** (ARCHITECTURE)

**File:** `GRAPH_PIPELINE_ANALYSIS.md`

**Key Findings:**
1. **Entity optimization works** - Defer descriptions until after dedup (70% savings)
2. **Relationship optimization needed** - Embeddings generated before dedup (wasted)
3. **chunk_ids should append** - Not replace during graph pull
4. **Embeddings are used** - For semantic search, not bridges

**Fixes to Implement:**
```python
# Skip embeddings during extraction
desc_embed = None
if desc:  # Only if description exists
    desc_embed = await async_get_embedding(desc)
```

```sql
-- Append chunk_ids instead of replacing
ON CONFLICT (...) DO UPDATE SET
    chunk_ids = array_cat(graphs_entities.chunk_ids, EXCLUDED.chunk_ids),
    ...
```

---

## ❌ What NOT to Carry Over

### 1. **R2R Framework Itself**
- ❌ Hatchet orchestration (too complex)
- ❌ R2R's document processing (your Docling is better)
- ❌ R2R's graph extraction (your selective approach is better)
- ❌ R2R's configuration system (your settings service is better)

### 2. **Complex Chunking Strategies**
- ❌ AgenticChunker (expensive, unclear ROI)
- ❌ PlannerExecutorChunker (overkill)
- ❌ DocumentAugmentationChunker (questions per chunk = $$$)
- ❌ HybridChunker (complexity without clear benefit)

**Keep:** Simple StructureAwareChunker (512 tokens, clean boundaries)

### 3. **R2R's Deduplication Logic**
- ❌ Document-level only (not cross-document)
- ❌ No relationship dedup
- ❌ Broken ID mapping

**Use:** Your pgvector-based deduplication (0.85 threshold, working)

---

## 📋 Migration Checklist

### Phase 1: Add Multi-Floor to Previous Build (Week 1)

- [ ] Copy SQL migrations to `/Users/chrisgscott/projects/mosaic/supabase/migrations/`
  - [ ] `004_auto_bridge_refresh.sql`
  - [ ] `005_graph_pull_function.sql`
- [ ] Copy Python services to `/Users/chrisgscott/projects/mosaic/apps/api/services/`
  - [ ] `graph_manager.py`
  - [ ] `trail_engine.py`
  - [ ] `trail_parser.py`
- [ ] Copy API routes
  - [ ] `routes/trails.py`
- [ ] Copy documentation
  - [ ] `docs/MULTIFLOOR_ARCHITECTURE.md`
  - [ ] `docs/ORGANIZATIONAL_HIERARCHY.md`
  - [ ] `COGNITIVE_CARTOGRAPHY.md`
- [ ] Update worker to call graph pull after extraction
- [ ] Test end-to-end: Upload → Extract → Pull → Bridges → Traverse

### Phase 2: Add DEG-RAG (Week 2-3)

- [ ] Create `kg_ops` schema in Supabase
- [ ] Implement entity resolution
  - [ ] Candidate generation (semantic similarity)
  - [ ] LLM verification
  - [ ] Merge accepted pairs
- [ ] Implement triple reflection
  - [ ] Score relationships
  - [ ] Verify with LLM
  - [ ] Prune weak edges
- [ ] Add to nightly job schedule

### Phase 3: Optimize & Polish (Week 4)

- [ ] Implement deferred embedding generation
- [ ] Fix chunk_ids appending in graph pull
- [ ] Add LLM pricing tiers to settings
- [ ] Port admin UI improvements
- [ ] Add monitoring and metrics

---

## 🎓 Key Learnings

### What Worked
1. ✅ **Multi-floor architecture** - Brilliant concept, well-executed
2. ✅ **SQL-based graph pull** - Faster and more reliable than R2R
3. ✅ **Trail execution engine** - Clean API, composable steps
4. ✅ **Deferred optimization** - 70% cost savings on entity descriptions
5. ✅ **Documentation** - Comprehensive specs and guides

### What Didn't Work
1. ❌ **R2R framework** - Too opinionated, too complex
2. ❌ **Hatchet orchestration** - Overkill for our needs
3. ❌ **R2R's graph.pull()** - Broken, had to bypass
4. ❌ **Complex chunking** - No clear ROI
5. ❌ **Fighting R2R** - Spent more time debugging than building

### What We Learned
1. 💡 **Your previous build was better** - Docling, smart extraction, great UI
2. 💡 **Multi-floor is the missing piece** - Only thing R2R taught us
3. 💡 **Simple is better** - KISS principle applies to chunking
4. 💡 **Own your critical path** - Don't depend on buggy frameworks
5. 💡 **Cost optimization matters** - Model selection can save 90%

---

## 🚀 Recommended Architecture

### The Winning Combination

```
Your Previous Build (Keep):
├── Docling VLM (20-40x faster processing)
├── Smart graph extraction (selective, high quality)
├── pgvector deduplication (0.85 threshold)
├── Settings service (database-driven config)
├── Frontend graph management (AI cleanup, CRUD)
└── Simple StructureAwareChunker (512 tokens)

Add from R2R Experiment:
├── Multi-floor schema (floor_bridges table)
├── Graph pull function (correct ID mapping)
├── Trail execution engine (multi-hop traversal)
├── Bridge generation (A ↔ B ↔ C connections)
└── DEG-RAG concepts (entity resolution, triple reflection)

Result:
└── Best-in-class RAG system with multi-floor traversal
```

---

## 📊 Expected Outcomes

### Performance
- **Document processing:** 3-7 min for 200 pages (Docling VLM)
- **Graph extraction:** ~2-3 seconds per chunk
- **Graph pull:** <1 second (direct SQL)
- **Trail execution:** 700-790ms for multi-hop queries

### Cost
- **Per document:** ~$0.008 (Docling + extraction + embeddings)
- **With optimization:** 70% savings on entity descriptions
- **With model ladder:** 85-90% savings vs all-premium

### Quality
- **Entity extraction:** 3-7 entities per chunk (selective)
- **Deduplication:** 0.85 similarity threshold (pgvector)
- **Graph completeness:** DEG-RAG ensures clean, complete graph
- **Multi-floor traversal:** True multi-hop reasoning

---

## 🎯 Success Criteria

You'll know the migration is successful when:

1. ✅ Upload document → Docling processes in 3-7 min
2. ✅ Entities extracted → Smart, selective (3-7 per chunk)
3. ✅ Graph pull completes → Correct ID mapping
4. ✅ Bridges generated → All 4 types (A↔B↔C, B↔B)
5. ✅ Trail execution works → Multi-hop queries in <1 second
6. ✅ Frontend graph UI → AI cleanup, CRUD, visualization
7. ✅ DEG-RAG running → Nightly entity resolution + triple reflection
8. ✅ Costs optimized → Model ladder + deferred embeddings

---

## 📚 Reference Documents

### Must Read (Priority Order)
1. `GRAPH_PIPELINE_ANALYSIS.md` - Complete pipeline analysis
2. `docs/MULTIFLOOR_ARCHITECTURE.md` - Multi-floor spec
3. `DEG-RAG.md` - Graph denoising guide
4. `LLM_PRICING.md` - Cost optimization strategy
5. `R2R_BUG_FIX_2.md` - What we fixed and why

### Supporting Docs
- `COGNITIVE_CARTOGRAPHY.md` - Conceptual foundation
- `docs/ORGANIZATIONAL_HIERARCHY.md` - How everything relates
- `relationship_expansion.md` - REG module
- `BUILD_PLAN.md` - Original build plan (phases 1-7)
- `INBOX.md` - Future features and ideas

---

## 🤝 Contributing Back to R2R

Even though we're not using R2R, we should contribute our fixes:

### Potential PRs
1. **Bug Fix #1:** Entity ID mapping in graph pull
2. **Bug Fix #2:** Graph not found error
3. **Feature:** Deferred embedding generation
4. **Feature:** Relationship deduplication

**Why contribute?**
- Help the community
- Good open source citizenship
- Doesn't conflict with our own implementation

---

## 📝 Final Notes

### Timeline
- **R2R Experiment:** 2 weeks
- **Multi-floor Addition:** 3-5 days
- **DEG-RAG Implementation:** 1-2 weeks
- **Total to Production:** 3-4 weeks

### Effort Saved
By returning to your previous build instead of continuing with R2R:
- ✅ No need to fix R2R's bugs
- ✅ No need to fight Hatchet complexity
- ✅ No need to rebuild what already works
- ✅ Just add the one missing piece (multi-floor)

### The Bottom Line
**Your previous build + multi-floor = Perfect RAG system**

No R2R needed. No framework complexity. Just clean, fast, maintainable code that does exactly what you need.

---

**Last Updated:** 2025-10-29  
**Status:** Ready for Migration  
**Next Step:** Start Phase 1 migration checklist
