# Items Requiring Further Decisions

This document contains items from INBOX that need additional decisions or research before they can be added to BUILD_PLAN.

---

## 🧹 Infrastructure Cleanup & Optimization

### 1. Render Infrastructure Cleanup ✅ COMPLETED

**mosaic-ingest Worker:**
- **Status:** SUSPENDED (no cost)
- **Reason:** Using local worker successfully
- **Savings:** $32.50/month ($25 worker + $2.50 disk)
- **Action:** Keep suspended as backup

**mosaic-api Service:**
- **Status:** ACTIVE but unused
- **Reason:** No source code exists, web app uses Next.js API routes
- **Savings:** $7/month if deleted
- **Action:** DELETE service

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

### 1. Structured Data & Spreadsheet Intelligence

**Current State:**
- ✅ CSV/XLSX files are processed by Docling
- ✅ Tables extracted and converted to markdown
- ✅ Basic chunking preserves table structure
- ❌ No semantic understanding of data
- ❌ No statistical analysis or narratives
- ❌ Queries like "What was average revenue?" don't work well

**The Problem:**
Traditional RAG struggles with structured data because:
- Tables chunked row-by-row lose context
- Column headers separated from data lose meaning
- Semantic search on raw CSV data performs poorly
- Users can't ask analytical questions about the data

**Proposed Solution: Lightweight CSV Intelligence**

**Phase 1: Document-Level Narratives Only** (2-3 days, ~$0.05/CSV)
- [ ] Detect CSV/XLSX uploads
- [ ] Generate single document-level summary:
  - What the data represents
  - Key columns and their purposes
  - Data quality observations (missing values, outliers)
  - Notable patterns or characteristics
  - Potential use cases
- [ ] Embed summary alongside table chunks
- [ ] Cost: ~$0.05 per CSV (one LLM call)
- [ ] Skip: Column narratives, trends, anomalies (too expensive)
- [ ] Skip: Long-table format (storage explosion)

**Phase 2: Optional Deep Analysis** (User-triggered, 1-2 days)
- [ ] Add "Analyze Data" button for CSVs
- [ ] User can trigger expensive analysis on-demand:
  - Statistical analysis
  - Trend detection
  - Anomaly identification
  - Column-specific narratives
- [ ] Show cost estimate before processing
- [ ] Cost: ~$0.20-0.50 per CSV (multiple LLM calls)

**Phase 3: Query-Time Analysis** (Future, 2-3 days)
- [ ] When user asks analytical question:
  - Detect it's about structured data
  - Fetch raw CSV data
  - Run analysis on-the-fly
  - Return answer with data context
- [ ] Cost: Pay only when users ask questions
- [ ] More flexible than pre-generating everything

**Implementation Approach:**

```python
# Lightweight approach
def process_csv(file_path, document_id):
    # 1. Load CSV
    df = pd.read_csv(file_path)
    
    # 2. Generate single summary
    summary = generate_csv_summary(df)  # One LLM call
    
    # 3. Create summary chunk
    create_chunk(summary, metadata={'type': 'csv_summary'})
    
    # 4. Store original table as markdown (current approach)
    table_markdown = df.to_markdown()
    create_chunks(table_markdown)
    
    return {'summary_generated': True, 'cost': 0.05}
```

**Cost Analysis:**

**Current Approach (Free):**
- Just store table as markdown
- No semantic understanding
- Poor for analytical queries

**Phase 1 (Cheap):**
- $0.05 per CSV
- At 100 CSVs/month: **$5/month**
- Significant improvement for discovery
- Users can find relevant CSVs via summaries

**Full "Long Table + Narrative" (Expensive):**
- $0.50+ per CSV
- At 100 CSVs/month: **$50/month**
- Overkill for most use cases
- Complex to maintain

**Decision Criteria:**

**Implement Phase 1 if:**
- ✅ Users upload >10 CSVs/month
- ✅ Users search for "data about X" and can't find CSVs
- ✅ Current table handling isn't discoverable enough

**Implement Phase 2 if:**
- ✅ Users ask analytical questions ("What's the average?")
- ✅ Users need trend analysis or anomaly detection
- ✅ Willing to pay $0.20-0.50 per analysis

**Don't implement if:**
- ❌ Users rarely upload CSVs (<5/month)
- ❌ Users don't ask analytical questions
- ❌ Current table handling is sufficient

**Recommended Action:**

1. **Monitor CSV usage** for 1-2 months:
   - Track: How many CSVs uploaded?
   - Track: How often are they searched?
   - Track: What questions do users ask?

2. **Start with Phase 1** if usage justifies it:
   - Low cost ($5/month for 100 CSVs)
   - Clear value (better discovery)
   - Simple to implement (2-3 days)

3. **Add Phase 2** only if users demand it:
   - User-triggered (they control cost)
   - Show value before implementing
   - Validate with user feedback

**Alternative: Query-Time Processing**

Instead of pre-processing all CSVs, process on-demand:
- User asks: "What was Q3 revenue in this spreadsheet?"
- System fetches raw CSV data
- Runs analysis on-the-fly
- Returns answer with context
- Cost: Only pay when users ask questions
- More flexible, less upfront cost

**Priority:** Low (Wait for user demand signal)

**Estimated Effort:**
- Phase 1: 2-3 days
- Phase 2: 1-2 days
- Phase 3: 2-3 days

**Reference:** Full implementation details in `docs/structured-data-approch.md`

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

### 1. Entity Deduplication During Extraction

**Current State:** Entities are extracted without checking for existing duplicates, leading to graph pollution.

**Proposed Solution:** Add entity resolution step during extraction to match against existing entities before creating new ones.

**Implementation Phases:**
- **Phase 1:** Simple exact matching (1-2 days)
- **Phase 2:** Fuzzy matching with confidence scores (2-3 days)  
- **Phase 3:** LLM-powered contextual resolution (future)

**Benefits:**
- Cleaner knowledge graph
- Better relationship accumulation
- Improved search quality
- Prevention vs cure approach

**Challenges:**
- Performance (checking against thousands of entities)
- False positives ("Apple" company vs fruit)
- Context dependence
- Entity evolution over time

**Decision Needed:**
- Should we implement Phase 1 now or wait?
- Does this complement or replace Phase 10.1 (Entity Deduplication & Merge Assistant)?
- What's the priority vs other graph improvements?

**Recommendation:** Implement Phase 1 (exact matching) as it's low-effort and provides immediate value. Phase 2 can wait for user feedback.

**Priority:** Medium  
**Estimated Effort:** 2-5 days (phased)

**Reference:** Full details in INBOX

---

### 2. Vercel AI SDK Tool-Based Architecture

**Current State:** Chat always calls search endpoint. Phase 1 (message persistence) completed.

**Proposed Next Steps:**
- Make search a tool (AI decides when to search)
- Enable multi-step reasoning
- Add knowledge management tools
- Optimize with caching

**Decision Needed:**
- Proceed with Phase 2 (tool-based search) now?
- What's the priority vs other chat improvements?
- Should we complete this before multi-tenant work?

**Benefits:**
- More natural conversation flow
- Fewer unnecessary searches (30-50% reduction)
- Can search multiple times per query
- Better AI decision-making

**Recommendation:** High priority - this is a significant UX improvement that aligns with industry best practices.

**Priority:** High  
**Estimated Effort:** 2-3 days for Phase 2

**Reference:** Full implementation plan in INBOX

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
