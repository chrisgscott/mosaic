# Items Requiring Further Decisions

This document contains items from INBOX that need additional decisions or research before they can be added to BUILD_PLAN.

---

## 🧹 Infrastructure Cleanup & Optimization

### 1. Render Infrastructure Cleanup ✅ COMPLETED

**mosaic-ingest Worker:**
- **Status:** SUSPENDED (no cost)
- **Reason:** Using local worker successfully
- **Savings:** $32.50/month ($25 worker + $2.50 disk)
- **Action:** Keep suspended as hosted service for production. Resume when ready to push to prod.

**mosaic-api Service:**
- **Status:** ACTIVE but unused
- **Reason:** No source code exists, web app uses Next.js API routes
- **Savings:** $7/month if deleted
- **Action:** Suspended service.

**Total Potential Savings:** $39.50/month

---

### 2. Lazy Processing Pattern (DEFERRED)

**Decision:** Keep eager processing for now
- Current approach works well
- Better user experience (instant search)
- Reasonable costs for personal/small team usage
- Simpler architecture

**Revisit:** When/if embedding costs become significant

---

## 🤖 Advanced RAG Patterns (Evaluation Needed)

### 1. ✅ MOVED TO BUILD_PLAN: Structured Data & Spreadsheet Intelligence

**Status:** Moved to Phase 8.1 in BUILD_PLAN  
**Priority:** Medium-High (for financial/enterprise implementations)  
**Timeline:** End of Phase 1 or Future Versions

**Implementation:** 
- Phase 1: Document-level narratives (2-3 days, ~$0.05/CSV)
- Phase 2: Optional deep analysis (user-triggered, 1-2 days)

**Reference:** See Phase 8.1 in BUILD_PLAN.md for full details

---

## 📊 Operational Decisions

### 1. Multi-Worker Scaling Strategy

**Current State:** Single worker processing documents sequentially.

**Options:**
1. **Multiple Workers** (Simple) - Deploy 2-3 identical workers, pgmq handles coordination
2. **Multi-threaded Single Worker** (Complex) - ThreadPoolExecutor for concurrent processing
3. **Parallel Page Processing** (Already Implemented) - Docling handles this internally

**Decision Needed:** 
- Monitor queue depth and processing times
- Decide when to scale horizontally (add workers)
- Set thresholds for auto-scaling decisions

**Priority:** Low - Current single worker handles load well. Revisit when processing >10 docs/day consistently.

---

## 🏛️ Architecture Decisions

### 1. Three-Tier Architecture: Multi-Tenant Foundation vs Separate Instances

**Context:** Mosaic will serve as the foundation for multiple client-facing projects. Need to decide on architecture that supports:
- Separate billing per project
- Easy project transfers/sales
- IP protection (keep core platform)
- Independent client customization

**The Three Tiers:**
1. **Tier 1: RAG Backend** - Python ingest, chunking, graph, embeddings
2. **Tier 2: Admin Platform** - Mosaic web app (document mgmt, entity editing, settings)
3. **Tier 3: Client Apps** - Separate repos, lightweight UI + API proxy

**Option A: Multi-Tenant Mosaic (Recommended)**
```
Mosaic Admin Platform (Single Instance)
  ├── Org 1: Newsletter Project
  ├── Org 2: Research Project  
  └── Org 3: Client Project
       ↓
Client Apps (Separate Repos)
  ├── Newsletter App → Calls Mosaic API
  ├── Research App → Calls Mosaic API
  └── Client App → Calls Mosaic API
```

**Pros:**
- ✅ Single admin platform to maintain
- ✅ All improvements benefit all projects
- ✅ Shared infrastructure (cost efficient)
- ✅ Easy to add new projects
- ✅ Client apps are lightweight
- ✅ Can still sell projects (transfer repo + API key)

**Cons:**
- ❌ Requires multi-tenancy implementation (1-2 weeks)
- ❌ All projects share same infrastructure
- ❌ Break one, potentially affect others

**Implementation Required:**
- Organizations table with API keys
- RLS policies for data isolation
- API key authentication middleware
- Cost tracking per organization
- Public API routes (/api/public/search, /api/public/chat)
- Client app template

**Option B: Separate Instances**
```
Project 1: Full Mosaic Instance
Project 2: Full Mosaic Instance
Project 3: Full Mosaic Instance
```

**Pros:**
- ✅ Complete independence
- ✅ Easy to sell (transfer everything)
- ✅ No shared infrastructure risk

**Cons:**
- ❌ Duplicate admin platforms
- ❌ Updates must be applied to each
- ❌ Higher infrastructure costs
- ❌ More maintenance overhead

**Option C: NPM Package Approach**
```
@mosaic/rag-foundation (npm package)
  ↓
Project 1 (imports package)
Project 2 (imports package)
Project 3 (imports package)
```

**Pros:**
- ✅ True separation
- ✅ Versioned releases
- ✅ Projects update on their schedule

**Cons:**
- ❌ More overhead (publishing, versioning)
- ❌ Can get out of sync
- ❌ Need to manually update each project

---

**Key Questions to Answer:**

1. **Timing:** Should we implement multi-tenancy now or wait until we have a second project?
   - **Wait:** Simpler, no premature optimization
   - **Now:** Easier to build in from start than retrofit

2. **Risk Tolerance:** Comfortable with shared infrastructure?
   - **Yes:** Multi-tenant is efficient
   - **No:** Separate instances or NPM package

3. **Maintenance Preference:** One platform vs multiple?
   - **One:** Multi-tenant
   - **Multiple:** Separate instances

4. **Selling Strategy:** How will projects be sold?
   - **With ongoing support:** Multi-tenant (keep API access)
   - **Complete handoff:** Separate instances or NPM package

5. **Integration with Phase 14:** How does this interact with Vercel AI SDK integration?
   - **Multi-tenant:** Public API routes work with tools
   - **Separate:** Each instance has own tools

---

**Recommended Decision Process:**

1. **Immediate (This Week):**
   - Start with Phase 14 (Vercel AI SDK integration)
   - Build first client app as single-tenant
   - Validate the three-tier concept

2. **Short-term (Next 2-4 Weeks):**
   - If second project appears, implement multi-tenancy
   - If no second project, continue single-tenant

3. **Decision Triggers:**
   - **Implement multi-tenancy when:**
     - Second project is confirmed
     - Client wants to use Mosaic
     - Need to demo to multiple audiences
   - **Stay single-tenant if:**
     - Only one project for next 3+ months
     - Uncertain about architecture
     - Want to keep it simple

---

**Priority:** High - Decision needed before building second project

**Estimated Effort (if multi-tenant):**
- Phase 1: Multi-tenancy implementation (1 week)
- Phase 2: Public API routes (2-3 days)
- Phase 3: Client app template (3-5 days)
- Total: 2-3 weeks

**Reference:** Full details in INBOX (now moved here)

---

## 🔄 Graph Architecture Decisions

### 4. Multi-Hop Graph Traversal Implementation

**Current State:** Simple semantic entity search with 1-hop expansion using iterative neighbor discovery in JavaScript.

**Analysis Complete:** Our current implementation is NOT true multi-hop traversal.

**Key Findings:**
- We have: "Find all neighbors" approach
- True multi-hop needs: Recursive SQL with path tracking
- Current: Processes in memory, no path preservation
- True multi-hop: Uses query planner and indexes, tracks specific paths

**Critical Differences:**
| Our Implementation | True Multi-Hop Traversal |
|-------------------|-------------------------|
| Iterative expansion in JS | Recursive SQL in database |
| No path preservation | Tracks specific paths and depth |
| "Find all neighbors" | "Follow specific edge types" |
| Processes in memory | Uses query planner and indexes |

**Decision Needed:**
- **Option A: Defer Multi-Hop** (Recommended)
  - Current needs: Better search answers, not multi-hop reasoning
  - Focus on: Grounding controls, context management, DEG-RAG
  - Revisit when users request complex multi-hop queries
  - Effort: 0 (deferred)

- **Option B: Implement True Multi-Hop**
  - Requires: Recursive SQL functions, path tracking, edge filtering
  - Complexity: 2-3 months (universal cognitive substrate)
  - Like building a space shuttle when you need a car
  - Effort: 2-3 months

**Recommendation:** Defer - R2R built a universal cognitive platform, we need a document knowledge system.

**Priority:** Low - Wait for user demand signals

**Reference:** Complete analysis in INBOX (now moved here)

---

## 🎯 Feature Enhancement Decisions

### 1. ✅ MOVED TO BUILD_PLAN: Entity Deduplication During Extraction

**Status:** Moved to Phase 6.4 in BUILD_PLAN  
**Priority:** Medium  
**Implementation:** 
- Phase 1: Simple exact matching (1-2 days)
- Phase 2: Fuzzy matching with confidence scores (2-3 days)
- Complements DEG-RAG (prevention vs cleanup)

**Reference:** See Phase 6.4 in BUILD_PLAN.md

---

### 2. ✅ MOVED TO BUILD_PLAN: Vercel AI SDK Tool-Based Architecture

**Status:** Moved to Phase 6.5 in BUILD_PLAN  
**Priority:** High  
**Current State:** Phase 1 complete, Phase 2 ready to start

**Implementation:** 
- Phase 2: Tool-based search (2-3 days)
- Benefits: 30-50% fewer unnecessary searches, better UX

**Reference:** See Phase 6.5 in BUILD_PLAN.md

---

### 3. Graph Learning System (Phases 2-6)

**Current State:** Phase 1 (search signal capture) completed and logging.

**Remaining Phases:**
- **Phase 2:** Co-occurrence analysis (3-4 days)
- **Phase 3:** Relationship type inference (2-3 days)
- **Phase 4:** Suggestion review UI (3-4 days)
- **Phase 5:** Real-time inline suggestions (3-5 days)
- **Phase 6:** Autonomous learning (1 week)

**Decision Needed:**
- Wait 1-2 weeks to collect data before Phase 2?
- What's the priority for self-improving graph?
- Should we validate approach with manual analysis first?

**Recommendation:** Let Phase 1 run for 2 weeks, then analyze patterns manually to validate before building Phases 2-3.

**Priority:** Medium-High (innovative feature, but needs data first)  
**Estimated Effort:** 2-3 weeks total (Phases 2-6)

**Reference:** Full design in INBOX and docs/graph-learning.md

---

### 4. ✅ MOVED TO BUILD_PLAN: Intelligent Query Caching

**Status:** Moved to Phase 6.6 in BUILD_PLAN  
**Priority:** High (quick win)  
**Implementation:** 
- Phase 1: Simple query cache with TTL (1-2 days)
- Expected: 30-50% cache hit rate, 10-20x faster for cached queries

**Reference:** See Phase 6.6 in BUILD_PLAN.md

---

### 5. ✅ LOW PRIORITY: OpenAI Structured Outputs Migration

**Status:** Deferred - current JSON mode works fine  
**Priority:** Low  
**Current State:** 1 of 4 files migrated (Planner-Executor complete)
**Action:** Complete when doing other chunker improvements

---

### 6. ✅ ALREADY IN BUILD_PLAN: MCP Server for External Tool Integration

**Status:** Already planned as Phase 10.1 in BUILD_PLAN  
**Priority:** Medium (wait for demand)  
**Reference:** See Phase 10.1 in BUILD_PLAN.md

---

### 7. ✅ COMPLETED: Custom Relationship Types - Python Integration

**Status:** FULLY IMPLEMENTED  
**Completed:** Nov 1, 2025

**What was implemented:**
1. ✅ Added methods to SettingsService:
   - get_entity_types() - Load entity types from database
   - get_relationship_types() - Load relationship types from database
   - enforce_schema_whitelist() - Check if whitelist should be enforced
   - log_unknown_types() - Check if unknown types should be logged

2. ✅ Updated GraphExtractor:
   - Loads entity/relationship types from database during initialization
   - Creates dynamic enums from database settings
   - Uses dynamic types in extraction prompt
   - Falls back to hardcoded types if database unavailable

3. ✅ Updated Entity/Relationship models:
   - Changed from enum types to str for flexibility
   - Maintains compatibility with existing code

**Result:** Custom relationship types are now fully functional end-to-end.
