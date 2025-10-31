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

### 1. ✅ ALREADY IN BUILD_PLAN: Entity Deduplication During Extraction

**Status:** Already covered in Phase 7.1 DEG-RAG Implementation  
**Reference:** See "Entity resolution across documents" in BUILD_PLAN.md

---

### 2. ✅ MOVED TO BUILD_PLAN: Vercel AI SDK Tool-Based Architecture

**Status:** Moved to Phase 6.4 in BUILD_PLAN  
**Priority:** High  
**Current State:** Phase 1 complete, Phase 2 ready to start

**Implementation:** 
- Phase 2: Tool-based search (2-3 days)
- Benefits: 30-50% fewer unnecessary searches, better UX

**Reference:** See Phase 6.4 in BUILD_PLAN.md

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

### 4. Intelligent Query Caching

**Current State:** No caching, every search runs full pipeline (500-1000ms).

**Proposed Solution:**
- **Phase 1:** Simple query cache with TTL (1-2 days)
- **Phase 2:** Semantic cache matching (2-3 days)
- **Phase 3:** Smart pre-computation (2-3 days)
- **Phase 4:** Query prediction (2-3 days)

**Expected Results:**
- 30-50% cache hit rate
- <50ms response for cached queries (10-20x faster)
- Reduced API costs

**Decision Needed:**
- Implement Phase 1 now for quick wins?
- What's the priority vs other performance improvements?
- Should this wait until we have more usage data?

**Recommendation:** Implement Phase 1 now - it's a quick win with immediate impact.

**Priority:** High (performance + cost savings)  
**Estimated Effort:** 1-2 days for Phase 1

**Reference:** Full details in INBOX

---

### 5. OpenAI Structured Outputs Migration

**Current State:**
- ✅ Planner-Executor Chunker migrated (Oct 23, 2025)
- ⏳ Sorting Hat still uses JSON mode
- ⏳ Agentic Chunker still uses JSON mode
- ⏳ Graph Extractor still uses JSON mode

**Benefits:**
- 100% schema adherence (vs ~95% with JSON mode)
- Type safety with Pydantic
- Better error handling
- Future-proof

**Decision Needed:**
- Complete migration for remaining files?
- What's the priority vs other improvements?
- Should we wait for streaming support in SDK?

**Recommendation:** Low priority - current JSON mode works fine. Complete when doing other chunker improvements.

**Priority:** Low  
**Estimated Effort:** 1-2 days total

**Reference:** Migration pattern in INBOX

---

### 6. MCP Server for External Tool Integration

**Current State:** Edge Function provides search endpoint with API key auth.

**Proposed Solution:** Build MCP server to expose multiple tools (search, graph, documents) under standard protocol.

**Benefits:**
- Native integration with Claude Desktop, Cline
- Standard protocol for tool discovery
- Type-safe API with automatic docs
- Single endpoint for multiple capabilities

**Decision Needed:**
- Is external tool integration a priority?
- Do we have users requesting n8n/Make/Zapier integration?
- Should this wait until multi-tenant is implemented?

**Recommendation:** Medium priority - wait for user demand signals before investing 1-2 weeks.

**Priority:** Medium (wait for demand)  
**Estimated Effort:** 1-2 weeks

**Reference:** Full architecture in INBOX

---

### 7. Custom Relationship Types - Python Integration

**Current State:**
- ✅ Schema settings page implemented (Oct 31, 2025)
- ✅ UI loads types from database
- ⏳ Python extractor still uses hardcoded types

**Decision Needed:**
- Should Python extractor load types from database?
- What's the fallback if database unavailable?
- Is this worth 2-3 days of effort?

**Recommendation:** Low priority - current approach works. Python integration can wait until we need dynamic types during extraction.

**Priority:** Low  
**Estimated Effort:** 2-3 days

**Reference:** Implementation details in INBOX
