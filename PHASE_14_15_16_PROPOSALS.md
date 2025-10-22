# New Phase Proposals (from INBOX cleanup - Oct 22, 2025)

These items from INBOX.md are ready to be added to BUILD_PLAN.md as Phases 14-16.

---

## Phase 14: Living Data & Versioning

### Overview
Enable mutable, evolving data with version tracking and conversational updates. Transform Mosaic from static document extraction to living knowledge management.

### Phase 14.1: Living Data - Iterative Updates & Version Tracking (6-10 weeks)

**Goal:** Support evolving, mutable data with full version history and chat-driven updates

**Priority:** Medium-High (Enables new use cases, significant architecture changes)

**Estimated Effort:** 6-10 weeks total

**Use Cases:**
1. **Ideation & Brainstorming:** Users chat about concepts, refine them, store refinements
2. **Project Planning:** Initial ideas evolve through discussion, track iterations
3. **Knowledge Refinement:** Entity descriptions improve over time through user feedback
4. **Collaborative Research:** Multiple users contribute to and refine shared knowledge
5. **Living Documentation:** Content evolves based on new insights and discussions

**Implementation Phases:**

**Phase 1: Mutable Entity System (1-2 weeks)**
- Add `entity_source` field: `'extracted'` | `'created'` | `'hybrid'`
- Add `is_mutable` and `version` fields to entities table
- Create `entity_versions` table with immutable snapshots
- Implement trigger to ensure single `is_latest` per entity
- Show version history on entity pages
- Diff view between versions
- Rollback capability

**Phase 2: Conversational Data Updates (2-3 weeks)**
- Chat commands for data manipulation
- AI-assisted change suggestions during chat
- Confirmation workflow before applying changes
- Change preview in chat interface
- Batch updates from conversation

**Phase 3: Iteration Tracking (1-2 weeks)**
- Timeline view of entity evolution
- Change attribution (who, when, why)
- Branching: multiple versions of same entity
- Merge conflicts resolution
- Change notifications for collaborative work
- Audit trail for compliance

**Phase 4: Hybrid Data Model (2-3 weeks)**
- Distinguish between Facts/Analysis/Ideas
- Visual indicators for data type
- Separate confidence scores for each type
- Source tracking: document-based vs user-generated
- Citation requirements for facts vs analysis

**Reference Architecture (from SanityCheck project):**
- Immutable Snapshots + Latest Pointer (is_latest flag with trigger)
- Atomic Chunks with SHA256 hashing for deduplication
- Append-only Event Log for analytics
- Recency-Aware Retrieval: `0.85 * similarity + 0.15 * exp(-lambda * age_days)`
- Materialized Views for analytics (pg_cron scheduled refresh)
- Multi-tenant RLS with helper functions

**Related Features:**
- Chat Session Persistence (Phase 6.5.3) - Required foundation
- Entity Management UI (Phase 5.4) - Needs version support
- Two-Level Graph Architecture (Phase 5.7) - Could integrate with versioning
- Temporal Data Management (Phase 10.5) - Complementary feature

---

## Phase 15: External Integration & MCP Server

### Overview
Enable external tools and AI assistants to programmatically access Mosaic's capabilities through standardized protocols.

### Phase 15.1: MCP Server for External Tool Integration (1-2 weeks)

**Goal:** Provide Model Context Protocol server for n8n, Make, Zapier, Claude Desktop, and other AI tools

**Priority:** Medium-High (Enables ecosystem integrations)

**Estimated Effort:** 7-10 days

**Why MCP:**
- Standard protocol for AI/automation tool integration
- Automatic schema discovery and validation
- Single server exposes multiple tools and resources
- Native support in Claude Desktop, Cline, and emerging AI platforms
- Type-safe tool definitions with automatic documentation

**Implementation Phases:**

**Phase 1: Core MCP Server (2-3 days)**
- Set up MCP SDK (`@modelcontextprotocol/sdk`)
- Implement HTTP transport with API key auth
- Create stdio transport for local tools
- Connect to Supabase (service role or user-scoped)

**Phase 2: Search Tools (1 day)**
- `search_documents` tool
- `search_entities` tool

**Phase 3: Graph Tools (1-2 days)**
- `get_entity` tool
- `get_entity_neighbors` tool
- `find_path` tool

**Phase 4: Document Tools (1 day)**
- `list_documents` resource
- `get_document` resource
- `ingest_document` tool (future)

**Phase 5: Resources (1 day)**
- `mosaic://graphs` - List available graphs
- `mosaic://graph/{id}` - Graph metadata
- `mosaic://document/{id}` - Document content
- `mosaic://entity/{id}` - Entity details

**Benefits:**
- For n8n: Single HTTP endpoint, auto-discovered tools
- For Claude Desktop: Native MCP integration, no custom code
- For developers: Type-safe API, automatic docs
- For Mosaic: Centralized external access point, easier to maintain

---

## Phase 16: Advanced Entity & Relationship Management

### Overview
Enhance entity and relationship management with custom types, source tracking, and improved UI.

### Phase 16.1: Custom Relationship Types Management (3-4 days)

**Goal:** Allow users to define domain-specific relationship types without code changes

**Priority:** Medium (Nice-to-have, not blocking)

**Estimated Effort:** 3-4 days (Phases 1-3)

**Implementation Phases:**

**Phase 1: Basic Management UI (1-2 days)**
- Create "Relationship Types" section in Settings page
- Display current types in a table with usage counts
- Add new type form with validation
- Edit existing types
- Delete unused types (only if count = 0)

**Phase 2: Database Schema (1 day)**
- Create `relationship_types` table
- Seed with existing 12 core types (remove "other")
- Add `is_system` flag to protect core types

**Phase 3: Dynamic Loading in UI (1 day)**
- Load relationship types from database
- Cache in React state/context
- Show formatted display names in dropdowns
- Sort by usage count

**Phase 4: Python Extractor Integration (Optional, 2-3 days)**
- Load relationship types from database in Python
- Use dynamic types in LLM prompt
- Fall back to core types if database unavailable

### Phase 16.2: Entity Source Document & Chunk References (5-8 days)

**Goal:** Provide direct access to source material where entities were mentioned

**Priority:** High (Core feature for entity validation and exploration)

**Estimated Effort:** 5-8 days total

**Implementation Phases:**

**Part 1: Document List on Entity Page (1-2 days)**
- Add "Source Documents" section to entity details page
- Display list of documents where entity is mentioned
- Sort by relevance, date, mention count
- Filter by document type
- Show preview snippet on hover

**Part 2: Chunk-Level References (2-3 days)**
- Add "Mentions" or "Context" section showing specific chunks
- Link to specific chunk in Docling document viewer
- Show chunk content with entity highlighted
- Display surrounding context
- Deep linking: `/documents/:docId/chunks/:chunkId`

**Part 3: Docling Document Viewer Integration (2-3 days)**
- Create document viewer using Docling's rendering
- Display original document structure
- Highlight entity mentions throughout document
- Jump to specific chunk/page from entity page
- Show all entities extracted from current view

**Benefits:**
- Easy verification of entity information
- Direct access to source material
- Better understanding of entity context
- Improved trust in extracted data
- Seamless navigation: entity → document → chunk

---

## Additional Items to Review

### Chat Session Persistence & History
**Status:** Already exists in BUILD_PLAN as Phase 6.5.3
**Action:** No migration needed - duplicate entry in INBOX

### Prompt Management System  
**Status:** Already completed (Phase 8.6)
**Action:** No migration needed - duplicate entry in INBOX

### Entity Deduplication & Merge Assistant
**Status:** Already exists in BUILD_PLAN as Phase 10.1
**Action:** No migration needed - duplicate entry in INBOX

---

## Next Steps

1. Review these proposals
2. Add approved phases to BUILD_PLAN.md (insert before Changelog section)
3. Update INBOX.md to mark items as moved
4. Update changelog with migration date
