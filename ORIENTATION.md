# Mosaic Project Orientation

**Created:** 2025-10-29  
**Purpose:** Complete understanding of the Mosaic project structure and current state

---

## 🎯 **What I'm Looking At**

This is the **ORIGINAL Mosaic build** - the one that was working BEFORE the R2R experiment. Based on my analysis from the R2R project, **this is the superior architecture** and we should build on this, not R2R.

---

## 📁 **Project Structure**

### **Root Level**
```
/Users/chrisgscott/projects/mosaic/
├── apps/
│   ├── backend/ingest/     # Python document processing worker
│   └── web/                # Next.js frontend
├── supabase/               # Database migrations and config
├── docs/                   # Documentation
│   └── from_r2r_project/   # Imported docs from R2R experiment ✨
├── BUILD_PLAN.md           # Main build plan (3168 lines!)
├── INBOX.md                # New ideas and enhancements
├── COMPLETED_ITEMS.md      # Historical record of completed work
└── Various feature docs    # Chunking, prompts, models, etc.
```

---

## 🏗️ **Current Architecture**

### **Backend: Python Document Processing Worker**
**Location:** `apps/backend/ingest/`

**What It Does:**
- Polls pgmq queue for document processing jobs
- Downloads files from Supabase Storage
- **Docling VLM** for text extraction (20-40x faster than R2R!)
- Multiple chunking strategies:
  - ✅ **Hybrid Chunker** (default, fast, free)
  - ✅ **Agentic Chunker** (LLM-powered, ~$0.30/doc)
  - ✅ **Planner-Executor** (global awareness, ~$0.07/doc)
  - ✅ **The Sorting Hat** 🎩 (auto-selects optimal strategy)
- **Graph extraction** (entities + relationships)
- **Embeddings** (OpenAI text-embedding-3-small)
- Stores everything in Postgres

**Key Features:**
- Settings service (database-driven config)
- pgvector for semantic deduplication (0.85 threshold)
- Smart entity extraction (3-7 entities per chunk, selective)
- Non-blocking async processing

### **Frontend: Next.js Web App**
**Location:** `apps/web/`

**Pages:**
- `/documents` - Upload, manage, view documents
- `/search` - Semantic + hybrid search
- `/graph` - Entity and relationship management
- `/chat` - RAG chat interface
- `/settings` - System configuration

**Key Features:**
- ✅ **Vercel AI SDK integration** (complete migration)
- ✅ **8 LLM settings** (quick, summary, standard, detailed, deep research, VLM, embedding, temperature)
- ✅ **Prompt management system** (database-driven)
- ✅ **Real-time status updates** (Supabase Realtime)
- ✅ **Graph management UI** (CRUD, visualization)

### **Database: Supabase (PostgreSQL + pgvector)**

**Core Tables:**
- `documents` - Document metadata and status
- `chunks` - Text chunks with embeddings
- `entities` - Extracted entities (11 types)
- `relationships` - Entity relationships (12 types)
- `embeddings` - Vector embeddings for semantic search
- `system_settings` - LLM and prompt configuration

**Extensions:**
- pgvector - Vector similarity search
- pgmq - Message queue for async processing

---

## ✅ **What's Already Working**

### **Phases 1-8 Complete:**
1. ✅ **Core Upload Infrastructure** - Documents, storage, queue
2. ✅ **Real-Time Status Updates** - Supabase Realtime
3. ✅ **Document Processing** - Docling VLM, parallel processing
4. ✅ **Vector Embeddings** - OpenAI, pgvector, semantic search
5. ✅ **Graph RAG** - Entity/relationship extraction
6. ✅ **Search** - Hybrid (semantic + BM25), reranking
7. ✅ **Advanced Chunking** - Multiple strategies, Sorting Hat
8. ✅ **Model & Prompt Management** - Centralized, database-driven

### **Production-Ready Features:**
- Upload → Processing → Embeddings → Graph RAG → Search (end-to-end)
- All document types: PDF, PPTX, TXT, CSV, MD
- Real-time progress tracking
- Concurrent document processing
- Smart chunking strategy selection
- Graph visualization and management

---

## 📚 **Imported R2R Documentation**

**Location:** `docs/from_r2r_project/`

**Key Files:**
1. **CARRYOVER_SUMMARY.md** - What to port from R2R (multi-floor architecture)
2. **DEG-RAG.md** - Graph denoising implementation guide
3. **LLM_PRICING.md** - Cost optimization strategies
4. **COGNITIVE_CARTOGRAPHY.md** - Multi-floor conceptual foundation
5. **relationship_expansion.md** - Relation expansion (REG) module
6. **BUILD_PLAN.md** - R2R build plan (for reference)
7. **INBOX.md** - R2R ideas (for reference)

**Key Insight from R2R Experiment:**
> "Your previous Mosaic build is objectively better than R2R in almost every way. The ONLY thing R2R taught us was multi-floor architecture."

---

## 🎯 **What Needs to Be Added (From R2R)**

### **1. Multi-Floor Architecture** (CRITICAL - Foundation for Everything)

**What It Is:**
- Floor A (Text): Chunks with embeddings
- Floor B (Symbolic): Entities and relationships  
- Floor C (Structure): Documents and provenance
- **Floor D (Living Entities):** Curated, structured knowledge pages ⭐
- Floor Bridges: Connections between floors
- Trail Engine: Multi-hop traversal across floors

**Why We Need It:**
- True multi-hop graph traversal (not just vector search)
- Cross-floor reasoning (chunk → entity → document → living entity)
- Foundation for Living Entities
- Temporal tracking (future)
- Explainable AI paths

**What to Port:**
- SQL migrations for `floor_bridges` table
- Graph pull function (correct ID mapping)
- Trail execution engine
- Trail API endpoints

**Status:** ❌ Not yet implemented in this project

**How Living Entities Enhance Multi-Floor:**
```
User Query: "What do I need to know about Antimony?"
    ↓
Floor D: Living Entity Page (comprehensive, structured)
    ↓ (bridges)
Floor B: Graph Entities (all Antimony mentions)
    ↓ (bridges)
Floor A: Chunks (source evidence)
    ↓ (bridges)
Floor C: Documents (provenance)

Result: Complete knowledge with full traceability
```

### **2. DEG-RAG (Graph Denoising)** (HIGH VALUE - Critical for Living Entities)

**What It Is:**
- Entity Resolution: Cross-document deduplication
- Triple Reflection: Relationship pruning
- Evidence-Based Verification: LLM verification with quotes
- Directionality Corrections: Fix reversed relationships

**Why We Need It:**
- Cleaner, more accurate knowledge graph
- Remove duplicate entities across documents
- Prune weak/contradictory relationships
- **Essential for Living Entities** - Clean graph entities = better living entity updates

**Status:** ❌ Not yet implemented

**How DEG-RAG Enables Living Entities:**
```
Without DEG-RAG:
- "MP Materials", "MP Materials Corp", "MP Mat." = 3 entities
- Living Entity update crew gets confused
- Duplicate/conflicting information

With DEG-RAG:
- All merged into one canonical "MP Materials" entity
- Living Entity update crew has clean data
- Accurate, consistent updates
```

---

## 🔧 **Current Strengths (Keep These!)**

### **What Makes This Build Better Than R2R:**

1. ✅ **Docling VLM** - 20-40x faster than R2R's processing
2. ✅ **Smart Graph Extraction** - Selective (3-7 entities/chunk) vs R2R's extract-everything
3. ✅ **pgvector Deduplication** - Working, efficient (0.85 threshold)
4. ✅ **Settings Service** - Database-driven config (better than R2R's TOML)
5. ✅ **Frontend Graph Management** - Full CRUD, visualization, AI cleanup
6. ✅ **Simple Architecture** - pgmq polling (no Hatchet complexity)
7. ✅ **Structure-Aware Chunking** - Simple, fast, free (uses Docling's natural structure)
8. ✅ **Vercel AI SDK** - Modern, clean chat implementation
9. ✅ **Living Entities Concept** - Documented, ready to implement (THE killer feature)

---

## 📊 **Performance Metrics**

### **Document Processing:**
- **Speed:** 3-7 min for 200 pages (Docling VLM)
- **Cost:** ~$0.008/document (optimized)
- **Quality:** Selective entity extraction (3-7 per chunk)

### **Graph Extraction:**
- **Speed:** ~2-3 seconds per chunk
- **Cost:** ~$0.0015 per chunk (GPT-4o-mini)
- **Deduplication:** 0.85 similarity threshold (pgvector)

### **Search:**
- **Hybrid:** Semantic + BM25 with RRF
- **Reranking:** Cohere
- **Performance:** Fast, accurate

---

## 🚀 **Next Steps (Recommended)**

### **Phase 1: Add Multi-Floor Architecture** (Week 1)
1. Port SQL migrations from R2R project
2. Implement graph pull function (correct ID mapping)
3. Create trail execution engine
4. Add trail API endpoints
5. Test end-to-end: Upload → Extract → Pull → Bridges → Traverse

### **Phase 2: Add DEG-RAG** (Week 2-3)
1. Create `kg_ops` schema
2. Implement entity resolution (cross-document dedup)
3. Implement triple reflection (relationship pruning)
4. Add LLM verification with evidence
5. Schedule as nightly job

### **Phase 3: Optimize & Polish** (Week 4)
1. Implement deferred embedding generation (70% cost savings)
2. Fix chunk_ids appending in graph pull
3. Add LLM pricing tiers to settings
4. Add monitoring and metrics

---

## 💡 **Key Learnings from R2R Experiment**

### **What Worked:**
1. ✅ Multi-floor architecture concept (brilliant!)
2. ✅ SQL-based graph pull (faster than R2R SDK)
3. ✅ Trail execution engine (clean, composable)
4. ✅ Deferred optimization (70% cost savings)
5. ✅ Comprehensive documentation

### **What Didn't Work:**
1. ❌ R2R framework (too opinionated, too complex)
2. ❌ Hatchet orchestration (overkill)
3. ❌ R2R's graph.pull() (broken, had to bypass)
4. ❌ Complex chunking (no clear ROI)
5. ❌ Fighting R2R's opinions (wasted time)

### **The Bottom Line:**
> "Your previous build + multi-floor = Perfect RAG system. No R2R needed."

---

## 📝 **Important Files to Review**

### **Build Planning:**
- `BUILD_PLAN.md` - Main roadmap (phases 1-8 complete)
- `INBOX.md` - New ideas and enhancements
- `COMPLETED_ITEMS.md` - Historical record
- `CHUNKING_IMPROVEMENTS_PLAN.md` - Simplified chunking approach

### **Technical Docs:**
- `apps/backend/ingest/GRAPH_EXTRACTION.md` - Graph RAG integration
- `apps/backend/ingest/SUMMARY.md` - Architecture overview
- `PROMPT_MANAGEMENT_SYSTEM.md` - Prompt system

### **Living Entities (THE KILLER FEATURE):**
- `LIVING_ENTITIES_SUMMARY.md` - Quick overview (start here!)
- `docs/living_entities/README.md` - Concept and vision
- `docs/living_entities/01_architecture.md` - Database schema and templates
- `docs/living_entities/02_crewai_agents.md` - 5-agent update system
- `docs/living_entities/03_update_workflow.md` - End-to-end workflow

### **R2R Imports:**
- `docs/from_r2r_project/CARRYOVER_SUMMARY.md` - Migration guide
- `docs/from_r2r_project/DEG-RAG.md` - Graph denoising
- `docs/from_r2r_project/COGNITIVE_CARTOGRAPHY.md` - Multi-floor concept
- `docs/from_r2r_project/relationship_expansion.md` - Relation expansion

---

## 🎓 **Architecture Philosophy**

### **Core Principles:**
1. **KISS** - Keep It Simple, Stupid
2. **YAGNI** - You Ain't Gonna Need It
3. **Modular** - Each component independent
4. **Composable** - Can be combined in recipes
5. **Progressive** - Start simple, add complexity when needed

### **Build Strategy:**
1. Build query enhancement as standalone functions
2. Use LLM router for short-term orchestration
3. Add CrewAI when specific use cases demand it
4. Focus on proven ROI techniques first
5. Don't over-engineer

---

## 🔍 **Current Status**

### **What's Working:**
- ✅ End-to-end document processing pipeline
- ✅ Semantic + hybrid search
- ✅ Graph RAG (entities + relationships)
- ✅ Multiple chunking strategies
- ✅ Real-time status updates
- ✅ Graph management UI
- ✅ Model and prompt management

### **What's Missing:**
- ❌ Multi-floor architecture (floor bridges, trail engine)
- ❌ DEG-RAG (entity resolution, triple reflection)
- ❌ Living Entities (database, templates, CrewAI agents, UI)
- ❌ Cross-document entity deduplication
- ❌ Relationship pruning and validation

### **What's Next (Recommended Priority):**

**Phase 1: Multi-Floor Architecture** (3-5 days)
- Foundation for everything else
- Enables cross-floor traversal
- Prepares for Living Entities (Floor D)

**Phase 2: DEG-RAG** (1-2 weeks)
- Clean up graph entities
- Essential for Living Entities quality
- Improve graph search

**Phase 3: Living Entities** (2-3 weeks)
- Database schema and migrations
- Template system (Material, Mine, Supplier, etc.)
- CrewAI 5-agent update system
- Update workflow integration
- Basic UI components

**Total Timeline:** 4-6 weeks to production-ready with full stack

**Why This Order?**
1. Multi-floor gives you the architecture
2. DEG-RAG gives you clean entities
3. Living Entities builds on both for maximum impact

---

## 🎯 **Success Criteria**

You'll know the migration is successful when:

1. ✅ Multi-floor schema deployed (floor_bridges table)
2. ✅ Graph pull function working (correct ID mapping)
3. ✅ Trail execution engine operational
4. ✅ Multi-hop queries working (<1 second)
5. ✅ DEG-RAG running (entity resolution + triple reflection)
6. ✅ Graph quality improved (cleaner, more accurate)
7. ✅ Costs optimized (deferred embeddings, model ladder)

---

## 📞 **Quick Reference**

### **Project Locations:**
- **This Project:** `/Users/chrisgscott/projects/mosaic` (CURRENT)
- **R2R Experiment:** `/Users/chrisgscott/projects/mosaic-r2r` (REFERENCE ONLY)

### **Key Commands:**
```bash
# Backend worker
cd apps/backend/ingest
python main.py

# Frontend
cd apps/web
npm run dev

# Database migrations
cd supabase
supabase db push
```

### **Key Contacts:**
- **Owner:** Chris Scott (@chrisgscott)
- **Status:** Production-ready core, adding multi-floor next

---

**Last Updated:** 2025-10-29  
**Status:** Oriented and Ready to Build! 🚀  
**Next Action:** Review multi-floor architecture docs and plan implementation
