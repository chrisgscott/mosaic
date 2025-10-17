# INBOX

## 💡 Enhancements & Ideas

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
- ✅ Canonical name normalization (lowercase, trimmed)
- ✅ pgvector similarity search (0.85 threshold during extraction)
- ✅ Unique constraints prevent exact duplicates
- ❌ No automated duplicate detection post-extraction
- ❌ No merge workflow for identified duplicates
- ❌ No AI-assisted merge suggestions

**Proposed Solution: Smart Merge Assistant**

**Phase 1: Manual Merge Workflow (2-3 days)**
- [ ] Add "Merge Entities" action to entity list (bulk select)
- [ ] Create merge dialog showing:
  - All selected entities side-by-side
  - Combined document/chunk references
  - Suggested canonical name (most common)
  - Suggested type (most common)
  - Combined aliases array
  - Merged description (concatenated or user-selected)
  - Confidence score (weighted average)
- [ ] Merge operation:
  - Keep one entity (primary), delete others
  - Union all document_ids and chunk_ids
  - Update all relationships to point to primary entity
  - Add deleted entity names as aliases
  - Preserve highest confidence score
- [ ] Add "Mark as Alias" quick action (one-click merge)

**Phase 2: Automated Duplicate Detection (2-3 days)**
- [ ] Create background job: `detect_duplicate_entities`
- [ ] Detection algorithm:
  1. Group entities by type
  2. Calculate embedding similarity (pgvector)
  3. Check name similarity (Levenshtein distance)
  4. Check for common abbreviations (SDA → Strategic Design Approaches)
  5. Analyze co-occurrence in same documents/chunks
  6. Score duplicate probability (0-1)
- [ ] Store suggestions in `entity_merge_suggestions` table:
  ```sql
  CREATE TABLE entity_merge_suggestions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    primary_entity_id UUID REFERENCES entities(id),
    duplicate_entity_ids UUID[],
    similarity_score FLOAT,
    confidence FLOAT,
    suggested_name TEXT,
    suggested_description TEXT,
    status TEXT, -- 'pending', 'accepted', 'rejected', 'ignored'
    created_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ
  );
  ```
- [ ] Add "Merge Suggestions" tab to graph page
- [ ] Show duplicate pairs with similarity scores
- [ ] One-click accept/reject workflow

**Phase 3: AI-Assisted Merge Intelligence (3-4 days)**
- [ ] Use LLM to analyze entity pairs and generate:
  - Confidence that entities are duplicates (0-1)
  - Reasoning for merge recommendation
  - Suggested canonical name (best representation)
  - Synthesized description (combines both, removes redundancy)
  - Relationship preservation strategy
- [ ] Prompt template:
  ```
  Analyze these two entities and determine if they should be merged:
  
  Entity 1: {name1} ({type1})
  Description: {desc1}
  Appears in: {doc_count1} documents
  
  Entity 2: {name2} ({type2})
  Description: {desc2}
  Appears in: {doc_count2} documents
  
  Are these the same entity? Provide:
  1. Confidence (0-1)
  2. Reasoning
  3. Suggested canonical name
  4. Merged description
  ```
- [ ] Batch processing for efficiency (analyze 10-20 pairs per API call)
- [ ] User review queue with AI explanations
- [ ] Learn from user decisions (accept/reject patterns)

**Phase 4: Proactive Merge Suggestions (Future)**
- [ ] Real-time duplicate detection during extraction
- [ ] Auto-merge high-confidence duplicates (>0.95)
- [ ] Notification system for merge suggestions
- [ ] Bulk merge operations (merge all SDA variations)
- [ ] Entity quality dashboard showing duplicate clusters
- [ ] Scheduled deduplication runs (weekly/monthly)

**Benefits:**
- ✅ Cleaner, more accurate knowledge graph
- ✅ Better relationship quality (no broken connections)
- ✅ Reduced manual curation effort
- ✅ Improved search results (fewer duplicate entities)
- ✅ AI-powered merge intelligence
- ✅ Learning system improves over time

**Technical Considerations:**
- Need efficient similarity search (pgvector + text similarity)
- Merge operations must be atomic (transaction safety)
- Relationship updates must cascade correctly
- Consider undo/rollback for incorrect merges
- May need entity merge history for audit trail
- LLM costs for AI-assisted analysis (batch to optimize)
- Need evaluation metrics (precision/recall of duplicate detection)

**Database Schema:**
```sql
-- Merge suggestions table
CREATE TABLE entity_merge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  primary_entity_id UUID NOT NULL REFERENCES entities(id),
  duplicate_entity_ids UUID[] NOT NULL,
  similarity_score FLOAT NOT NULL,
  confidence FLOAT,
  suggested_name TEXT,
  suggested_description TEXT,
  ai_reasoning TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Merge history for audit trail
CREATE TABLE entity_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  primary_entity_id UUID NOT NULL,
  merged_entity_ids UUID[] NOT NULL,
  merged_at TIMESTAMPTZ DEFAULT NOW(),
  merged_by UUID REFERENCES auth.users(id)
);
```

**API Endpoints:**
```typescript
// Manual merge
POST /api/graph/entities/merge
{ primary_id, duplicate_ids, merged_data }

// Get merge suggestions
GET /api/graph/merge-suggestions
{ status: 'pending' | 'all' }

// Accept/reject suggestion
PATCH /api/graph/merge-suggestions/:id
{ action: 'accept' | 'reject' | 'ignore' }

// Trigger duplicate detection
POST /api/graph/detect-duplicates
{ entity_type?: string, threshold?: number }
```

**Priority:** High (Phase 1-2), Medium (Phase 3), Low (Phase 4 - future enhancement)

**Estimated Effort:** 7-10 days total (Phases 1-3)

### Temporal Data Management & Versioning System
**Context:** Enterprise documents often have temporal aspects - quarterly reports supersede previous quarters, policies get updated, data becomes stale. Currently, Mosaic treats all documents as equally current, with no concept of "newer" vs "outdated" information.

**Use Cases:**
- Quarterly financial reports (Q1 2024 → Q2 2024 → Q3 2024)
- Policy documents with revision dates
- Market data that becomes stale
- Research papers with updated findings
- Product specifications across versions

**Problem:** When searching, users get results from both current and outdated sources with no way to:
- Identify which information is most recent
- Prefer newer data over older data
- Track document lineage/succession
- Mark documents as superseded without deleting them

**Proposed Solutions:**

**Option A: Document-Level Temporal Metadata**
- Add `effective_date`, `expiration_date`, `superseded_by_id` to documents table
- Add `is_current` boolean flag
- Search can filter/weight by temporal relevance
- Preserves historical data while marking what's current
- Simple to implement, works for most use cases

**Option B: Chunk-Level Temporal Weighting**
- Add `effective_date`, `confidence_decay_rate` to chunks table
- Apply time-based decay to chunk relevance scores during search
- Newer chunks automatically weighted higher
- More granular but complex to manage
- Useful when single document has mix of current/outdated info

**Option C: TimescaleDB Integration**
- Use TimescaleDB extension for time-series data
- Automatic data retention policies
- Efficient temporal queries
- Built-in downsampling and compression
- Overkill unless dealing with high-frequency updates

**Option D: Document Versioning System**
- Create `document_versions` table linking related documents
- Track version chains (v1 → v2 → v3)
- Mark "latest" version in chain
- Search prioritizes latest version by default
- Users can optionally search historical versions
- Clean separation of current vs historical data

**Recommended Approach: Option D (Document Versioning) + Option A (Temporal Metadata)**
- Implement document versioning for explicit succession tracking
- Add temporal metadata for implicit time-based relevance
- Search algorithm:
  1. Default: Only search latest versions
  2. Optional: Include historical versions with lower weight
  3. Apply time-based decay for non-versioned documents
  4. Show temporal context in results ("Q3 2024 Report - Latest")

**Implementation Phases:**

**Phase 1: Basic Temporal Metadata (1-2 days)**
- [ ] Add `effective_date`, `expiration_date`, `is_current` to documents
- [ ] Add temporal filters to search UI
- [ ] Display document age/freshness in results
- [ ] Manual marking of current/outdated status

**Phase 2: Document Versioning (2-3 days)**
- [ ] Create `document_versions` table
- [ ] Add "Upload New Version" workflow
- [ ] Link documents in version chains
- [ ] Auto-mark previous versions as superseded
- [ ] Search defaults to latest versions only

**Phase 3: Temporal Search Weighting (1-2 days)**
- [ ] Add time-decay function to search scoring
- [ ] Configurable decay rates per document type
- [ ] Boost recent documents in rankings
- [ ] Show temporal relevance indicators

**Phase 4: Advanced Features (Future)**
- [ ] Automatic expiration notifications
- [ ] Scheduled document updates
- [ ] Diff view between versions
- [ ] Temporal entity resolution (entity mentions across versions)
- [ ] TimescaleDB for high-frequency data sources

**Benefits:**
- ✅ Users always get most current information
- ✅ Historical data preserved for audit/compliance
- ✅ Clear document lineage tracking
- ✅ Configurable time-based relevance
- ✅ Supports quarterly reports, policy updates, etc.
- ✅ No data loss (superseded ≠ deleted)

**Technical Considerations:**
- Need UI for version management
- Search complexity increases (version filtering + temporal weighting)
- Storage grows (keeping all versions)
- May need data retention policies
- Entity resolution across versions (same entity, different time periods)
- Graph relationships may need temporal context

**Database Schema Changes:**
```sql
-- Add to documents table
ALTER TABLE documents ADD COLUMN effective_date TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN expiration_date TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN is_current BOOLEAN DEFAULT true;
ALTER TABLE documents ADD COLUMN superseded_by_id UUID REFERENCES documents(id);

-- New table for version chains
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  version_number INTEGER,
  version_label TEXT, -- "Q1 2024", "v2.1", etc.
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Priority:** Medium-High (Important for enterprise use cases, but not blocking current work)

---

## 🐛 Bugs & Issues

*No items pending - INBOX is clean!*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 17, 2025)
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

*Last cleaned: October 17, 2025*
