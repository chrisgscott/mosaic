# INBOX

## 💡 Enhancements & Ideas

### Custom Relationship Types Management
**Context:** Relationship types are currently hardcoded in both the Python extractor and the UI. Users cannot add custom relationship types specific to their domain without code changes.

**Current State:**
- 13 predefined types: `part_of`, `uses`, `requires`, `relates_to`, `implements`, `extends`, `depends_on`, `collaborates_with`, `manages`, `creates`, `analyzes`, `evaluates`, `other`
- Defined in Python enum (`graph_extractor.py`)
- Duplicated in UI dropdown (`relationships-card.tsx`)
- "other" type exists but is unused (0 instances in database)

**Problem:**
- Cannot add domain-specific relationship types (e.g., "funds", "reports_to", "supersedes")
- No way to remove unused types
- Changes require code deployment
- Python extractor and UI can get out of sync

**Proposed Solution: Settings Page for Relationship Types**

**Phase 1: Basic Management UI (1-2 days)**
- [ ] Create "Relationship Types" section in Settings page
- [ ] Display current types in a table:
  - Type name (snake_case)
  - Display name (plain language)
  - Usage count (# of relationships)
  - Created date
  - Actions (Edit, Delete)
- [ ] Add new type form:
  - Name input (auto-converts to snake_case)
  - Display name (optional, defaults to formatted name)
  - Validation (unique, no spaces, lowercase)
- [ ] Edit existing types (rename, change display name)
- [ ] Delete unused types (only if count = 0)
- [ ] Store in `relationship_types` table

**Phase 2: Database Schema (1 day)**
```sql
CREATE TABLE relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- snake_case: "reports_to"
  display_name TEXT,                    -- plain language: "reports to"
  description TEXT,                     -- optional explanation
  is_system BOOLEAN DEFAULT false,      -- prevent deletion of core types
  usage_count INTEGER DEFAULT 0,        -- cached count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with existing types
INSERT INTO relationship_types (name, is_system) VALUES
  ('part_of', true),
  ('uses', true),
  ('requires', true),
  ('relates_to', true),
  ('implements', true),
  ('extends', true),
  ('depends_on', true),
  ('collaborates_with', true),
  ('manages', true),
  ('creates', true),
  ('analyzes', true),
  ('evaluates', true);

-- Remove "other" - it's unused and not useful
```

**Phase 3: Dynamic Loading in UI (1 day)**
- [ ] Load relationship types from database instead of hardcoded array
- [ ] Cache in React state/context
- [ ] Refresh when types are updated
- [ ] Show formatted display names in dropdowns
- [ ] Sort by usage count (most used first)

**Phase 4: Python Extractor Integration (Optional, 2-3 days)**
- [ ] Load relationship types from database in Python
- [ ] Use dynamic types in LLM prompt
- [ ] Fall back to core types if database unavailable
- [ ] Sync mechanism to keep Python and DB in sync

**UI Design - Settings Page:**
```
┌─────────────────────────────────────────────┐
│ Settings > Relationship Types               │
├─────────────────────────────────────────────┤
│ [+ Add New Type]                            │
├─────────────────────────────────────────────┤
│ Type Name       Display      Used   Actions │
├─────────────────────────────────────────────┤
│ relates_to      relates to   33    [Edit]   │
│ part_of         part of      20    [Edit]   │
│ uses            uses         15    [Edit]   │
│ requires        requires     15    [Edit]   │
│ creates         creates      12    [Edit]   │
│ manages         manages      9     [Edit]   │
│ analyzes        analyzes     8     [Edit]   │
│ ...                                          │
│ custom_type     custom type  0     [Delete] │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Domain-specific relationship types
- ✅ No code changes needed
- ✅ Centralized management
- ✅ Consistent across UI and extraction
- ✅ Can remove unused types
- ✅ Usage statistics visible
- ✅ Protected system types

**Technical Considerations:**
- Need migration to create table and seed data
- UI dropdown needs to fetch types dynamically
- Cache types to avoid repeated queries
- Validate type names (snake_case, unique)
- Prevent deletion of types in use
- Consider type versioning/history
- May need RLS policies for multi-tenant

**API Endpoints:**
```typescript
GET /api/settings/relationship-types
POST /api/settings/relationship-types
PATCH /api/settings/relationship-types/:id
DELETE /api/settings/relationship-types/:id
```

**Priority:** Medium (Nice-to-have, not blocking)

**Estimated Effort:** 3-4 days (Phases 1-3)

---

### Chat Session Persistence & History
**Priority:** High  
**Effort:** 3-5 days  
**Phase:** 6.5.3 - Conversation Features
 
### Custom Relationship Types Management
**Context:** Relationship types are currently hardcoded in both the Python extractor and the UI. Users cannot add custom relationship types specific to their domain without code changes.

**Current State:**
- 13 predefined types: `part_of`, `uses`, `requires`, `relates_to`, `implements`, `extends`, `depends_on`, `collaborates_with`, `manages`, `creates`, `analyzes`, `evaluates`, `other`
- Defined in Python enum (`graph_extractor.py`)
- Duplicated in UI dropdown (`relationships-card.tsx`)
- "other" type exists but is unused (0 instances in database)

**Problem:**
- Cannot add domain-specific relationship types (e.g., "funds", "reports_to", "supersedes")
- No way to remove unused types
- Changes require code deployment
- Python extractor and UI can get out of sync

**Proposed Solution: Settings Page for Relationship Types**

**Phase 1: Basic Management UI (1-2 days)**
- [ ] Create "Relationship Types" section in Settings page
- [ ] Display current types in a table:
  - Type name (snake_case)
  - Display name (plain language)
  - Usage count (# of relationships)
  - Created date
  - Actions (Edit, Delete)
- [ ] Add new type form:
  - Name input (auto-converts to snake_case)
  - Display name (optional, defaults to formatted name)
  - Validation (unique, no spaces, lowercase)
- [ ] Edit existing types (rename, change display name)
- [ ] Delete unused types (only if count = 0)
- [ ] Store in `relationship_types` table

**Phase 2: Database Schema (1 day)**
```sql
CREATE TABLE relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- snake_case: "reports_to"
  display_name TEXT,                    -- plain language: "reports to"
  description TEXT,                     -- optional explanation
  is_system BOOLEAN DEFAULT false,      -- prevent deletion of core types
  usage_count INTEGER DEFAULT 0,        -- cached count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with existing types
INSERT INTO relationship_types (name, is_system) VALUES
  ('part_of', true),
  ('uses', true),
  ('requires', true),
  ('relates_to', true),
  ('implements', true),
  ('extends', true),
  ('depends_on', true),
  ('collaborates_with', true),
  ('manages', true),
  ('creates', true),
  ('analyzes', true),
  ('evaluates', true);

-- Remove "other" - it's unused and not useful
```

**Phase 3: Dynamic Loading in UI (1 day)**
- [ ] Load relationship types from database instead of hardcoded array
- [ ] Cache in React state/context
- [ ] Refresh when types are updated
- [ ] Show formatted display names in dropdowns
- [ ] Sort by usage count (most used first)

**Phase 4: Python Extractor Integration (Optional, 2-3 days)**
- [ ] Load relationship types from database in Python
- [ ] Use dynamic types in LLM prompt
- [ ] Fall back to core types if database unavailable
- [ ] Sync mechanism to keep Python and DB in sync

**UI Design - Settings Page:**
```
┌─────────────────────────────────────────────┐
│ Settings > Relationship Types               │
├─────────────────────────────────────────────┤
│ [+ Add New Type]                            │
├─────────────────────────────────────────────┤
│ Type Name       Display      Used   Actions │
├─────────────────────────────────────────────┤
│ relates_to      relates to   33    [Edit]   │
│ part_of         part of      20    [Edit]   │
│ uses            uses         15    [Edit]   │
│ requires        requires     15    [Edit]   │
│ creates         creates      12    [Edit]   │
│ manages         manages      9     [Edit]   │
│ analyzes        analyzes     8     [Edit]   │
│ ...                                          │
│ custom_type     custom type  0     [Delete] │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Domain-specific relationship types
- ✅ No code changes needed
- ✅ Centralized management
- ✅ Consistent across UI and extraction
- ✅ Can remove unused types
- ✅ Usage statistics visible
- ✅ Protected system types

**Technical Considerations:**
- Need migration to create table and seed data
- UI dropdown needs to fetch types dynamically
- Cache types to avoid repeated queries
- Validate type names (snake_case, unique)
- Prevent deletion of types in use
- Consider type versioning/history
- May need RLS policies for multi-tenant

**API Endpoints:**
```typescript
GET /api/settings/relationship-types
POST /api/settings/relationship-types
PATCH /api/settings/relationship-types/:id
DELETE /api/settings/relationship-types/:id
```

**Priority:** Medium (Nice-to-have, not blocking)

**Estimated Effort:** 3-4 days (Phases 1-3)

---

### Entity Source Document & Chunk References
**Context:** Entity pages currently show basic metadata (confidence, document count, chunk count) but don't provide direct access to the source material where entities were mentioned. Users cannot easily verify entity information or explore the original context.

**Problem:**
- Entity pages show document/chunk counts but no links to actual documents
- No way to see which specific documents mention an entity
- Cannot navigate from entity to the chunks where it was extracted
- Difficult to verify or validate entity information
- Missing connection between graph entities and source material

**Proposed Solution:**

**Part 1: Document List on Entity Page (1-2 days)**
- [ ] Add "Source Documents" section to entity details page
- [ ] Display list of documents where entity is mentioned:
  - Document title (clickable link)
  - Document type/category
  - Number of mentions in that document
  - Extraction confidence for that document
  - Date added
- [ ] Sort by: relevance, date, mention count
- [ ] Filter by document type
- [ ] Show preview snippet of entity mention on hover

**Part 2: Chunk-Level References with Docling Integration (2-3 days)**
- [ ] Add "Mentions" or "Context" section showing specific chunks
- [ ] For each chunk reference:
  - Link to the specific chunk in Docling document viewer
  - Show chunk content with entity highlighted
  - Display surrounding context (previous/next chunks)
  - Show page number and location in original document
  - Include extraction confidence for that mention
- [ ] Deep linking: `/documents/:docId/chunks/:chunkId`
- [ ] Highlight entity mentions within chunk text
- [ ] Navigate between mentions (previous/next)

**Part 3: Docling Document Viewer Integration (2-3 days)**
- [ ] Create document viewer using Docling's rendering capabilities
- [ ] Display original document structure (headings, tables, images)
- [ ] Highlight entity mentions throughout document
- [ ] Jump to specific chunk/page from entity page
- [ ] Show all entities extracted from current view
- [ ] Side panel with entity graph for current document

**UI Design:**
```
┌─────────────────────────────────────────────┐
│ Entity: Strategic Design Approaches         │
│ [Edit] [Delete]                             │
├─────────────────────────────────────────────┤
│ Information (33%)  │  Relationships (66%)   │
├────────────────────┴────────────────────────┤
│ Source Documents (4)                        │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 SDA Methodologies Guide              │ │
│ │    12 mentions • High confidence        │ │
│ │    Added Oct 17, 2025                   │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 Strategic Planning Overview          │ │
│ │    8 mentions • Medium confidence       │ │
│ │    Added Oct 15, 2025                   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Context & Mentions (20)                     │
│ ┌─────────────────────────────────────────┐ │
│ │ "...Strategic Design Approaches is a    │ │
│ │  comprehensive framework..."            │ │
│ │  📄 SDA Guide • Page 3 • Chunk 12       │ │
│ │  [View in Document →]                   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Easy verification of entity information
- ✅ Direct access to source material
- ✅ Better understanding of entity context
- ✅ Improved trust in extracted data
- ✅ Seamless navigation: entity → document → chunk
- ✅ Enhanced document exploration
- ✅ Visual document rendering with Docling

**Technical Considerations:**
- Need to query documents table with entity.document_ids
- Chunk references already stored in entity.chunk_ids
- Docling document viewer may need separate component
- Consider pagination for entities with many mentions
- Deep linking requires document/chunk routing
- May need to cache Docling rendered documents
- Highlight logic needs to handle entity name variations

**Database Queries:**
```typescript
// Get documents for entity
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .in('id', entity.document_ids);

// Get chunks for entity with document info
const { data: chunks } = await supabase
  .from('chunks')
  .select('*, document:documents(*)')
  .in('id', entity.chunk_ids)
  .order('document_id', 'chunk_index');
```

**Priority:** High (Core feature for entity validation and exploration)

**Estimated Effort:** 5-8 days total (all three parts)

---

### Prompt Management System
**Context:** Currently, prompts are hardcoded throughout the platform (chunk summarization, graph extraction, HyDE generation, multi-query, etc.). Changes require code deployments.

**Proposal - Phase 1: Prompt Settings Page**
- Create a dedicated settings page for managing all system prompts
- Store prompts in `system_settings` table (similar to current LLM settings)
- Categories: `prompts.chunkSummary`, `prompts.graphExtraction`, `prompts.hyde`, `prompts.multiQuery`, etc.
- Allow real-time editing and testing without code changes
- Version tracking for prompt changes

**Proposal - Phase 2: Automated Prompt Optimization**
- Build an A/B testing framework for prompts
- Continuously test prompt variations against control
- Track metrics: quality scores, latency, token usage, user satisfaction
- Statistical significance testing before promoting winners
- Automated rollback if performance degrades
- Prompt version history and analytics dashboard

**Benefits:**
- Faster iteration on prompt quality
- Data-driven prompt improvements
- No code deployments for prompt tweaks
- Reduced engineering bottleneck
- Continuous quality improvement

**Technical Considerations:**
- Need evaluation metrics for each prompt type
- Require test datasets for automated testing
- Consider cost implications of parallel testing
- May need dedicated prompt optimization service

**Priority:** Medium (Phase 1), Low (Phase 2 - future enhancement)

### Entity Deduplication & Merge Assistant
**Context:** Graph extraction creates duplicate entities due to name variations, typos, abbreviations, and context differences. Currently, users must manually identify and merge duplicates. This creates graph pollution and reduces relationship quality.

**Problem Examples:**
- "CCAAAPPI" vs "CCAAPPI" (typo)
- "Strategic Design Approaches" vs "SDA" (abbreviation)
- "Opportunity Analysis" vs "OA" vs "Opportunity Assessment" (variations)
- "AI applications" vs "Artificial Intelligence applications" (synonym)
- Multiple extractions of same entity from different documents

**Current State:**
- Chat conversations exist only in browser memory
- Refreshing the page clears all conversation history
- No way to revisit or continue previous conversations
- Users lose context when navigating away

**Required Implementation:**
1. **Database Schema:**
   - `chat_sessions` table: session metadata (title, created_at, updated_at, user_id)
   - `chat_messages` table: individual messages (session_id, role, content, sources, timestamp)
   - Auto-generate session titles from first message or conversation summary

2. **Session Management:**
   - Create new session on first message
   - Save each message (user + assistant) to database
   - Load session history when revisiting
   - List all user's sessions with preview/search
   - Delete/archive old sessions

3. **UI Components:**
   - Session sidebar/dropdown to switch between conversations
   - "New Chat" button to start fresh session
   - Session list with timestamps and previews
   - Search across all sessions
   - Export conversation functionality

4. **Conversation Continuity:**
   - Load full conversation history when opening session
   - Apply 10-turn limit only to what's sent to LLM (not what's displayed)
   - Show full conversation in UI, but send limited context to API
   - Preserve source citations and metadata

5. **Performance Considerations:**
   - Paginate long conversations
   - Lazy load old messages
   - Index sessions by user_id and timestamp
   - Consider conversation summarization for very long threads

**Benefits:**
- Users can return to conversations anytime
- Build knowledge over multiple sessions
- Reference previous answers
- Share conversation links (optional)
- Track conversation quality over time

**Related:**
- Phase 6.5.2: Context window management (conversation summarization)
- Phase 6.5.4: Analytics (track conversation metrics)

**Notes:**
- This is a critical feature for production use
- Without persistence, chat is just a demo
- Consider privacy/data retention policies
- May want conversation sharing/collaboration features later

---

## 🐛 Bugs & Issues

*No items pending - INBOX is clean!*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 19, 2025 - Evening)
- **Adaptive Response Depth & Retrieval Matching** → Phase 6.5 Enhancements
  - Quick/Standard/Detailed response modes
  - Deep Research Mode with CrewAI + o4-mini-deep-research
- **Kibo UI Component Library Evaluation** → Phase 12: Polish & Production Readiness

### Moved to BUILD_PLAN.md (October 19, 2025 - Morning)
All major enhancement proposals migrated to **Phase 10: Advanced Graph & Document Intelligence**:

1. **Entity Deduplication & Merge Assistant** → Phase 10.1 (High Priority, 1-2 weeks)
   - Manual merge workflow
   - Automated duplicate detection
   - AI-assisted merge intelligence

2. **Generic Entity Detection & Cleanup** → Phase 10.2 (Medium Priority, 3-4 days)
   - Detection & flagging of generic entities
   - Review & cleanup UI

3. **Document Organization System** → Phase 10.3 (Medium-High Priority, 1-2 weeks)
   - Folder/subfolder hierarchy
   - Tagging system
   - AI-powered organization suggestions

4. **Document-Level Intelligence & Graph Integration** → Phase 10.4 (High Priority, 2-3 weeks)
   - Document summarization & metadata
   - Auto-tagging from content
   - Documents as graph entities
   - Staleness detection & freshness tracking
   - Document clustering & discovery

5. **Temporal Data Management & Versioning** → Phase 10.5 (Medium-High Priority, 1 week)
   - Basic temporal metadata
   - Document versioning
   - Temporal search weighting

6. **Intelligent Source Discovery** → Phase 10.6 (Medium-High Priority, 1-2 weeks)
   - Knowledge gap analysis
   - Web source discovery
   - Automated source ingestion

7. **Adaptive Chunk Quality Enhancement** → Phase 10.7 (Medium-High Priority, 1-2 weeks)
   - Automatic quality detection
   - Selective LLM post-processing
   - On-demand re-chunking UI

8. **OCR Cleanup Pre-Processing** → Phase 10.8 (Medium Priority, 1 week)
   - Scanned document detection
   - Conservative OCR cleanup
   - Verification & rollback
   - UI & user control

9. **Prompt Management System** → Phase 10.9 (Medium Priority, 1 week)
   - Prompt settings page
   - Database-driven prompt management
   - Version tracking

### Moved to BUILD_PLAN.md (October 17, 2025)
- **Living Entities** → Phase 9 (4-6 weeks)
  - Template-based entity pages
  - CrewAI update crew
  - UI components
  - Integration with ingestion pipeline

### Previous Moves (October 17, 2025)
- **Entity & Relationship Description Synthesis** → Phase 5.7: Enterprise Graph Architecture
- **Corpus-Level Entity Management** → Phase 5.4: Graph Management UI (approach chosen)
- **Two-Level Graph Architecture** → Phase 5.7: Enterprise Graph Architecture  
- **Hierarchical Graph Traversal** → Phase 6 Enhancements

### Previous Moves (October 16, 2025)
- **HyDE Query Enhancement Tuning** → Phase 6 Enhancements (Medium Priority)
- **Graph Extractor Entity Quality Improvement** → Phase 6 Enhancements (Medium Priority)
- **PGMQ Queue State Corruption Fix** → Phase 6 Enhancements (High Priority)

### Previous Migrations (January 16, 2025)
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements
- Frontend Display Issues → TO_PROCESS.md
- Infrastructure Cleanup → TO_PROCESS.md
- Advanced RAG Patterns → TO_PROCESS.md
- Operational Decisions → TO_PROCESS.md

### Already Implemented (Removed from INBOX)
- Docling with VLM ✅ Deployed and working
- Parallel Page Processing ✅ Implemented in Docling processor

---

## How to Use This File

When new ideas or enhancements come up:

1. **Add them here first** - Quick capture without overthinking
2. **Run /cleanup workflow** - Periodically move items to BUILD_PLAN or TO_PROCESS
3. **Keep it clean** - INBOX should be empty or near-empty most of the time

---

*Last cleaned: October 19, 2025 (Evening)*
