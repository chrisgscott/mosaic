# Mosaic: Best of All Worlds Action Plan

**Created:** 2025-10-29  
**Goal:** Combine the best from R2R experiment with existing Mosaic to create the ultimate RAG platform  
**Timeline:** 4-6 weeks to production-ready with full stack

---

## 🎯 **The Vision**

Transform Mosaic from "smart document search" into a **living knowledge platform** by combining:

1. ✅ **What You Have:** Docling VLM, smart graph extraction, great frontend, Vercel AI SDK
2. 🔥 **Multi-Floor Architecture:** True multi-hop traversal across abstraction layers
3. 🧹 **DEG-RAG:** Clean, accurate knowledge graph
4. 🚀 **Living Entities:** Curated, structured knowledge pages (THE killer feature)

**Result:** "Mosaic for X" becomes viable for any domain (Strategic Materials, Nuclear Cybersecurity, Veteran Services, etc.)

---

## 📊 **How Everything Fits Together**

### **The Stack (Bottom to Top):**

```
┌─────────────────────────────────────────────────────────┐
│ FLOOR D: Living Entities (Curated Knowledge)            │
│ - Material pages, Mine pages, Supplier pages            │
│ - 10-20 structured sections per entity type             │
│ - CrewAI auto-updates from new content                  │
│ - Single source of truth for decision-making            │
└────────────────┬────────────────────────────────────────┘
                 ↕ (floor bridges)
┌─────────────────────────────────────────────────────────┐
│ FLOOR B: Graph Entities (Discovery)                     │
│ - Lightweight, auto-extracted entities                  │
│ - DEG-RAG cleaned (no duplicates, pruned relationships) │
│ - Feeds into Living Entities                            │
└────────────────┬────────────────────────────────────────┘
                 ↕ (floor bridges)
┌─────────────────────────────────────────────────────────┐
│ FLOOR A: Chunks (Evidence)                              │
│ - Structure-aware chunking (simple, fast, free)         │
│ - Embeddings for semantic search                        │
│ - Source evidence for everything above                  │
└────────────────┬────────────────────────────────────────┘
                 ↕ (floor bridges)
┌─────────────────────────────────────────────────────────┐
│ FLOOR C: Documents (Provenance)                         │
│ - Docling VLM processing (20-40x faster)                │
│ - Full audit trail                                      │
│ - Source attribution                                    │
└─────────────────────────────────────────────────────────┘

                 ↕ (trail engine)

┌─────────────────────────────────────────────────────────┐
│ USER EXPERIENCE                                          │
│ - Multi-hop queries across all floors                   │
│ - Living entity pages as primary interface              │
│ - Full traceability (entity → chunk → document)         │
│ - Contextual AI chat scoped to entities                 │
└─────────────────────────────────────────────────────────┘
```

---

## 🗓️ **Phase-by-Phase Plan**

### **Phase 1: Multi-Floor Architecture** (Week 1, 3-5 days)

**Goal:** Foundation for everything else

**What to Build:**
1. **Database Schema:**
   - `floor_bridges` table
   - `trail_executions` audit log
   - Indexes for performance

2. **Graph Pull Function:**
   - Port from R2R project
   - Correct ID mapping (no bugs!)
   - Document → Graph entity migration

3. **Trail Engine:**
   - Multi-hop traversal
   - Cross-floor bridges
   - Query execution

4. **API Endpoints:**
   - `POST /trails/execute` - Execute trail
   - `GET /trails/templates` - List templates
   - `POST /trails/validate` - Validate config

**Files to Port:**
- `migrations/004_auto_bridge_refresh.sql`
- `migrations/005_graph_pull_function.sql`
- `apps/api/services/graph_manager.py` (if needed)
- `apps/api/services/trail_engine.py`
- `apps/api/routes/trails.py`

**Success Criteria:**
- ✅ Floor bridges created automatically
- ✅ Multi-hop queries working
- ✅ Trail execution < 1 second
- ✅ All tests passing

**Why First?**
- Foundation for Living Entities (Floor D)
- Enables cross-floor reasoning
- Unlocks true graph traversal

---

### **Phase 2: DEG-RAG** (Week 2-3, 1-2 weeks)

**Goal:** Clean, accurate knowledge graph

**What to Build:**
1. **Entity Resolution:**
   - Cross-document deduplication
   - Semantic similarity matching (0.85 threshold)
   - LLM verification for borderline cases
   - Merge duplicates with audit trail

2. **Triple Reflection:**
   - Relationship scoring
   - Prune weak/contradictory edges
   - Directionality corrections
   - Evidence-based verification

3. **Database Schema:**
   - `kg_ops.candidate_merges`
   - `kg_ops.candidate_relation_prune`
   - `kg_ops.audit_log`

4. **Automation:**
   - Nightly job for entity resolution
   - Nightly job for triple reflection
   - Manual review UI (optional)

**Files to Reference:**
- `docs/from_r2r_project/DEG-RAG.md`
- `docs/from_r2r_project/relationship_expansion.md`

**Success Criteria:**
- ✅ Duplicate entities merged
- ✅ Weak relationships pruned
- ✅ Graph quality improved (measurable)
- ✅ Audit trail complete

**Why Second?**
- Living Entities need clean graph entities
- Better foundation = better auto-updates
- Improves graph search quality

---

### **Phase 3: Living Entities** (Week 4-6, 2-3 weeks)

**Goal:** THE killer feature - curated knowledge pages

#### **Week 4: Backend Foundation**

**What to Build:**
1. **Database Schema:**
   - `living_entities` table
   - `living_entity_relationships` table
   - `living_entity_updates` audit trail
   - `living_entity_graph_links` bridge table

2. **Template System:**
   - Template registry (TypeScript/Python)
   - Material template (7 sections)
   - Mine template (4+ sections)
   - Supplier template
   - Validation against JSON Schema

3. **API Endpoints:**
   - `GET /api/entities` - List entities
   - `GET /api/entities/[slug]` - Get entity
   - `POST /api/entities/[slug]/update` - Manual update
   - `GET /api/templates` - List templates
   - `GET /api/templates/[type]` - Get template

**Files to Create:**
- `supabase/migrations/XXX_living_entities.sql`
- `apps/web/lib/entities/templates.ts`
- `apps/web/lib/entities/registry.ts`
- `apps/api/routes/entities.py` (if needed)

**Success Criteria:**
- ✅ Database tables created
- ✅ Templates defined and validated
- ✅ API endpoints working
- ✅ Can create/read entities manually

#### **Week 5: CrewAI Integration**

**What to Build:**
1. **5-Agent System:**
   - Identifier Agent (which entities to update?)
   - Extractor Agent (pull structured info)
   - Synthesizer Agent (merge without duplication)
   - Linker Agent (create relationships)
   - Validator Agent (ensure quality)

2. **Update Workflow:**
   - Trigger on document ingestion
   - Process through 5 agents
   - Apply approved updates
   - Log to audit trail

3. **Integration:**
   - Hook into document processing pipeline
   - Background job queue
   - Error handling and retries

**Files to Create:**
- `apps/backend/ingest/crews/living_entity_update_crew.py`
- `apps/backend/ingest/crews/agents/` (5 agent files)
- `apps/backend/ingest/crews/tools/` (custom tools)

**Success Criteria:**
- ✅ CrewAI agents working
- ✅ Auto-updates on new content
- ✅ Quality validation passing
- ✅ Audit trail complete

#### **Week 6: Frontend UI**

**What to Build:**
1. **Entity Pages:**
   - Entity directory/list
   - Individual entity page
   - Template-based section rendering
   - Related entities sidebar

2. **Components:**
   - `EntityPage` - Main layout
   - `EntitySection` - Section renderer
   - `EntityTimeline` - Recent developments
   - `EntityRelationships` - Related entities
   - `EntityChat` - Scoped AI chat

3. **Navigation:**
   - Add "Entities" to main nav
   - Entity type filters
   - Search living entities
   - Breadcrumb navigation

**Files to Create:**
- `apps/web/app/(app)/entities/page.tsx`
- `apps/web/app/(app)/entities/[slug]/page.tsx`
- `apps/web/components/entities/` (all components)

**Success Criteria:**
- ✅ Entity pages rendering
- ✅ Navigation working
- ✅ Sections display correctly
- ✅ Related entities linked
- ✅ Mobile responsive

---

## 🎯 **Success Metrics**

### **Phase 1 (Multi-Floor):**
- Multi-hop queries execute in < 1 second
- Floor bridges created automatically
- Trail engine handles complex traversals

### **Phase 2 (DEG-RAG):**
- 80%+ duplicate entities merged
- 50%+ weak relationships pruned
- Graph search quality improved (measurable)

### **Phase 3 (Living Entities):**
- 5+ entity types with templates
- 20+ living entities created
- Auto-updates working on new content
- Users prefer entity pages over search

---

## 💡 **Key Integration Points**

### **1. Document Processing → Living Entities**

```python
# apps/backend/ingest/main.py

async def process_document(doc_id):
    # Existing pipeline
    chunks = await chunk_document(doc_id)
    embeddings = await generate_embeddings(chunks)
    graph_entities = await extract_entities(chunks)
    
    # NEW: Graph pull (Phase 1)
    await graph_manager.pull_graph(collection_id)
    await graph_manager.refresh_bridges(collection_id)
    
    # NEW: DEG-RAG (Phase 2)
    await deg_rag.resolve_entities(collection_id)
    await deg_rag.prune_relationships(collection_id)
    
    # NEW: Living entity update (Phase 3)
    await trigger_living_entity_update(doc_id, 'document')
```

### **2. Search → Living Entities**

```typescript
// Search can return living entities
<SearchResults>
  <LivingEntityCard slug="antimony" type="material" />
  <DocumentCard id="doc_123" />
  <ChunkCard id="chunk_456" />
</SearchResults>
```

### **3. Chat → Living Entities**

```typescript
// Chat can reference and link to entities
<ChatMessage>
  <Text>Antimony is a critical material...</Text>
  <EntityCard slug="antimony" inline />
  <Button href="/entities/antimony">Learn More</Button>
</ChatMessage>
```

### **4. Graph → Living Entities**

```typescript
// Graph entities can "promote" to living entities
<GraphEntityCard entity={entity}>
  {entity.mention_count > 50 && (
    <Button onClick={() => promoteToLivingEntity(entity)}>
      Create Living Entity Page
    </Button>
  )}
</GraphEntityCard>
```

---

## 🚧 **Potential Challenges**

### **Challenge 1: CrewAI Complexity**
**Risk:** 5-agent system might be overkill  
**Mitigation:** Start with 3 agents (Identifier, Extractor, Validator), add others later

### **Challenge 2: Template Design**
**Risk:** Templates might not fit all use cases  
**Mitigation:** Start with 2-3 entity types, iterate based on feedback

### **Challenge 3: Update Frequency**
**Risk:** Too many updates = noise  
**Mitigation:** Confidence thresholds, manual review for low-confidence updates

### **Challenge 4: Performance**
**Risk:** Multi-floor queries might be slow  
**Mitigation:** Caching, materialized views, query optimization

---

## 📊 **Resource Requirements**

### **Development Time:**
- **Phase 1:** 3-5 days (1 developer)
- **Phase 2:** 1-2 weeks (1 developer)
- **Phase 3:** 2-3 weeks (1-2 developers)
- **Total:** 4-6 weeks

### **Infrastructure:**
- Supabase (existing)
- OpenAI API (existing)
- CrewAI (new, ~$0.01-0.05 per document)
- No additional services needed

### **Cost Estimate:**
- **Multi-Floor:** $0 (just SQL)
- **DEG-RAG:** ~$0.002 per entity (LLM verification)
- **Living Entities:** ~$0.01-0.05 per document (CrewAI updates)
- **Total:** ~$0.02-0.07 per document (very reasonable)

---

## 🎓 **Learning from R2R Experiment**

### **What to Keep from R2R:**
1. ✅ Multi-floor architecture concept
2. ✅ DEG-RAG methodology
3. ✅ SQL-based graph pull (faster than SDK)
4. ✅ Deferred optimization patterns
5. ✅ Comprehensive documentation

### **What to Avoid from R2R:**
1. ❌ Hatchet orchestration (too complex)
2. ❌ Complex chunking strategies (KISS principle)
3. ❌ Fighting framework opinions
4. ❌ Over-engineering base layers

### **What You Already Have Better:**
1. ✅ Docling VLM (20-40x faster)
2. ✅ Smart graph extraction (selective)
3. ✅ Frontend graph management
4. ✅ Vercel AI SDK integration
5. ✅ Simple, maintainable architecture

---

## 🎯 **The Bottom Line**

**You have 80% of what you need already built and working.**

**The 20% to add:**
1. Multi-floor architecture (foundation)
2. DEG-RAG (quality)
3. Living Entities (killer feature)

**Timeline:** 4-6 weeks  
**Effort:** Moderate (building on solid foundation)  
**Impact:** Transforms Mosaic into "Mosaic for X" platform

**This is achievable, valuable, and the right path forward.**

---

## 📝 **Next Steps**

### **Immediate (This Week):**
1. ✅ Review and approve this plan
2. ✅ Decide on Phase 1 start date
3. ✅ Set up project tracking (if needed)

### **Phase 1 Kickoff:**
1. Port multi-floor SQL migrations
2. Test graph pull function
3. Implement trail engine
4. Create API endpoints
5. Write tests

### **Communication:**
- Weekly progress updates
- Demo after each phase
- Adjust plan based on learnings

---

**Status:** Ready to Execute  
**Confidence:** High (building on proven foundation)  
**Next Action:** Get approval and start Phase 1! 🚀
