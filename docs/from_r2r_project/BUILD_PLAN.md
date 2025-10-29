# Mosaic Build Plan

**Reference:** See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for architecture details and installation commands.

**Related Documents:**
- [INBOX.md](./INBOX.md) - Future features and improvements
- [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) - Authentication setup guide

---

## Phase 1: Foundation ✅ (Complete)

- [x] R2R + Supabase integration configured
- [x] Docker setup with session pooler
- [x] Custom R2R configuration (`r2r-supabase.toml`)
- [x] Project structure defined
- [x] Documentation created (PROJECT_STRUCTURE.md, SUPABASE_AUTH_SETUP.md)

**Status:** Complete
**R2R Service:** Running on `http://localhost:7272`

---

## Phase 2: Core Backend API ✅ (Complete)

**Goal:** Python FastAPI backend with R2R integration and Supabase authentication

### 2.1 Python API Setup
**Status:** ✅ Complete
**Priority:** High
**Actual Effort:** 1-2 hours

**Completed:**
- [x] Create `apps/api/` directory structure
- [x] Set up Python virtual environment
- [x] Install dependencies (FastAPI, uvicorn, r2r, supabase, python-dotenv)
- [x] Create `requirements.txt`
- [x] Create `apps/api/.env` file (see PROJECT_STRUCTURE.md for required vars)
- [x] Create `apps/api/main.py` with basic FastAPI server
- [x] Test server starts: `uvicorn main:app --reload --port 8000`
- [x] Verify health check endpoint works

**Dependencies:** None

**Reference:** [PROJECT_STRUCTURE.md - apps/api](./PROJECT_STRUCTURE.md#-appsapi---python-backend-api)

**Commands:**
```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn r2r supabase python-dotenv
pip freeze > requirements.txt
```

---

### 2.2 Authentication Layer
**Status:** ✅ Complete
**Priority:** High
**Actual Effort:** 2-3 hours

**Completed:**
- [x] Create `apps/api/auth.py`
- [x] Implement `User` class (id, email, metadata)
- [x] Implement `get_current_user()` FastAPI dependency
- [x] Add JWT validation using Supabase
- [x] Handle token extraction from Authorization header
- [x] Add error handling for invalid/expired tokens
- [x] Create test route `/rag/me` to verify auth
- [x] Test with real Supabase JWT token
- [x] Bonus: Implement `get_optional_user()` for optional auth

**Dependencies:** 2.1 (Python API Setup)

**Reference:** [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)

**Test Command:**
```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:8000/rag/me
```

---

### 2.3 R2R Integration Layer
**Status:** ✅ Complete
**Priority:** High
**Actual Effort:** 2-3 hours

**Completed:**
- [x] Create `apps/api/rag/` directory
- [x] Create `apps/api/rag/client.py`
- [x] Implement `get_r2r_client()` function
- [x] Create wrapper methods:
  - [x] `search_documents(query, user_id, limit, filters)`
  - [x] `rag_query(query, user_id, rag_generation_config, filters)`
  - [x] User_id filtering implemented
- [x] Add user_id filtering to all operations
- [x] Test connection to R2R service (localhost:7272)
- [x] Verify user isolation works

**Dependencies:** 2.1 (Python API Setup)

**Reference:** [PROJECT_STRUCTURE.md - apps/api/rag](./PROJECT_STRUCTURE.md#-appsapirag---r2r-integration-layer)

**Test:**
```python
from rag.client import get_r2r_client

client = get_r2r_client()
results = client.search("test query", user_id="test-user")
```

---

### 2.4 Core API Routes
**Status:** ✅ Complete
**Priority:** High
**Actual Effort:** 2-3 days

**Completed (2025-10-28):**
- [x] Create `apps/api/routes/` directory structure
- [x] Create `apps/api/routes/test.py`:
  - [x] `GET /test/health` - Health check (no auth)
  - [x] `GET /test/r2r-health` - Test R2R connection (no auth)
  - [x] `GET /test/r2r-auth-test` - Test R2R with JWT auth
- [x] Complete `apps/api/routes/rag.py`:
  - [x] `POST /rag/search` - Search documents (auth required)
  - [x] `POST /rag/search/debug` - Debug search (no auth for testing)
  - [x] `POST /rag/rag` - RAG query with generation (auth required)
  - [x] `POST /rag/ingest` - Upload document (auth required)
  - [x] `GET /rag/documents` - List user's documents (auth required)
  - [x] `DELETE /rag/documents/{doc_id}` - Delete document (auth required)
  - [x] `GET /rag/me` - Get current user info (auth required)
- [x] Add user isolation to all protected routes
- [x] Add proper error handling and status codes
- [x] Test all endpoints with curl
- [x] Bonus: Create `apps/api/routes/trails.py` (Phase 7.2)

**Dependencies:** 2.2 (Authentication), 2.3 (R2R Integration)

**Reference:** [PROJECT_STRUCTURE.md - apps/api/routes](./PROJECT_STRUCTURE.md#-appsapiroutes---api-route-handlers)

**Test Commands:**
```bash
# Health check
curl http://localhost:8000/test/health

# Search (requires auth)
curl -X POST http://localhost:8000/rag/search \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 5}'

# Upload document
curl -X POST http://localhost:8000/documents/upload \
  -H "Authorization: Bearer <JWT>" \
  -F "file=@test.pdf"
```

---

### 2.5 Data Prep & Validation (Optional)
**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2-3 days

**Tasks:**
- [ ] Create `apps/api/services/document_prep.py`
- [ ] Implement content hash duplicate detection
- [ ] Implement project-specific metadata validation
- [ ] Implement file validation (size, format, corruption)
- [ ] Add database schema for content_hash and project_id
- [ ] Integrate into upload endpoint
- [ ] Optional: Add language detection
- [ ] Optional: Add PII detection

**Dependencies:** 2.4 (Core API Routes)

**Reference:** [INBOX.md - Data Preparation & Validation](./INBOX.md#-data-preparation--validation)

**Note:** Can be deferred to Phase 6 if needed

---

## Phase 3: Frontend Foundation 🔜 (Ready to Start)

**Goal:** NextJS app with Vercel AI SDK, chat interface, and Supabase authentication

### 3.1 NextJS Setup
**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 hours

**Tasks:**
- [ ] Create `apps/web/` directory
- [ ] Initialize Next.js with TypeScript and Tailwind
- [ ] Install dependencies:
  - [ ] `ai` (Vercel AI SDK)
  - [ ] `@ai-sdk/openai`
  - [ ] `@ai-sdk/react`
  - [ ] `@supabase/supabase-js`
- [ ] Create `apps/web/.env.local` with environment variables
- [ ] Set up Supabase client (`lib/supabase.ts`)
- [ ] Test basic page rendering
- [ ] Verify dev server runs: `npm run dev`

**Dependencies:** None (can run parallel to Phase 2)

**Reference:** [PROJECT_STRUCTURE.md - apps/web](./PROJECT_STRUCTURE.md#-appsweb---nextjs-frontend)

**Commands:**
```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app
npm install ai @ai-sdk/openai @ai-sdk/react @supabase/supabase-js
```

---

### 3.2 Authentication UI
**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 hours

**Tasks:**
- [ ] Create `app/login/page.tsx` - Login page
- [ ] Create `app/signup/page.tsx` - Signup page
- [ ] Implement Supabase auth flow:
  - [ ] Email/password login
  - [ ] Email/password signup
  - [ ] Session management
  - [ ] Logout functionality
- [ ] Create auth context/provider
- [ ] Add protected route middleware
- [ ] Create user session hook
- [ ] Test full auth flow (signup → login → logout)
- [ ] Add error handling for auth failures

**Dependencies:** 3.1 (NextJS Setup)

**Reference:** [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)

---

### 3.3 Chat Interface with Vercel AI SDK
**Status:** Not Started
**Priority:** High
**Estimated Effort:** 4-6 hours

**Tasks:**
- [ ] Install AI Elements from shadcn.io/ai:
  - [ ] `<Message>` component
  - [ ] `<Response>` component
  - [ ] `<Conversation>` component
  - [ ] `<Tool>` component
- [ ] Create `components/chat.tsx` with `useChat()` hook
- [ ] Create `app/api/chat/route.ts`:
  - [ ] Implement streaming endpoint with `streamText()`
  - [ ] Call Python API for R2R search
  - [ ] Pass document chunks as context
  - [ ] Handle authorization header forwarding
- [ ] Create main chat page (`app/page.tsx`)
- [ ] Add message history display
- [ ] Add loading states
- [ ] Test streaming responses
- [ ] Test RAG context injection

**Dependencies:** 3.1 (NextJS Setup), 3.2 (Authentication), 2.4 (Core API Routes)

**Reference:** [PROJECT_STRUCTURE.md - apps/web](./PROJECT_STRUCTURE.md#-appsweb---nextjs-frontend)

**Example Flow:**
```
User types message → useChat() → /api/chat/route.ts → Python API /rag/search → R2R → streamText() → User sees response
```

---

## Phase 4: Document Management 🔜

**Goal:** Upload, view, and manage documents

### 4.1 Document Upload UI
**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 3-4 hours

**Tasks:**
- [ ] Create `components/document-upload.tsx`
- [ ] Implement file input with drag-and-drop
- [ ] Add file validation (client-side)
- [ ] Add metadata input form (title, tags, etc.)
- [ ] Implement upload progress indicator
- [ ] Call Python API `/documents/upload` endpoint
- [ ] Handle upload success/error states
- [ ] Add duplicate detection feedback
- [ ] Test with various file types (PDF, DOCX, etc.)

**Dependencies:** 3.3 (Chat Interface), 2.4 (Core API Routes)

---

### 4.2 Document List & Management
**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 3-4 hours

**Tasks:**
- [ ] Create `app/documents/page.tsx`
- [ ] Fetch user's documents from API
- [ ] Display document list with metadata
- [ ] Add search/filter functionality
- [ ] Implement delete document action
- [ ] Add document preview/view
- [ ] Show ingestion status
- [ ] Add pagination for large document lists
- [ ] Test CRUD operations

**Dependencies:** 4.1 (Document Upload)

---

## Phase 5: CrewAI Integration 🔮 (Future)

**Goal:** Multi-agent research and analysis capabilities

### 5.1 Research Crew Setup
**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 4-6 hours

**Tasks:**
- [ ] Create `apps/api/agents/research_crew/` directory
- [ ] Create `config/agents.yaml` - Define agent roles
- [ ] Create `config/tasks.yaml` - Define tasks
- [ ] Create `crew.py` - Orchestration logic
- [ ] Create custom tools in `tools/custom_tools.py`
- [ ] Integrate R2R client for RAG capabilities
- [ ] Test crew execution locally

**Dependencies:** Phase 2 (Core Backend)

**Reference:** [PROJECT_STRUCTURE.md - apps/api/agents](./PROJECT_STRUCTURE.md#-appsapiagents---crewai-crews)

---

### 5.2 Agent API Endpoints
**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 2-3 hours

**Tasks:**
- [ ] Create `apps/api/routes/agents.py`
- [ ] Add `POST /agents/research` endpoint
- [ ] Add agent status/progress tracking
- [ ] Add result storage and retrieval
- [ ] Test agent execution via API

**Dependencies:** 5.1 (Research Crew Setup)

---

### 5.3 Agent UI
**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 4-6 hours

**Tasks:**
- [ ] Create agent trigger UI
- [ ] Add agent progress display
- [ ] Show agent task breakdown
- [ ] Display agent results
- [ ] Add agent history view
- [ ] Use `<Tool>` component from AI Elements

**Dependencies:** 5.2 (Agent API Endpoints), 3.3 (Chat Interface)

---

## Phase 6: Advanced Features 🚀 (Future)

**Goal:** Implement search quality improvements and optimizations from INBOX

### 6.1 Hierarchical Chunking
**Status:** Not Started
**Priority:** High (for search quality)
**Estimated Effort:** 1-2 weeks

**Tasks:**
- [ ] Implement structure detection during parsing
- [ ] Create parent chunks (section/subsection summaries)
- [ ] Store parent-child relationships in metadata
- [ ] Add database schema changes (level, parent_chunk_id, chunk_path)
- [ ] Modify retrieval to return parent context
- [ ] Add level-aware search
- [ ] Test with financial documents

**Dependencies:** Phase 2, Phase 3

**Reference:** [INBOX.md - Hierarchical Chunking](./INBOX.md#hierarchical-chunking-high-priority)

---

### 6.2 Contextual Retrieval
**Status:** Not Started
**Priority:** High (quick win)
**Estimated Effort:** 1-2 days

**Tasks:**
- [ ] Modify chunk enrichment to add context header
- [ ] Extract document metadata (company, type, period, section)
- [ ] Format context consistently
- [ ] Re-embed existing chunks with context (optional)
- [ ] Test search quality improvement

**Dependencies:** Phase 2

**Reference:** [INBOX.md - Contextual Retrieval](./INBOX.md#contextual-retrieval-quick-win)

---

### 6.3 Entity Extraction Refinement
**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2-3 weeks (Phase 1)

**Tasks:**
- [ ] Implement project-level entity registry
- [ ] Add confidence thresholding (auto-accept >0.85)
- [ ] Build basic deduplication (embeddings + string matching)
- [ ] Store evidence spans and confidence scores
- [ ] Test with investment-focused entities

**Dependencies:** Phase 2, Phase 4

**Reference:** [INBOX.md - Entity Extraction Refinement](./INBOX.md#entity-extraction-refinement-strategy)

---

### 6.4 RAPTOR (Optional)
**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 2-3 weeks

**Tasks:**
- [ ] Implement clustering algorithm
- [ ] Generate summaries for clusters
- [ ] Store summaries with level metadata
- [ ] Build level-aware search
- [ ] Test multi-scale retrieval

**Dependencies:** Phase 2, 6.1 (Hierarchical Chunking)

**Reference:** [INBOX.md - RAPTOR](./INBOX.md#raptor-recursive-abstractive-processing-medium-priority)

---

### 6.5 Automatic Graph Pull After Deduplication
**Status:** 🟡 90% Complete - R2R SDK Issue
**Priority:** High (required for graph search to work)
**Actual Effort:** 3 hours

**Problem:** R2R extracts entities to `documents_entities` but doesn't automatically move them to `graphs_entities`. Graph search only works on `graphs_*` tables, so manual `/graphs/{collection_id}/pull` is required.

**Completed (2025-10-28):**
- [x] Create `apps/api/services/graph_manager.py` (uses R2R SDK)
- [x] Implement `GraphManager` class with:
  - [x] `pull_graph(collection_id)` - Uses R2R Python SDK
  - [x] `refresh_bridges(collection_id)` - Calls Postgres function
  - [x] `post_dedup_workflow(collection_id)` - Orchestrates both steps
- [x] Create Postgres function `mosaic.refresh_floor_bridges()`
- [x] Add endpoints in `routes/rag.py`:
  - [x] `POST /graphs/{collection_id}/post-dedup` - Full workflow
  - [x] `POST /graphs/{collection_id}/pull` - Graph pull only
  - [x] `POST /graphs/{collection_id}/refresh-bridges` - Bridges only
  - [x] `POST /graphs/{collection_id}/watch` - Register for monitoring
- [x] Create `apps/api/services/dedup_monitor.py` - Background polling
- [x] Auto-register collections on document upload
- [x] Add logging and error handling
- [x] Deploy Postgres function to Supabase
- [x] Add unique constraint for bridge upserts

**Current Issue:**
- ⚠️ R2R SDK `graphs.pull()` returns "Graph not found" error
- Data exists: 61 entities, 87 relationships in database
- Graph record exists with status "enriched"
- Bridge refresh works perfectly (tested)
- Need to debug R2R SDK usage or use alternative method

**Testing:**
- ✅ Bridge refresh function tested via MCP
- ✅ Auto-registration on upload working
- ✅ Monitor starts on app startup
- ❌ End-to-end workflow blocked by SDK issue

**Files Created:**
- `migrations/004_auto_bridge_refresh.sql`
- `apps/api/services/graph_manager.py`
- `apps/api/services/dedup_monitor.py`
- `docs/GRAPH_AUTOMATION.md`

**Future Extensions:**
- [ ] Fix R2R SDK graph pull issue
- [ ] Add DEG-RAG entity resolution (cross-document dedup)
- [ ] Add DEG-RAG relation pruning (remove weak/contradictory edges)
- [ ] Replace polling with webhooks

**Dependencies:** Phase 2 (Core Backend)

**Reference:** [DEG-RAG.md - Section 6](./DEG-RAG.md#6-automation-pipeline-example)

---

### 6.6 Query-Driven Graph Expansion
**Status:** Not Started
**Priority:** High (user-driven, high ROI)
**Estimated Effort:** 1-2 weeks

**Concept:** Use actual user queries and returned chunks to discover missing relationships in the knowledge graph. When users search for entities that co-occur in results but aren't connected in the graph, that's a signal that a relationship should exist.

**Why This Approach:**
- ✅ User queries reveal what relationships actually matter
- ✅ Reranked chunks provide evidence for verification
- ✅ Higher precision than heuristic-based expansion
- ✅ Lower cost (fewer, higher-quality candidates)
- ✅ Data-driven optimization based on real usage

**Tasks:**

**Phase 1: Passive Logging (Start Immediately)**
- [ ] Add query analytics to search endpoint
- [ ] Extract entities from queries (NER)
- [ ] Extract entities from top-k reranked chunks
- [ ] Identify entity pairs that co-occur in results
- [ ] Check which pairs are NOT connected in graph
- [ ] Log signals in `kg_ops.query_signals` table
- [ ] Create database schema for query signals

**Phase 2: Signal Aggregation (Weekly Job)**
- [ ] Background job to aggregate query signals
- [ ] Identify high-frequency missing edges (≥3 queries)
- [ ] Infer relation types from query context using LLM
- [ ] Create candidates in `kg_ops.edge_candidates_from_queries`
- [ ] Rank candidates by signal strength

**Phase 3: Verification & Insertion**
- [ ] LLM verification using returned chunks as evidence
- [ ] Automated insertion for high-confidence edges (≥0.75)
- [ ] Manual review UI for borderline cases (0.65-0.75)
- [ ] Track if inserted edges improve search quality
- [ ] Feedback loop metrics (query success rate, CTR)

**Database Schema:**
```sql
-- Track query patterns and missing graph edges
create table kg_ops.query_signals (
  id uuid primary key default gen_random_uuid(),
  query_text text not null,
  query_entities jsonb,
  result_entities jsonb,
  missing_edges jsonb,
  chunk_ids text[],
  created_at timestamptz default now()
);

-- Aggregate signals for high-value missing edges
create table kg_ops.edge_candidates_from_queries (
  id uuid primary key default gen_random_uuid(),
  entity_a text not null,
  entity_b text not null,
  signal_count int default 1,
  queries text[],
  evidence_chunks text[],
  relation_hint text,
  status text default 'pending',
  created_at timestamptz default now(),
  unique(entity_a, entity_b)
);
```

**Example Flow:**
```
Week 1: User queries "Tesla lithium suppliers"
        → Returns chunks with Tesla + Albemarle
        → No graph edge exists
        → Log signal

Week 2: Another user queries "Who supplies lithium to Tesla?"
        → Same pattern, signal count: 2

Week 3: Third query suggests same relationship
        → Signal count: 3, trigger candidate creation

Week 4: Background job verifies with LLM using returned chunks
        → Insert: Albemarle --[supplies]--> Tesla

Week 5: Future queries benefit from graph expansion
        → Better results via graph traversal
```

**Metrics to Track:**
- New edges added per week
- Signal count distribution
- Verification success rate
- Query success rate (before/after)
- User satisfaction improvement

**Dependencies:** Phase 2 (Core Backend), Phase 4 (Document Management)

**Advantages Over Generic REG:**
- User queries filter for relevance (not heuristic guesses)
- Evidence already available (returned chunks)
- Focuses on high-value connections users care about
- Simpler implementation than full REG
- Immediate value (start logging now, improve later)

**Note:** This approach is superior to generic relation expansion (REG) because it's driven by actual user behavior rather than heuristics. Implement this instead of generic REG.

---

## Phase 7: Performance & Monitoring 🔮 (Future)

**Goal:** Optimize ingestion performance and add observability

### 7.1 Performance Optimizations
**Status:** Not Started
**Priority:** Low (optimize after core functionality works)
**Estimated Effort:** 1-2 weeks

**Note:** Most of these require modifications to R2R's core ingestion pipeline. Consider contributing back to R2R project.

**Tasks:**
- [ ] Investigate R2R's internal batching (LiteLLM + R2R source code review)
- [ ] Evaluate need for parallel embedding batch processing
- [ ] Evaluate need for parallel database storage writes
- [ ] Evaluate need for concurrent chunk enrichment strategies
- [ ] Evaluate need for streaming storage during embedding
- [ ] Evaluate need for adaptive concurrency limits
- [ ] Test with realistic document sizes
- [ ] Monitor API costs and rate limits

**Dependencies:** Phase 2, Phase 4

**Reference:** [INBOX.md - Performance Optimizations](./INBOX.md#-performance-optimizations)

**Important Notes:**
- Current config is already well-optimized with increased concurrency limits
- OpenAI Tier 4 limits support aggressive parallelization
- Only implement if performance bottlenecks are identified
- Measure before optimizing

---

### 7.2 Monitoring & Observability
**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1 week

**Tasks:**
- [ ] Add ingestion performance metrics:
  - [ ] Parse time per document
  - [ ] Embedding time per batch
  - [ ] Storage time per batch
  - [ ] Enrichment time per strategy
  - [ ] Graph extraction time per chunk pair
  - [ ] End-to-end ingestion time
- [ ] Set up OpenTelemetry or custom metrics
- [ ] Create performance dashboard
- [ ] Add alerting for slow ingestions
- [ ] Track API costs per operation

**Dependencies:** Phase 2, Phase 4

**Reference:** [INBOX.md - Monitoring & Observability](./INBOX.md#-monitoring--observability)

**Benefit:** Data-driven optimization decisions

---

### 7.3 Configuration Improvements
**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 3-5 days

**Tasks:**
- [ ] Design per-document ingestion profiles schema
- [ ] Implement profile selection logic
- [ ] Create profiles for common document types:
  - [ ] Technical docs (larger chunks, enable enrichment)
  - [ ] Simple text (smaller chunks, disable enrichment)
  - [ ] Financial reports (custom chunking, enable tables)
  - [ ] Legal documents (preserve structure, enable PII detection)
- [ ] Add profile management UI
- [ ] Test with different document types

**Dependencies:** Phase 2, Phase 4

**Reference:** [INBOX.md - Configuration Improvements](./INBOX.md#-configuration-improvements)

**Benefit:** Optimize ingestion speed and quality per document type

---

## Current Status

**Active Phase:** Phase 2 (Core Backend API)
**Current Task:** 2.1 - Python API Setup
**Blockers:** None

**Next Steps:**
1. Complete Phase 2.1 (Python API Setup)
2. Complete Phase 2.2 (Authentication Layer)
3. Complete Phase 2.3 (R2R Integration Layer)
4. Complete Phase 2.4 (Core API Routes)
5. Move to Phase 3 (Frontend Foundation)

---

## Progress Tracking

### Completed
- ✅ Phase 1: Foundation (R2R + Supabase integration)

### In Progress
- 🔄 Phase 2: Core Backend API (0/4 tasks complete)

### Upcoming
- 🔜 Phase 3: Frontend Foundation
- 🔜 Phase 4: Document Management
- 🔮 Phase 5: CrewAI Integration
- 🚀 Phase 6: Advanced Features (Search Quality)
  - 6.1 Hierarchical Chunking
  - 6.2 Contextual Retrieval (Quick Win)
  - 6.3 Entity Extraction Refinement
  - 6.4 RAPTOR (Optional)
  - 6.5 Automatic Graph Pull After Deduplication (High Priority)
  - 6.6 Query-Driven Graph Expansion (High Priority)
- 🔮 Phase 7: Multifloor Traversal Framework (Cognitive Cartography)
  - 7.1 Database Schema & Bridges
  - 7.2 Trail Execution Engine
  - 7.3 Temporal Versioning
  - 7.4 Custom Floors
  - 7.5 UI Integration
- 📊 Phase 8: Performance & Monitoring

---

## Phase 7: Multifloor Traversal Framework 🎯 (Design Complete)

**Goal:** Build true multi-hop graph traversal with temporal tracking and layered representation

**Reference:** [docs/MULTIFLOOR_ARCHITECTURE.md](./docs/MULTIFLOOR_ARCHITECTURE.md)

**Inspiration:** Cognitive Cartography (Kellis, MIT CSAIL)

**Why:** R2R only does vector search on entities/relationships - no actual graph traversal. This adds the missing layer.

---

### 7.1 Database Schema & Bridges
**Status:** ✅ COMPLETE + R2R BUG FIXED
**Priority:** Critical (Foundation for all traversal)
**Estimated Effort:** 3-4 days

**Problem:** R2R stores relationships but doesn't traverse them. Need bridge tables to connect floors.

**Completed (2025-10-28):**
- [x] Create `mosaic.floor_bridges` table for cross-floor connections
- [x] Create `mosaic.temporal_versions` table for version history
- [x] Create `mosaic.custom_floors` registry table
- [x] Create `mosaic.trail_executions` audit log
- [x] Add indexes for performance (floor + node_id, temporal ranges)
- [x] Create migration script (`migrations/001_multifloor_schema.sql`)
- [x] Create bridge seeding script (`migrations/002_seed_bridges.sql`):
  - [x] Chunk → Entity bridges (from R2R's chunk_ids in entities)
  - [x] Entity → Document bridges (from parent_id)
  - [x] Document → Chunk bridges (from chunk metadata)
  - [x] Relationship bridges (B → B for graph traversal)
- [x] Create test script (`migrations/003_test_bridges.sql`)
- [x] Document schema in `docs/DATABASE_SCHEMA.md`

**Deployed to Supabase (2025-10-28):**
- [x] Ran `migrations/001_multifloor_schema.sql` - Schema created
- [x] Ran `migrations/002_seed_bridges.sql` - Bridges populated
- [x] Verified deployment - All tests passing

**Results:**
- ✅ **23,478 total bridges** created across 4 floor connections
- ✅ **13,015 Chunk → Entity** bridges (A → B)
- ✅ **6,525 Entity → Document** bridges (B → C)
- ✅ **604 Document → Chunk** bridges (C → A)
- ✅ **3,334 Relationship** bridges (B → B) with 248 unique relationship types
- ✅ All tables, indexes, and functions deployed successfully

**Dependencies:** Phase 2 (Core Backend)

**Acceptance Criteria:**
- All tables created with proper constraints
- Bridges populated from existing R2R data
- Query performance < 100ms for single-hop
- Schema documented

---

### 7.2 Trail Execution Engine
**Status:** ✅ COMPLETE + WORKING END-TO-END
**Priority:** Critical (Core functionality)
**Actual Effort:** 3 hours (including debugging)

**Problem:** Need composable traversal API that can combine vector search, graph hops, and bridges.

**Completed (2025-10-28):**
- [x] Create `apps/api/services/trail_engine.py` (530 lines)
- [x] Implement `TrailEngine` class with psycopg:
  - [x] `execute_trail(trail_config)` - Main entry point
  - [x] `_resolve_start(start_config)` - Find starting nodes
  - [x] `_bm25_search(query, params)` - Text search
  - [x] `_graph_hop(nodes, params)` - **Multi-hop graph traversal**
  - [x] `_bridge_cross(nodes, params)` - Cross-floor movement
  - [x] `_filter_nodes(nodes, params)` - Result filtering
  - [x] `_rank_and_format(nodes, ranking)` - Result ranking
  - [x] `_log_execution()` - Audit logging
- [x] Implement graph_hop with recursive CTE (working!)
- [x] Create Trail YAML parser (`trail_parser.py`, 369 lines)
- [x] Create REST API endpoints (`routes/trails.py`, 250 lines):
  - [x] `POST /trails/execute` - Execute a trail
  - [x] `GET /trails/templates` - List templates
  - [x] `GET /trails/templates/{name}` - Get template
  - [x] `POST /trails/validate` - Validate config
  - [x] `GET /trails/health` - Health check
- [x] Add error handling and logging
- [x] Create trail templates (partner_discovery, founder_discovery)
- [x] Write comprehensive documentation (`trails/README.md`)
- [x] **TESTED END-TO-END VIA CURL** ✅

**Live Test Results:**
- ✅ Tesla → Panasonic (Partnership) - 750ms
- ✅ Tesla → All Relationships (3 entities) - 700ms
- ✅ Multi-hop traversal working perfectly
- ✅ Zero errors, 100% success rate

**Technical Solution:**
- Library: `psycopg` (not asyncpg) for Supabase compatibility
- Connection: Session pooler (port 5432)
- Region: `aws-1-us-east-1`
- Autocommit: Enabled for read queries

**Dependencies:** 7.1 (Database Schema)

**Acceptance Criteria:**
- [x] Graph traversal working (vector search pending Phase 7.3)
- [x] Multi-step trails execute correctly
- [x] Performance < 1s for single-hop (achieved: 700-790ms)
- [x] End-to-end testing complete

---

### 7.3 Temporal Versioning
**Status:** Not Started
**Priority:** High (Unique differentiator)
**Estimated Effort:** 1 week

**Problem:** Need to query "what did we know on date X" and track changes over time.

**Tasks:**
- [ ] Implement versioning triggers:
  - [ ] On entity update → create version snapshot
  - [ ] On relationship update → create version snapshot
  - [ ] On metric update → create version snapshot
- [ ] Create `as_of` query function:
  ```sql
  SELECT * FROM get_graph_as_of(
    collection_id := 'uuid',
    as_of_date := '2024-12-31'
  )
  ```
- [ ] Create `diff` query function:
  ```sql
  SELECT * FROM get_graph_diff(
    collection_id := 'uuid',
    from_date := '2024-01-01',
    to_date := '2024-12-31'
  )
  ```
- [ ] Add temporal filters to Trail API
- [ ] Implement snapshot compression (only store diffs)
- [ ] Add retention policies (how long to keep versions)
- [ ] Create TimescaleDB integration (optional, for metrics)
- [ ] Build temporal UI components (timeline slider)
- [ ] Write tests for temporal queries
- [ ] Document in `docs/TEMPORAL_QUERIES.md`

**Dependencies:** 7.1 (Database Schema), 7.2 (Trail Engine)

**Acceptance Criteria:**
- Point-in-time queries working
- Diff queries show changes correctly
- Performance acceptable for 1-year history
- UI can visualize temporal changes

---

### 7.4 Custom Floors
**Status:** Not Started
**Priority:** Medium (Extensibility)
**Estimated Effort:** 1 week

**Problem:** Different domains need different floors (Companies, Events, Methodologies, etc.)

**Tasks:**
- [ ] Create floor registry system:
  - [ ] YAML schema for floor definitions
  - [ ] Dynamic table creation from schema
  - [ ] Validation and constraints
- [ ] Implement floor manager:
  - [ ] `create_floor(schema)` - Create new floor
  - [ ] `list_floors()` - Get all floors
  - [ ] `get_floor_schema(floor_id)` - Get schema
  - [ ] `delete_floor(floor_id)` - Remove floor
- [ ] Add custom floors to Trail API:
  - [ ] Support custom floor IDs in trail config
  - [ ] Validate floor exists before execution
- [ ] Create example floor definitions:
  - [ ] Companies floor (ticker, sector, market_cap)
  - [ ] Events floor (event_type, occurred_at, entities)
  - [ ] Financials floor (metric_type, value, period)
- [ ] Build floor creation UI
- [ ] Add floor visualization to graph UI
- [ ] Write tests for custom floors
- [ ] Document in `docs/CUSTOM_FLOORS.md`

**Dependencies:** 7.2 (Trail Engine)

**Acceptance Criteria:**
- Can create custom floors via API
- Custom floors integrate with trails
- Example floors working
- Documentation complete

---

### 7.5 UI Integration
**Status:** Not Started
**Priority:** High (User-facing)
**Estimated Effort:** 2 weeks

**Problem:** Need visual interface for trail composition and graph exploration.

**Tasks:**
- [ ] Create Trail Builder UI:
  - [ ] Drag-and-drop step composition
  - [ ] Visual floor selector
  - [ ] Parameter configuration
  - [ ] Trail preview/validation
  - [ ] Save/load trail templates
- [ ] Create Graph Visualization:
  - [ ] Interactive node-edge graph (use react-force-graph or vis.js)
  - [ ] Floor-based coloring
  - [ ] Click to expand nodes
  - [ ] Highlight traversal paths
  - [ ] Show bridge connections
- [ ] Create Temporal Timeline:
  - [ ] Date range slider
  - [ ] Version comparison view
  - [ ] Diff visualization
  - [ ] Playback animation
- [ ] Create Trail Results View:
  - [ ] Table view with sorting/filtering
  - [ ] Graph view with highlighted path
  - [ ] Provenance panel (source documents)
  - [ ] Export to JSON/CSV
- [ ] Add example trails:
  - [ ] "Supplier Analysis"
  - [ ] "Competitive Intelligence"
  - [ ] "Risk Assessment"
- [ ] Write UI tests (Playwright)
- [ ] Document in `docs/UI_GUIDE.md`

**Dependencies:** 7.2 (Trail Engine), Phase 3 (Frontend)

**Acceptance Criteria:**
- Can build trails visually
- Graph visualization is interactive
- Temporal timeline works
- Example trails demonstrate value

---

## Notes

- **Parallel Work:** Phase 3.1 (NextJS Setup) can be done in parallel with Phase 2
- **Optional Tasks:** Phase 2.5 (Data Prep) and Phase 6.4 (RAPTOR) can be deferred
- **Quick Wins:** Phase 6.2 (Contextual Retrieval) is a 1-2 day improvement with high impact
- **Early Start:** Phase 6.6 Phase 1 (query logging) can start as soon as Phase 2.4 (Core API Routes) is complete - start collecting data early!
- **Testing:** Test each phase thoroughly before moving to the next
- **Documentation:** Update PROJECT_STRUCTURE.md as architecture evolves

---

## Resources

- **Architecture:** [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- **Auth Setup:** [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)
- **Future Features:** [INBOX.md](./INBOX.md)
- **R2R Docs:** [llms_r2r.txt](./llms_r2r.txt)
- **Supabase Dashboard:** https://supabase.com/dashboard/project/lrjgstozjsirqfflympo
