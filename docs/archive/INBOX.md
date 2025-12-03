# INBOX - Future Features & Ideas

**Status:** ✅ Cleaned up on 2025-10-27

All items have been moved to:
- **[BUILD_PLAN.md](./BUILD_PLAN.md)** - Actionable tasks with clear sequencing
- **[TO_PROCESS.md](./TO_PROCESS.md)** - Items requiring decisions before implementation

---

## How to Use This File

1. **Add new ideas here** as they come up
2. **Keep entries brief** - just enough to capture the idea
3. **Run `/cleanup` workflow** regularly to process items
4. **Don't let it grow too large** - process items weekly

---

## Current Items

### Document Deletion: Comprehensive Cleanup Implementation
**Added:** 2025-10-28
**Status:** 🎯 High Priority - Technical Debt
**Priority:** High (Data integrity and graph cleanliness)

**Problem:**
Current document deletion only removes the document and chunks via R2R. It does NOT clean up:
- Floor bridges referencing the deleted document
- Orphaned graph entities (entities with no remaining chunks)
- Orphaned graph relationships (relationships with deleted entities)

This causes graph noise and data integrity issues over time.

**Current Behavior:**
```python
# Simple delete - only removes document + chunks
client.documents.delete(id=document_id)
```

**Required Cleanup:**
1. **Floor Bridges** - Delete bridges where source or target is the deleted document
2. **Orphaned Entities** - Remove entities from `graphs_entities` if their `chunk_ids` array is empty after chunk deletion
3. **Orphaned Relationships** - Remove relationships from `graphs_relationships` if subject or object entity no longer exists

**Implementation Options:**

**Option 1: Database Triggers (RECOMMENDED)**
- ✅ **Pros:** Automatic, consistent, no API code needed, works for all deletions
- ✅ **Pros:** Runs in single transaction, guaranteed consistency
- ✅ **Pros:** No performance impact on API
- ❌ **Cons:** Requires migration, harder to debug
- **Implementation:**
  ```sql
  CREATE TRIGGER cleanup_after_document_delete
  AFTER DELETE ON mosaic.documents
  FOR EACH ROW EXECUTE FUNCTION cleanup_document_references();
  ```

**Option 2: Supabase RPC Functions**
- ✅ **Pros:** Can be called from Python API via Supabase client
- ✅ **Pros:** Easier to test and debug than triggers
- ❌ **Cons:** Requires explicit API calls, not automatic
- ❌ **Cons:** PostgREST schema exposure issues (mosaic schema not exposed by default)
- **Implementation:**
  ```sql
  CREATE FUNCTION mosaic.delete_document_with_cleanup(doc_id UUID)
  RETURNS JSON AS $$...$$;
  ```

**Option 3: Direct PostgreSQL Connection (asyncpg)**
- ✅ **Pros:** Full control, can access any schema
- ✅ **Pros:** Can be part of delete_document function
- ❌ **Cons:** Requires managing DB connections
- ❌ **Cons:** Adds complexity to API code
- ❌ **Cons:** Need to handle connection pooling
- **Implementation:**
  ```python
  conn = await asyncpg.connect(db_url)
  await conn.execute("DELETE FROM mosaic.floor_bridges WHERE...")
  ```

**Option 4: Background Job/Cron**
- ✅ **Pros:** Non-blocking, doesn't slow down delete
- ❌ **Cons:** Eventual consistency, not immediate
- ❌ **Cons:** More infrastructure to manage
- ❌ **Cons:** Orphaned data exists temporarily

**Recommendation: Option 1 (Database Triggers)**

**Why:**
1. **Automatic** - Works for all deletions (API, manual, R2R direct)
2. **Transactional** - All cleanup happens atomically with delete
3. **Zero API overhead** - No performance impact on delete endpoint
4. **Maintainable** - Logic lives in one place (database)
5. **Reliable** - Can't forget to call cleanup

**Implementation Plan:**

1. **Create trigger function** (1 hour)
   ```sql
   CREATE FUNCTION mosaic.cleanup_document_references()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Delete floor bridges
     DELETE FROM mosaic.floor_bridges 
     WHERE (source_floor = 'document' AND source_id = OLD.id)
        OR (target_floor = 'document' AND target_id = OLD.id);
     
     -- Get affected chunk IDs
     -- Clean orphaned entities
     -- Clean orphaned relationships
     
     RETURN OLD;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create triggers** (30 min)
   - After document delete
   - After chunk delete (for entity cleanup)

3. **Test thoroughly** (1 hour)
   - Delete document, verify all cleanup
   - Check graph integrity
   - Verify no orphaned data

4. **Deploy migration** (15 min)

**Total Effort:** ~2.5 hours

**Alternative: Quick Win with Option 2**
If we need something faster, create an RPC function and expose `mosaic` schema to PostgREST:
```toml
# supabase/config.toml
[api]
schemas = ["public", "mosaic"]
```

**Dependencies:**
- Cleanup functions already created ✅
  - `mosaic.cleanup_orphaned_entities()`
  - `mosaic.cleanup_orphaned_relationships()`

**Testing Checklist:**
- [ ] Delete document with chunks
- [ ] Verify floor bridges deleted
- [ ] Verify orphaned entities removed
- [ ] Verify orphaned relationships removed
- [ ] Verify graph integrity maintained
- [ ] Test with multiple documents
- [ ] Test with shared entities (should NOT be deleted)

---

### Multifloor Traversal Framework - Phase 7.2 Start
**Added:** 2025-10-28
**Updated:** 2025-10-28
**Status:** ✅ Phase 7.1 COMPLETE + R2R BUG FIXED - Ready for Phase 7.2
**Priority:** Critical (Core traversal functionality)

**✅ Phase 7.1 Complete:**
- ✅ All tables deployed to Supabase
- ✅ 21 bridges created from test data
- ✅ All indexes and functions working
- ✅ Multi-hop queries verified
- ✅ **R2R graph pull bug FIXED** (entity ID mapping)

**Current Test Data:**
- **6** Chunk → Entity bridges (A → B)
- **6** Entity → Document bridges (B → C)
- **1** Document → Chunk bridges (C → A)
- **8** Relationship bridges (B → B) - ALL WORKING!

**R2R Bug Fix:**
- Fixed entity ID mismatch in graph pull
- Implemented mapping table solution
- Tested and verified working
- Ready to submit PR to R2R repo

**🚀 Next: Phase 7.2 - Trail Execution Engine**

**Goal:** Build the core traversal engine that can execute multi-step trails

**Immediate Tasks:**
1. Create `apps/api/services/trail_engine.py`
2. Implement `TrailEngine` class with:
   - `execute_trail(trail_config)` - Main entry point
   - `_resolve_start(start_config)` - Find starting nodes
   - `_vector_expand(nodes, params)` - Use R2R for semantic search
   - `_graph_hop(nodes, params)` - **NEW: Actual graph traversal**
   - `_bridge_cross(nodes, params)` - Cross-floor movement
   - `_rank_and_format(nodes, ranking)` - RRF fusion
3. Implement recursive SQL for graph_hop
4. Add query budgets (max hops, max time)
5. Create Trail YAML parser
6. Write tests

**Estimated Effort:** 1-2 weeks

**Reference:** 
- [BUILD_PLAN.md Phase 7.2](./BUILD_PLAN.md#72-trail-execution-engine) - Implementation tasks
- [docs/MULTIFLOOR_ARCHITECTURE.md](./docs/MULTIFLOOR_ARCHITECTURE.md) - Trail API spec
- [docs/QUICK_START_MULTIFLOOR.md](./docs/QUICK_START_MULTIFLOOR.md) - Developer guide

---

### Schema Separation: Move RAG Tables to Dedicated Schema
**Added:** 2025-12-03
**Status:** 💭 Someday/Maybe
**Priority:** Low (Nice to have, not blocking)

**Problem:**
All tables (Mosaic core + app layer) live in `public` schema. This works fine but mixes infrastructure tables (`documents`, `chunks`, `embeddings`, `entities`, `relationships`) with app tables (`conversations`, `messages`, `users`).

**Proposed Solution:**
Move Mosaic core tables to a dedicated `rag` or `mosaic` schema:

```
public (app layer)
├── users
├── conversations
├── messages
├── system_settings
└── [future app tables]

rag (mosaic core)
├── documents
├── chunks
├── embeddings
├── entities
├── relationships
└── [future RAG tables]
```

**Benefits:**
- Clear "don't touch" boundary for RAG infrastructure
- Easier to version/migrate Mosaic independently
- Cleaner `public` schema for app development
- Better positioned if Mosaic becomes a reusable library

**When This Becomes Worth It:**
- Shipping Mosaic as a standalone product/library
- Multiple apps sharing one Mosaic instance
- Hiring devs who need clear boundaries

**Why Not Now:**
- Single app, single team, same codebase
- ~4 hours of work for cosmetic benefit
- No immediate ROI

**Implementation (if needed later):**
1. Create `rag` schema and move tables (~30 min)
2. Update Python backend SQL queries (~30 min)
3. Update TypeScript with `.schema('rag')` (~1 hour)
4. Update RPC functions (~30 min)
5. Update Edge functions (~30 min)
6. Testing (~1 hour)

**Estimated Effort:** 4 hours

---

## Template for New Items

```markdown
### [Feature Name]
**Problem:** What problem does this solve?
**Proposed Solution:** Brief description
**Priority:** High/Medium/Low
**Estimated Effort:** Time estimate
**Dependencies:** What needs to exist first?
```

---

## Current Items

### Admin: Entity Types & Relationship Predicates Management
**Added:** 2025-10-28
**Status:** 🎯 Feature Request - Medium Priority
**Priority:** Medium (Graph quality and consistency)

**Problem:**
Entity categories and relationship predicates are currently defined in the R2R config file (`r2r-supabase.toml`). This requires:
- Manual TOML editing
- R2R service restart to apply changes
- No visibility into what types are currently being extracted
- No way to see which types are actually being used in the graph

**Current Configuration:**
```toml
[database.graph_creation_settings]
  entity_types = []        # Empty = LLM chooses freely
  relation_types = []      # Empty = LLM chooses freely
```

**Proposed Solution:**
Add an admin interface to manage entity and relationship types:

**Location:** `/admin/settings/graph` or `/admin/graph/types`

**Features:**
1. **View Current Types**
   - Show entity_types and relation_types from config
   - Display actual types found in the graph (from database)
   - Show usage counts for each type

2. **Edit Type Lists**
   - Add/remove entity types
   - Add/remove relationship predicates
   - Validate against existing graph data
   - Preview impact of changes

3. **Type Analytics**
   - Most common entity categories
   - Most common relationship predicates
   - Unused configured types
   - Suggest types based on current extractions

4. **Apply Changes**
   - Update R2R config via API
   - Trigger R2R reload/restart
   - Show confirmation when applied

**UI Mockup:**
```
┌─────────────────────────────────────────────────┐
│ Graph Configuration                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ Entity Types (7 configured, 12 found in graph)  │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✓ Person                    (45 entities)   │ │
│ │ ✓ Organization              (23 entities)   │ │
│ │ ✓ Method                    (18 entities)   │ │
│ │ ✓ Tool                      (15 entities)   │ │
│ │ ✓ Framework                 (12 entities)   │ │
│ │   Process (not configured)  (8 entities)    │ │
│ │   Technique (not configured)(5 entities)    │ │
│ │ [+ Add Entity Type]                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Relationship Types (5 configured, 8 in graph)   │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✓ includes                  (34 relations)  │ │
│ │ ✓ supports                  (21 relations)  │ │
│ │ ✓ part_of                   (15 relations)  │ │
│ │   encompasses (not config)  (12 relations)  │ │
│ │ [+ Add Relationship Type]                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Save Changes] [Reset to Defaults]              │
└─────────────────────────────────────────────────┘
```

**Implementation:**

1. **Backend API** (2 hours)
   - `GET /admin/graph/types` - Get current config + usage stats
   - `PUT /admin/graph/types` - Update config
   - Query database for actual types in use
   - Update R2R config file
   - Trigger R2R reload

2. **Frontend UI** (3 hours)
   - Settings page with type management
   - Dual-column layout (configured vs. found)
   - Add/remove type controls
   - Usage statistics display
   - Confirmation dialogs

3. **R2R Integration** (1 hour)
   - API to reload R2R config without restart
   - Or document restart requirement

**Benefits:**
- ✅ No manual TOML editing
- ✅ Visibility into graph composition
- ✅ Discover unexpected types
- ✅ Maintain graph consistency
- ✅ Domain-specific customization

**Dependencies:**
- Admin settings infrastructure
- R2R config management API
- Graph analytics queries

**Estimated Effort:** 6 hours

**Alternative Quick Win:**
Just add a read-only view showing current types and their usage counts. Let users manually edit the TOML for now.

---

### Document Upload: Enhanced Processing Visibility
**Added:** 2025-10-28
**Status:** 🎯 Feature Request - High Priority
**Priority:** High (UX improvement for document management)

**Problem:**
Current upload dialog lacks visibility into document processing state. Users need real-time feedback on:
- Upload progress (file transfer)
- R2R ingestion status
- Chunking progress
- Entity extraction status
- Graph building status

**Proposed Solution:**

**Non-Blocking Upload Flow:**
1. User selects files and clicks "Upload"
2. Files are sent to API (show upload progress)
3. Modal dismisses immediately after upload completes
4. Processing continues in background
5. Status updates shown in Documents table via status chips
6. Optional toast notifications for completion/errors

**Granular Status Feedback:**

**Status Chips in Documents Table:**
- 🔵 `uploading` - File transfer in progress
- 🟡 `pending` - Queued for processing
- 🟠 `ingesting` - R2R ingestion in progress
- 🟣 `chunking` - Breaking into chunks
- 🟣 `embedding` - Generating embeddings
- 🟣 `extracting` - Extracting entities
- 🟢 `success` - Fully processed
- 🔴 `failed` - Processing error

**Real-Time Updates:**
- WebSocket or polling for status updates
- Progress percentage for each stage
- Estimated time remaining
- Error messages with retry option

**Implementation Requirements:**

1. **Backend Changes:**
   - Add status tracking to R2R ingestion
   - Create status update endpoint (`GET /rag/documents/{id}/status`)
   - Store processing stage in document metadata
   - Add webhook/polling support for status changes

2. **Frontend Changes:**
   - Update UploadDialog to dismiss after upload
   - Add status chip component to DocumentsTable
   - Implement polling/WebSocket for status updates
   - Add toast notifications for completion
   - Show progress bars in table rows for active processing

3. **Database Changes:**
   - Ensure `documents.ingestion_status` supports all stages
   - Add `processing_progress` JSONB field for detailed state
   - Track stage timestamps for debugging

**User Experience:**
```
1. User uploads 3 files
2. Modal shows upload progress (0-100%)
3. Modal dismisses when uploads complete
4. Documents table shows:
   - doc1.pdf [🟠 ingesting 45%]
   - doc2.txt [🟣 extracting 12%]
   - doc3.md [🟢 success]
5. Toast: "doc3.md processed successfully"
6. Toast: "doc1.pdf processing complete"
```

**Technical Approach:**
- Use R2R's ingestion status tracking
- Poll `/rag/documents` every 2-3 seconds for active documents
- Use optimistic updates for immediate feedback
- Cache status to reduce API calls
- Auto-refresh table when status changes

**Estimated Effort:** 1-2 days
- Backend status tracking: 4 hours
- Frontend polling/updates: 4 hours
- Status chips & UI: 2 hours
- Testing & polish: 2 hours

**Dependencies:**
- Current upload functionality ✅ COMPLETE
- Documents table ✅ COMPLETE
- R2R ingestion status API

**Reference:**
- [apps/web/components/admin/upload-dialog.tsx](./apps/web/components/admin/upload-dialog.tsx)
- [apps/web/components/admin/documents-table.tsx](./apps/web/components/admin/documents-table.tsx)
- [apps/api/routes/rag.py](./apps/api/routes/rag.py)

---

### Admin Section: R2R & Mosaic Management Interface
**Added:** 2025-10-28
**Status:** 📋 Planning Complete - Ready for Implementation
**Priority:** High (Core platform management)

**Purpose:** Build comprehensive admin interface for managing all Mosaic/R2R operations through the web UI.

**Structure:**
```
/admin
├── /                    # Overview Dashboard
├── /documents           # Document Management
├── /trails              # Trail Management
├── /floors              # Floor Visualization
└── /settings            # System Configuration
```

#### **1. Admin Overview (`/admin`)**
**Features:**
- Stats cards (total documents, chunks, trails, storage)
- Recent activity feed (uploads, trail executions, system events)
- Quick actions (upload document, create trail, view logs)
- System health status

**API Calls:** `/rag/documents`, `/trails`, R2R health check

#### **2. Documents (`/admin/documents`)** - PRIORITY 1
**Document List:**
- Table with name, date, size, status, chunks, actions
- Search/filter by name, date, status
- Bulk delete
- Pagination

**Upload Interface:**
- Drag & drop multiple files
- Progress indicators
- File validation (PDF, TXT, DOCX, MD)
- Optional metadata (tags, description)

**Document Detail:**
- Metadata display
- Chunk preview
- Entity extraction results
- Graph connections
- Re-index and delete options

**API Endpoints:**
- `GET /rag/documents` - List documents
- `POST /rag/ingest` - Upload
- `DELETE /rag/documents/{id}` - Delete
- `GET /rag/documents/{id}` - Details

#### **3. Trails (`/admin/trails`)**
**Trail List:**
- Pre-built trails (founder_discovery, partner_discovery)
- Custom trails with stats (executions, avg time, success rate)
- Actions (execute, edit, delete)

**Trail Builder:**
- Visual editor for trail steps
- Step configuration (BM25, GRAPH_HOP, BRIDGE_CROSS, VECTOR_EXPAND)
- Floor selection, filters, ranking
- YAML preview and test execution
- Save as template

**Trail Execution:**
- Input query interface
- Real-time progress
- Step-by-step results
- Performance metrics
- Graph visualization

**API Endpoints:**
- `GET /trails` - List
- `POST /trails/execute` - Execute
- `POST /trails/validate` - Validate config
- `GET /trails/{id}` - Details

#### **4. Floors (`/admin/floors`)**
**Floor Overview:**
- Visual representation of all floors (Text, Entity, Document, Task, Metrics)
- Node counts per floor
- Bridge counts between floors

**Floor Explorer:**
- Select floor to explore
- Search within floor
- View nodes and connections
- Filter by metadata
- Export data

**Bridge Visualization:**
- Interactive graph of cross-floor connections
- Filter by bridge type
- Confidence/weight display
- Click to explore nodes

**API Endpoints:**
- `GET /admin/floors/stats` - Statistics
- `GET /admin/floors/{floor}/nodes` - List nodes
- `GET /admin/floors/bridges` - List bridges

#### **5. Settings (`/admin/settings`)** - PRIORITY 2

**5.1 LLM Configuration:**
- Chat Model (provider, model name, temperature, max tokens)
- Embedding Model (provider, model, dimensions)
- Entity Extraction Model
- Summarization Model
- API Keys management (OpenAI, Anthropic, Cohere)
- Test connection buttons

**5.2 Prompts:**
- RAG System Prompt
- Entity Extraction Prompt
- Summarization Prompt
- Trail Execution Prompt
- Template variables support
- Preview with sample data
- Reset to default
- Version history
- Import/Export

**5.3 Search Configuration:**
- Hybrid search weights (semantic, full-text, BM25)
- Vector search (similarity threshold, top K)
- Graph settings (enable/disable, max hops, relationship types)

**5.4 Ingestion Settings:**
- Chunking strategy (by_title, fixed, semantic)
- Chunk size, overlap, max characters
- File processing (supported types, OCR, language detection)
- Metadata extraction (auto-extract entities, summaries, custom fields)

**5.5 User & Access:**
- User management (list, invite, roles)
- API key generation and revocation
- Usage limits

**5.6 System:**
- R2R connection (URL, status, health check)
- Database (Supabase connection, migration status)
- Logs (level, retention, download)

**Settings Storage:**
```sql
CREATE TABLE public.settings (
    id UUID PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    category TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Endpoints:**
- `GET /admin/settings` - Get all
- `PUT /admin/settings` - Update
- `POST /admin/settings/test-llm` - Test connection
- `GET /admin/settings/prompts` - List prompts
- `PUT /admin/settings/prompts/{id}` - Update prompt

#### **Implementation Priority:**
1. **Phase 1:** Documents (upload, list, delete, detail view)
2. **Phase 2:** Admin Overview (stats, activity, quick actions)
3. **Phase 3:** Settings (LLM config, API keys, prompts, search)
4. **Phase 4:** Trails (list, execute, basic builder)
5. **Phase 5:** Floors (stats, visualization, explorer)

#### **UI Components Needed:**
- Table, Dialog, Tabs, Card, Badge, Progress, Alert
- Command (search), Pagination
- Custom: FileUpload, TrailBuilder, FloorGraph, DocumentPreview

**Estimated Effort:** 3-4 weeks total
- Documents: 1 week
- Settings: 1 week
- Overview + Trails: 1 week
- Floors: 1 week

**Dependencies:** 
- Phase 3.1 (Frontend sidebar) ✅ COMPLETE
- Supabase profiles table ✅ COMPLETE
- Python API with auth ✅ COMPLETE

**Reference:**
- [apps/api/routes/rag.py](./apps/api/routes/rag.py) - Existing RAG endpoints
- [apps/api/routes/trails.py](./apps/api/routes/trails.py) - Trail execution
- [BUILD_PLAN.md Phase 3](./BUILD_PLAN.md) - Frontend implementation plan
