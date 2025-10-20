# Mosaic RAG Platform - Build Plan

**Last Updated:** October 19, 2025  
**Status:** Phases 1-5 Core Complete + Phase 7.1-7.4 Complete + Phase 8 Complete - **Production-ready end-to-end pipeline: Upload → Processing → Embeddings → Graph RAG → Search working across all document types (PDF, PPTX, TXT, CSV, MD)**

---

## Overview

Mosaic is a comprehensive RAG (Retrieval-Augmented Generation) platform that combines semantic search with graph-based knowledge extraction. This document outlines the complete build plan from document upload through advanced search capabilities.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│  Upload → Storage → Queue → Background Processing            │
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │ Supabase │ →  │   pgmq   │ →  │ Edge Function│          │
│  │ Storage  │    │  Queue   │    │   Worker     │          │
│  └──────────┘    └──────────┘    └──────────────┘          │
│                                           ↓                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Document Processing Pipeline                   │   │
│  │  Extract → Chunk → Embed → Graph Extraction          │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Storage Layer (Postgres)                    │   │
│  │  • Vector Store (pgvector)                           │   │
│  │  • Graph Database (entities + relationships)         │   │
│  │  • Document Metadata                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Search & Query Interface                       │   │
│  │  Hybrid Search (Semantic + Keyword + Graph)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Upload Infrastructure ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Document upload, storage, background processing queue with pgmq

---

## Phase 2: Real-Time Status Updates & UX Improvements ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Supabase Realtime integration, optimistic UI, multiple file uploads

### Phase 2 Improvements (Future Enhancement)

#### 📊 Granular Document Processing Status (Low Priority)
**Goal**: Provide detailed visibility into each processing stage for better UX and debugging

**Current Status Values:**
- `uploading` - File upload in progress
- `uploaded` - Upload complete, queued for processing
- `processing` - Worker is processing the document
- `ready` - All processing complete
- `error` - Processing failed

**Proposed Granular Status Values:**
- `uploading` - File upload in progress
- `pending` - Queued for processing
- `processing` - Worker has picked up the job
- `chunking` - Creating chunks from document
- `embedding` - Generating embeddings for chunks
- `extracting_graph` - Extracting entities and relationships
- `ready` - All processing complete
- `error` - Processing failed, retries remaining
- `failed` - Processing failed, no retries remaining

**Additional Tracking:**
- [ ] Add `processing_stage_started_at` timestamp field
- [ ] Track duration of each stage for analytics
- [ ] Add progress percentage (0-100%)
- [ ] Show estimated time remaining per stage

**Benefits:**
- Users see exactly what stage their document is in
- Easier debugging (know where failures occur)
- Better progress indication
- Can show estimated time remaining per stage

**Implementation:**
- [ ] Update `documents.status` enum in database
- [ ] Update worker to set status at each stage
- [ ] Update frontend status display components
- [ ] Add stage duration tracking
- [ ] Add progress percentage calculation

**Files to modify:**
- Database migration for status enum
- `apps/backend/ingest/main.py` - Update status at each stage
- Frontend status components
---

## Phase 3: Document Processing Pipeline ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Docling integration with VLM, parallel page processing, support for all major document types

---

## Phase 4: Vector Embeddings & Semantic Search ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
OpenAI embeddings, pgvector storage, semantic search API
- [x] Setup pgvector extension
- [x] Create `embeddings` table with vector(1536) column
- [x] Integrate OpenAI Embeddings API (text-embedding-3-small)
- [x] Generate embeddings for all chunks (1,494 embeddings)
- [x] Store embeddings with chunk references
- [x] Add HNSW index for fast similarity search
- [x] Create `search_chunks_semantic()` database function

#### 🔍 Semantic Search ✅
- [x] Implement vector similarity search with cosine distance
- [x] Add search API endpoint (`/api/search`)
- [x] Create search UI component with real-time results
- [x] Show relevant chunks with similarity scores
- [x] Link back to source documents
- [x] Display processing time and result count

#### ⚡ Performance Optimization ✅
- [x] Batch embedding generation (100 chunks per batch)
- [x] Implement rate limiting with exponential backoff
- [x] Monitor embedding costs (tracked in logs)
- [x] Efficient database queries with RLS policies

#### 📝 Chunk Summaries (Optional Enhancement - Future)
- [ ] Add `chunk_summary` column to chunks table
- [ ] Generate context-aware summaries with GPT-4o Mini
- [ ] Include surrounding chunk context when summarizing
- [ ] Store both original content and summary
- [ ] Backfill summaries for existing chunks
- [ ] Decide: Embed summaries vs original content

#### Docling Native Chunking (Enhancement)
- [ ] Evaluate HybridChunker vs current MarkdownChunker
- [ ] Implement HybridChunker with embedding model tokenizer
- [ ] Enable context enrichment (heading hierarchy)
- [ ] A/B test retrieval quality
- [ ] Switch to HybridChunker if better results
- [ ] Configure table serialization options

**Benefits:**
- Token-aware chunking (respects embedding limits)
- Context enrichment (adds heading hierarchy to chunks)
- Better table handling (configurable serialization)
- Structure preservation (document-aware boundaries)

**Documentation:** [Docling Chunking Concepts](https://docling-project.github.io/docling/concepts/chunking/)

### Technical Decisions
- **Embedding model**: OpenAI `text-embedding-3-small` (1536 dimensions, cost-effective)
- **Vector index**: HNSW for fast approximate nearest neighbor search
- **Similarity metric**: Cosine similarity (standard for embeddings)
- **Chunking**: Consider upgrading to Docling HybridChunker for better quality

---

## Phase 5: Graph RAG - Knowledge Extraction ✅ CORE COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Entity/relationship extraction, graph database, semantic entity search, smart cascade delete

### Phase 5.1: Core Implementation ✅ COMPLETE

#### 🕸️ Graph Database Schema
- [x] Create `entities` table (Postgres-native, following R2R approach)
  - `id`, `user_id`, `name`, `type`, `description`
  - `embedding` (VECTOR(1536)) for semantic entity search
  - `document_ids`, `chunk_ids` arrays for source tracking
  - `canonical_name`, `aliases` for deduplication
  - `metadata` (JSONB), `extraction_confidence`
  - HNSW index for fast similarity search
- [x] Create `relationships` table
  - `id`, `user_id`, `source_entity_id`, `target_entity_id`
  - `relationship_type`, `description`, `bidirectional`
  - `document_ids`, `chunk_ids` arrays
  - `metadata` (JSONB), `extraction_confidence`
  - Unique constraint on `(user_id, source_entity_id, target_entity_id, relationship_type)`
- [x] Add indexes for graph traversal
  - Source/target entity indexes
  - Composite indexes for efficient joins
  - GIN indexes for array columns
- [x] Implement RLS policies
  - User isolation for entities and relationships
  - Public document support (entities visible if doc is public)
- [x] Helper functions
  - `find_similar_entities()` - Deduplication via pgvector
  - `get_entity_with_relationships()` - 1-hop traversal
  - `search_entities_by_name()` - Fuzzy text search

#### 🤖 Entity Extraction
- [x] Integrate LLM for entity extraction (GPT-4o-mini via Vercel AI SDK)
- [x] Define entity types (11 types)
  - person, organization, concept, methodology, framework
  - tool, technology, location, event, document, other
- [x] Extract entities from chunks with structured output (Zod schemas)
- [x] Deduplicate entities across documents
  - Canonical name normalization (lowercase, trimmed)
  - pgvector similarity search (0.85 threshold)
  - Unique database constraints
- [x] Store entity metadata with source tracking
- [x] Batch processing (5 chunks at a time)

#### 🔗 Relationship Extraction
- [x] Extract relationships between entities (12 types)
  - uses, requires, relates_to, part_of, implements
  - extends, depends_on, collaborates_with, manages
  - creates, analyzes, evaluates, other
- [x] Classify relationship types with structured output
- [x] Calculate confidence scores (0.9 default)
- [x] Store relationship metadata with source tracking
- [x] Deduplicate via unique constraints

#### 🔍 Graph Search
- [x] Semantic entity search using pgvector
- [x] Multi-hop graph traversal (configurable depth)
- [x] Relationship discovery between entities
- [x] Context expansion via graph connections
- [x] Query type detection (relationship vs entity queries)
- [x] Combine graph results with vector search

#### 📡 API Endpoints
- [x] `POST /api/graph/extract` - Extract graph from document
- [x] Graph search functions ready for integration

#### 📚 Documentation
- [x] Complete implementation guide (`/docs/graph-rag.md`)
- [x] Usage examples and API reference
- [x] Performance notes and cost analysis
- [x] Implementation summary (`/GRAPH_RAG_IMPLEMENTATION.md`)

### Phase 5.2: Testing & Integration ✅ COMPLETE
- [x] Test extraction on multiple documents
- [x] Verify deduplication works correctly
- [x] Validate relationship accuracy
- [x] Measure extraction performance
- [x] Integrate graph search into main search API
- [x] Add graph search toggle to UI (automatic via relationship query detection)
- [x] Show entity/relationship results in search UI
- [x] Add progress tracking for graph operations

### Phase 5.3: Smart Cascade Delete & Data Integrity ✅ COMPLETE
**Goal**: Ensure graph data is properly cleaned up when documents are deleted

- [x] Implement smart cascade delete for entities
  - Check if entity has multiple `document_ids` in array
  - If yes: Remove only the deleted document_id and chunk_ids
  - If no: Delete the entity entirely
- [x] Implement smart cascade delete for relationships
  - Same logic as entities for `document_ids` and `chunk_ids`
- [x] Update delete endpoint to handle graph cleanup
- [ ] Add database trigger or function for automatic cleanup (optional optimization)
- [ ] Add tests for cascade delete logic (future)

**Implementation:**
- Smart cascade logic in `apps/web/app/(app)/documents/actions.ts`
- Handles both `document_ids` and `chunk_ids` arrays
- Non-fatal errors (logs warning but continues deletion)
- Preserves shared entities/relationships across documents

### Phase 5.4: Graph Management UI (High Priority)
**Goal**: Give users control over extracted entities and relationships

**Approach**: Corpus-Level Management (chosen over document-level review)
- ✅ Let automation run without interruption
- ✅ Provide `/graph` management page for entire corpus
- ✅ User curates entities when convenient, in batches
- ✅ See patterns, duplicates, and relationships across all documents
- ✅ Scales better (works for 10 or 10,000 documents)

#### Phase 1: Basic Entity List (2-3 hours)
- [ ] Create graph management page (`/graph`)
- [ ] View all entities with search/filter
- [ ] Filter by type, document, confidence score
- [ ] Sort by most referenced, newest, confidence
- [ ] Show entity details: name, type, doc count, chunk count
- [ ] Basic delete functionality (uses smart cascade)
- [ ] Smart quality indicators:
  - 🟢 High confidence (>0.85) + Multiple docs
  - 🟡 Medium confidence (0.7-0.85) or Single doc
  - 🔴 Low confidence (<0.7) or Suspicious pattern
  - ⚠️ Potential duplicate detected

#### Phase 2: Entity Editing & Merging (1-2 days)
- [ ] Entity details panel
  - Full description and aliases
  - Documents and chunks where it appears
  - Relationships (incoming/outgoing)
  - View context from source chunks
- [ ] Edit entity names, types, descriptions
- [ ] Merge duplicate entities workflow
  - Automatic duplicate detection
  - Select multiple entities → merge into one
  - Choose primary name, combine aliases
  - Synthesize descriptions
  - Union document_ids and chunk_ids
  - Update all relationships
- [ ] Bulk operations
  - Select multiple entities → delete
  - Filter by confidence → bulk delete low-quality
  - Search pattern → review and clean up

#### Phase 3: Relationship Management ✅ COMPLETE (1-2 days)
- [x] View all relationships with filtering
- [x] Edit relationship types and descriptions
- [x] Delete incorrect relationships
- [x] Add manual relationships (API ready, UI pending)
- [x] Relationship quality indicators

#### Type Management
- [ ] Create type management interface
- [ ] Edit entity types (add/remove/rename)
- [ ] Edit relationship types (add/remove/rename)
- [ ] Add custom types per user/organization
- [ ] Type validation and suggestions
- [ ] Audit trail for type changes

#### API Endpoints
- [x] `GET /api/graph/entities` - List entities with filters (Server Action)
- [x] `PATCH /api/graph/entities/:id` - Update entity (Server Action)
- [x] `DELETE /api/graph/entities/:id` - Delete entity (Server Action)
- [x] `POST /api/graph/entities/merge` - Merge entities (Server Action)
- [x] `GET /api/graph/relationships` - List relationships (Server Action)
- [x] `PATCH /api/graph/relationships/:id` - Update relationship (Server Action)
- [x] `DELETE /api/graph/relationships/:id` - Delete relationship (Server Action)
- [x] `POST /api/graph/relationships` - Create relationship (Server Action)
- [ ] `GET /api/graph/types` - Get available types
- [ ] `POST /api/graph/types` - Add custom type

### Phase 5.5: Graph Visualization (Future)
- [ ] Integrate graph visualization library (D3.js, Cytoscape, React Flow)
- [ ] Create interactive graph view
- [ ] Show entity details on hover
- [ ] Enable graph exploration (zoom, pan, filter)
- [ ] Highlight paths between entities
- [ ] Click to edit entities/relationships
- [ ] Visual indication of confidence/source

### Phase 5.6: Advanced Features (Future)
- [ ] Community detection (Leiden clustering)
- [ ] Entity resolution improvements
- [ ] Temporal relationships
- [ ] Cross-document entity linking
- [ ] Graph-based summarization

### Phase 5.7: Enterprise Graph Architecture (High Priority)
**Goal**: Enterprise-grade graph with audit trails, multi-source validation, and lazy synthesis

#### Two-Level Graph Architecture
**Priority**: High (Critical for enterprise requirements)

**Rationale**: Mosaic is an enterprise-grade platform for multi-billion dollar companies requiring:
- Cross-source entity resolution (documents + structured data + news feeds)
- Complete audit trails and data lineage
- Multi-source validation and confidence scoring
- Temporal tracking of entity evolution
- Compliance-ready provenance tracking

**Architecture**:

**Level 1: Document Entities (Raw Extractions)**
- [ ] Create `document_entities` table
- [ ] Create `document_relationships` table
- [ ] Store raw extractions without synthesis or merging
- [ ] Track source_type ('document', 'structured_data', 'news_feed')
- [ ] Immutable audit trail (never deleted, only marked)

**Level 2: Global Entities (Deduplicated)**
- [ ] Keep existing `entities` and `relationships` tables
- [ ] Add `entity_sources` link table for provenance
- [ ] Add `relationship_sources` link table
- [ ] Track multi-source metadata (source_count, source_types, confidence)
- [ ] Add temporal tracking (first_seen, last_updated)

**Benefits**:
- ✅ Cross-source intelligence (360-degree entity views)
- ✅ Multi-source validation (confidence from source diversity)
- ✅ Complete audit trails (immutable extraction records)
- ✅ Temporal tracking (entity evolution over time)
- ✅ Flexible entity resolution (re-run with different strategies)
- ✅ Organization isolation (multi-tenant RLS at both levels)

**Implementation Phases**:
1. Phase 1 (Tables + RLS): 1 day
2. Phase 2 (Extractor changes): 1-2 days
3. Phase 3 (Resolution service): 2-3 days
4. Phase 4 (Multi-source extension): 2-3 days

**Total Effort**: ~1-2 weeks

#### Entity & Relationship Description Synthesis
**Priority**: Medium (Implement with two-level architecture)

**Problem**: When entities are mentioned in multiple chunks/documents, we append document_ids and chunk_ids but keep the original description, losing new information from subsequent mentions.

**Solution**: Lazy Synthesis on Retrieval (Option D) ⭐ RECOMMENDED

**Approach**:
- [ ] Store all raw extractions in `document_entities` (no synthesis during ingestion)
- [ ] When entity is accessed/retrieved, synthesize on-demand from all mentions
- [ ] Cache synthesized result for performance
- [ ] Only pay synthesis cost for entities that are actually used

**Benefits**:
- ✅ Zero ingestion overhead (no synthesis during processing)
- ✅ Pay only for what's used (100x cost reduction)
- ✅ Always fresh (synthesis uses latest data)
- ✅ Scales better (most entities never accessed)
- ✅ Enables experimentation (change strategy without reprocessing)

**Cost Analysis**:
- 1000 documents × 50 entities = 50,000 raw extractions
- Only 500 unique entities accessed by users
- Synthesis cost: 500 × $0.0001 = $0.05 (vs $5.00 for all)
- **100x cost reduction**

**Implementation**:
- [ ] Add entity resolution service
- [ ] Implement synthesis function with caching
- [ ] Integrate with entity retrieval endpoints
- [ ] Add cache invalidation on new documents

**Files to Modify**:
- `apps/backend/ingest/processors/graph_extractor.py` - Keep simple (just store raw)
- Add entity resolution service
- Implement caching layer

### Technical Decisions
- **Storage**: Postgres-native (no Neo4j) following R2R's proven approach
- **LLM for extraction**: GPT-4o-mini via Vercel AI SDK with structured output (Zod)
- **Entity deduplication**: pgvector cosine similarity (0.85 threshold) + unique constraints
- **Graph traversal**: SQL joins with indexes (efficient for 1-2 hops)
- **Batch processing**: 5 chunks at a time (balance speed and rate limits)
- **Cost**: ~$0.23 per 200-page document, ~$0.0001 per search

### Files Created
- `supabase/migrations/20251016_graph_rag_schema.sql`
- `apps/web/lib/graph/entity-extraction.ts`
- `apps/web/lib/graph/graph-search.ts`
- `apps/web/app/api/graph/extract/route.ts`
- `docs/graph-rag.md`
- `GRAPH_RAG_IMPLEMENTATION.md`
- `test-graph-extract.sh`

---

## Phase 6: Hybrid Search & Query Interface

### Goals
- Combine vector search with graph traversal
- Implement keyword search for exact matches
- Add reranking for better results

### Tasks

#### 🔎 Hybrid Search Implementation
- [ ] Combine vector search + keyword search
- [ ] Implement BM25 for keyword search
- [ ] Merge and deduplicate results
- [ ] Weight different search methods
- [ ] Add graph-based context expansion

#### 🎯 Reranking
- [ ] Integrate reranking model (Cohere, cross-encoder)
- [ ] Rerank top-k results for relevance
- [ ] Consider user context and preferences
- [ ] Optimize for speed vs accuracy

#### 🎨 Search UI
- [ ] Create unified search interface
- [ ] Show results from multiple sources
- [ ] Display entity relationships
- [ ] Add filters (date, document type, status)
- [ ] Implement search history
- [ ] Add saved searches

#### 📈 Search Analytics
- [ ] Track search queries
- [ ] Monitor search performance
- [ ] Identify common queries
- [ ] Improve based on user behavior

### Phase 6 Enhancements

#### 🎯 HyDE Query Enhancement Tuning (Medium Priority)
**Goal:** Improve HyDE accuracy and reduce hallucination impact

**Current Behavior:**
- HyDE occasionally generates incorrect hypothetical documents (e.g., "SDA" as "Seventh-day Adventist" vs "Strategic Design Approaches")
- Multi-Query + Graph Search + Reranking compensate effectively
- Final results remain accurate (reranking buries bad HyDE results)
- Overall search time: ~14s for complex queries

**Proposed Improvements:**

1. **Lower HyDE Weight in RRF Scoring**
   - [ ] Reduce HyDE's influence in Reciprocal Rank Fusion
   - [ ] Give more weight to Multi-Query and Graph Search results
   - [ ] Prevents bad HyDE guesses from skewing initial rankings

2. **Add HyDE Validation**
   - [ ] Compare HyDE result against original query embedding
   - [ ] If similarity below threshold (e.g., 0.6), discard HyDE result
   - [ ] Only use HyDE when semantically aligned with query
   - [ ] Prevents hallucinated content from entering pipeline

3. **Make HyDE Optional by Query Type**
   - [ ] Use HyDE for broad conceptual queries
   - [ ] Skip HyDE for specific factual queries (names, dates, etc.)
   - [ ] Add query classification to determine when HyDE helps

**Benefits:**
- Reduced hallucination risk
- Faster search when HyDE is skipped
- More predictable search behavior
- Better resource utilization

**Files to Modify:**
- `apps/web/app/api/search/route.ts`

#### 🕸️ Graph Extractor Entity Quality Improvement (Medium Priority)
**Goal:** Higher quality knowledge graph with better entity extraction and relationship discovery

**Problems:**
1. LLM extracts relationships to abstract concepts that aren't entities (e.g., "stakeholder alignment", "effectiveness")
2. Abstract concepts aren't stored as entities (correctly)
3. Relationships to these concepts fail silently
4. LLM "wastes" extraction capacity on non-entities instead of finding real connections
5. Entity descriptions are often generic or hallucinated (not grounded in source text)
6. Abbreviations are expanded incorrectly or invented

**Lessons from Entity Description Enhancement Work:**
- **RAG-grounded prompts work**: Using search results to ground AI descriptions prevents hallucination
- **Explicit constraints matter**: "DO NOT expand abbreviations unless they appear in source" is critical
- **Chunk labeling helps**: Marking chunks as `[Chunk 1 - MOST RELEVANT]` guides AI to prioritize
- **Lower temperature helps**: 0.1 vs 0.2 reduces creative hallucination
- **Reranking is key**: Top reranked chunk is usually the best source of truth

**Proposed Solutions:**

1. **Improve Entity Extraction Prompt with RAG Grounding (Recommended)**
   - [ ] Use similar approach to entity description enhancement
   - [ ] For each potential entity, search "What is {entity_name}" in current chunk context
   - [ ] Only extract entities that have clear definitions in the source text
   - [ ] Add explicit rules:
     * "ONLY extract entities explicitly mentioned in the text"
     * "DO NOT invent or expand abbreviations"
     * "DO NOT extract abstract concepts like 'alignment', 'coordination', 'effectiveness'"
     * "PRIORITIZE concrete entities: methodologies, tools, frameworks, people, organizations"
   - [ ] Lower temperature to 0.1 for more deterministic extraction
   - [ ] Label source chunks clearly: `[Source Chunk]: "..."`

2. **Add Verification Step**
   - [ ] After extraction, verify each entity appears in source text
   - [ ] Check if entity name is substring of chunk content
   - [ ] Filter out entities that don't pass verification
   - [ ] Log filtered entities for prompt tuning

3. **Add Entity Type Validation**
   - [ ] Validate both entities exist before creating relationships
   - [ ] Skip relationship creation silently (or at DEBUG level)
   - [ ] Prevents warnings for expected behavior

4. **Post-Processing Filter**
   - [ ] Filter out relationships to known abstract concepts after extraction
   - [ ] Maintain list of common abstract terms to exclude
   - [ ] Quick fix but requires maintenance

**Specific Prompt Improvements:**
```python
# Add to extraction prompt
ENTITY EXTRACTION RULES - FOLLOW STRICTLY:
- ONLY extract entities that are explicitly mentioned in the source text below
- Use EXACT names as they appear in the text - do not modify or expand
- CRITICAL: If an abbreviation's full form does NOT appear in the text, keep it as an abbreviation
  * Example: If text says "WTPS" but never defines it, extract "WTPS" NOT "Workforce Training Planning System"
- DO NOT extract abstract concepts (alignment, coordination, effectiveness, etc.)
- DO extract concrete entities: specific methodologies, tools, frameworks, people, organizations, programs
- Provide descriptions using ONLY information from the source text
- When in doubt, DON'T extract - better to miss an entity than hallucinate one

SOURCE TEXT:
[Chunk]: "{chunk_content}"

Extract entities that appear in the source text above.
```

**Benefits:**
- Higher quality knowledge graph (focus on concrete, verified entities)
- Better relationship discovery (LLM extracts more real connections)
- Improved graph search (queries find relevant methodology connections)
- More precise entity clustering
- Accurate entity names (no hallucinated abbreviation expansions)
- Grounded descriptions (based on source text)
- Bonus: Cleaner logs

**Files to Modify:**
- `apps/backend/ingest/processors/graph_extractor.py`

**Estimated Effort:** 1-2 days (prompt refinement + verification step)

#### 🐛 PGMQ Queue State Corruption Fix (High Priority)
**Goal:** Prevent database restart requirement when deleting documents in error state

**Problem:**
- Deleting a document in error state corrupts the `document_processing` queue
- Queue cannot be purged using standard PGMQ commands
- Messages remain stuck in queue
- Only solution is database restart

**Root Cause:**
Race condition between:
1. Document deletion (CASCADE deletes chunks/embeddings)
2. Worker retrying the failed job
3. PGMQ message visibility timeout

**Proposed Solutions:**

1. **Immediate: Queue Cleanup on Document Deletion**
   - [ ] Before deleting document, archive/delete pending queue messages
   - [ ] Use `pgmq.archive()` or `pgmq.delete()` for document's job
   
2. **Short-term: Improve Error Handling**
   - [ ] Check if document exists before processing
   - [ ] If document not found, delete message immediately (don't retry)
   
3. **Long-term: Dead Letter Queue**
   - [ ] Move permanently failed messages to separate queue
   - [ ] Prevents main queue corruption
   - [ ] Allows manual inspection/cleanup

**Files to Modify:**
- `apps/backend/ingest/main.py` - Add document existence check
- `apps/web/app/api/documents/[id]/route.ts` - Clean queue on delete
- Database migration - Add dead letter queue table (optional)

#### 🌳 Hierarchical Graph Traversal (Medium-High Priority)
**Goal:** Dramatically improve context quality by combining graph relationships with document hierarchy

**Problem**: Graph search finds relevant entities and returns associated chunks, but treats all chunks as flat with no understanding of document structure or hierarchical relationships.

**Opportunity**: Docling's HybridChunker already creates hierarchical structure (document → section → subsection → paragraph), but we're not storing or leveraging this for retrieval.

**Proposed Solution**: Store hierarchy metadata and traverse the tree during retrieval

**Benefits**:
- **Contextual Zoom In/Out**: Start with detail, zoom to summaries, or vice versa
- **Related Details Discovery**: Find sibling chunks and child chunks automatically
- **Cross-Section Relationships**: Find common ancestors showing how concepts relate
- **40-60% improvement** in context relevance (estimated)

**Implementation**:

**Phase 1: Store Hierarchy (1-2 days)**
- [ ] Add columns to chunks table:
  - `level` INTEGER (0=doc, 1=section, 2=subsection, 3=paragraph)
  - `parent_id` UUID (references chunks.id)
  - `sibling_ids` UUID[]
  - `is_summary` BOOLEAN
  - `hierarchy_path` UUID[] (full path from root)
- [ ] Create indexes on parent_id and level
- [ ] Modify HybridChunker to track parent-child relationships
- [ ] Store hierarchy metadata during ingestion

**Phase 2: Traversal Functions (1 day)**
- [ ] Implement `getParentChunks(chunkId, levels)`
- [ ] Implement `getChildChunks(chunkId, levels)`
- [ ] Implement `getSiblingChunks(chunkId)`
- [ ] Implement `getHierarchyPath(chunkId)` (root to leaf)
- [ ] Test traversal performance with indexes

**Phase 3: Integrate with Graph Search (2-3 days)**
- [ ] Modify `graphEnhancedSearch` to use hierarchy
- [ ] For each chunk from graph search:
  - Traverse UP 2 levels for context
  - Traverse DOWN 1 level for details
  - Get siblings for related content
- [ ] Sort results by level (summaries first, then details)
- [ ] Update search API to return hierarchical context

**Phase 4: RAPTOR Clustering (Optional, 1 week)**
- [ ] Implement cross-document thematic clustering
- [ ] Create cluster summaries
- [ ] Integrate clusters with graph + hierarchy search

**Use Cases**:
1. **Broad Question → Zoom In**: "What is strategic planning?" → document summary → section summaries → paragraph details
2. **Specific Question → Zoom Out**: "What does page 42 say?" → specific chunk + section summary + document summary
3. **Relationship Questions**: "How does X relate to Y?" → find common ancestor showing shared context

**Cost Analysis**:
- Storage: ~20% increase (hierarchy metadata + summary chunks)
- Retrieval: Minimal overhead (indexed lookups)
- Quality: 40-60% improvement in context relevance
- User Experience: Significantly better for complex queries

**Files to Modify**:
- `supabase/migrations/` - Add hierarchy columns to chunks table
- `apps/backend/ingest/chunkers/hybrid_chunker.py` - Track relationships
- `apps/web/lib/graph/graph-search.ts` - Add hierarchy traversal
- `apps/web/app/api/search/route.ts` - Integrate with search

**Total Effort**: 4-5 days for Phases 1-3, optional 1 week for Phase 4

---

## Phase 6.5: RAG Answer Generation & Chat Interface

### Overview
Complete the RAG pipeline by connecting retrieved chunks to an LLM for answer generation. This is the critical missing piece that transforms search results into conversational answers.

### Goals
- Generate natural language answers from retrieved chunks
- Provide source attribution for transparency
- Stream responses for better UX
- Handle context window limits intelligently
- Support follow-up questions with conversation history

### Tasks

#### 🤖 LLM Integration
- [ ] Create answer generation service
- [ ] Integrate OpenAI API (GPT-4o or GPT-4o-mini)
- [ ] Implement streaming responses
- [ ] Add error handling and fallbacks
- [ ] Configure model settings (temperature, max_tokens)
- [ ] Add cost tracking and monitoring

#### 📝 Prompt Engineering
- [ ] Design system prompt for RAG context
- [ ] Create prompt template with retrieved chunks
- [ ] Add instructions for source citation
- [ ] Handle cases with no relevant results
- [ ] Optimize for accuracy vs conciseness
- [ ] Test with various query types

#### 💬 Chat Interface
- [ ] Install shadcn.io AI components (derived from Vercel AI Elements)
  - Documentation: https://www.shadcn.io/ai
  - Components: `<Message>`, `<Response>`, `<Tool>`, `<Reasoning>`, `<Sources>`, `<Branch>`, `<Conversation>`
  - Philosophy: Copy-paste components into codebase for full ownership
- [ ] Implement chat UI using shadcn.io AI components
  - `<Conversation>` container for chat interface
  - `<Message>` for user/assistant messages
  - `<Response>` for streaming text with markdown rendering
  - `<Sources>` for source chunk attribution
- [ ] Display streaming responses with typing indicator
- [ ] Add "Copy" and "Regenerate" buttons
- [ ] Implement conversation history
- [ ] Add "Clear conversation" action
- [ ] Customize components for Mosaic's specific needs

#### 🔗 Source Attribution
- [ ] Link each answer claim to source chunks
- [ ] Display chunk metadata (document, page, confidence)
- [ ] Enable click-through to full document
- [ ] Highlight relevant text in source chunks
- [ ] Show multiple sources when available
- [ ] Add "View all sources" expansion

#### 🧠 Context Management
- [ ] Implement context window management (8K-128K tokens)
- [ ] Prioritize most relevant chunks when over limit
- [ ] Use chunk summaries for context compression
- [ ] Add "Load more context" option for complex queries
- [ ] Track token usage per query
- [ ] Optimize chunk selection strategy

#### 💾 Conversation History
- [ ] Store conversation threads in database
- [ ] Associate conversations with users
- [ ] Enable conversation search and filtering
- [ ] Add conversation sharing (optional)
- [ ] Implement conversation export
- [ ] Add conversation deletion

#### 📊 Analytics & Monitoring
- [ ] Track answer quality metrics
- [ ] Monitor LLM costs per query
- [ ] Log failed generations
- [ ] Track average response time
- [ ] Measure user satisfaction (thumbs up/down)
- [ ] A/B test different prompts

### Implementation Phases

**Phase 6.5.1: Basic Answer Generation (✅ COMPLETED - Oct 19, 2025)**
- [x] Install and configure shadcn.io AI components
- [x] LLM integration with OpenAI (via AI Gateway)
- [x] Simple prompt template
- [x] Basic chat UI using AI components
- [x] Source attribution with `<Sources>` component
- [x] Streaming responses with markdown rendering

**Phase 6.5.2: Enhanced Context Management (2 days)**
- [ ] Smart context window management
- [ ] Chunk prioritization
- [ ] Context compression with summaries
- [ ] Multi-turn conversation support

**Phase 6.5.3: Conversation Features (2-3 days)**
- [ ] Conversation history storage
- [ ] Thread management UI
- [ ] Conversation search
- [ ] Export functionality

**Phase 6.5.4: Polish & Optimization (1-2 days)**
- [ ] Prompt optimization
- [ ] Cost optimization
- [ ] Analytics dashboard
- [ ] User feedback collection

### Technical Decisions

**LLM Selection:**
- **GPT-4o-mini**: Fast, cost-effective ($0.15/1M input, $0.60/1M output)
- **GPT-4o**: Higher quality for complex queries ($2.50/1M input, $10/1M output)
- **Strategy**: Start with GPT-4o-mini, upgrade to GPT-4o for specific use cases

**Context Strategy:**
- Retrieve top 10-20 chunks (semantic + graph + keyword)
- Rerank to top 5-10 most relevant
- Include chunk summaries for context
- Total context: ~4K-8K tokens (fits in most models)

**Streaming:**
- Use OpenAI streaming API
- Update UI incrementally as tokens arrive
- Show typing indicator during generation
- Handle connection errors gracefully

**Source Attribution:**
- Include chunk IDs in prompt
- Parse LLM response for citations
- Link citations to source chunks
- Display sources below answer

### Cost Estimates

**Per Query (GPT-4o-mini):**
- Input: ~5K tokens (chunks + prompt) = $0.00075
- Output: ~500 tokens (answer) = $0.0003
- **Total: ~$0.001 per query**

**At Scale:**
- 1,000 queries/day = $1/day = $30/month
- 10,000 queries/day = $10/day = $300/month

**Optimization Strategies:**
- Cache common queries
- Use chunk summaries to reduce input tokens
- Implement query deduplication
- Set max_tokens limits

### Files to Create/Modify

**Backend:**
- `apps/web/lib/llm/answer-generator.ts` - Core answer generation
- `apps/web/app/api/chat/route.ts` - Chat API endpoint
- `apps/web/app/api/chat/stream/route.ts` - Streaming endpoint

**Frontend:**
- `apps/web/components/ai/` - shadcn.io AI components (copy-pasted)
  - `message.tsx` - Message container component
  - `response.tsx` - Streaming response component
  - `sources.tsx` - Source attribution component
  - `conversation.tsx` - Conversation container
- `apps/web/app/(app)/chat/page.tsx` - Chat page using AI components

**Database:**
- `supabase/migrations/YYYYMMDD_create_conversations.sql` - Conversation storage
- `supabase/migrations/YYYYMMDD_create_messages.sql` - Message storage

### Success Criteria

- [ ] Users can ask questions and get accurate answers
- [ ] Answers include source citations
- [ ] Response time < 5 seconds for most queries
- [ ] Cost per query < $0.002
- [ ] User satisfaction > 80% (thumbs up)
- [ ] Answers are grounded in retrieved chunks (no hallucination)

### Priority
**High** - This is the core RAG functionality. Without it, we're just a search engine, not a RAG system.

**Estimated Effort:** 7-10 days total (1.5-2 weeks)

### Phase 6.5 Enhancements

#### 🎚️ Adaptive Response Depth & Retrieval Matching (Medium-High Priority)

**Goal:** Allow users to control response depth and match retrieval strategy to query complexity for better UX and cost optimization.

**Problem:** Currently all queries use the same retrieval and generation approach regardless of whether the user wants a quick answer or comprehensive analysis. This creates unnecessary cost and latency for simple queries while potentially under-serving complex research needs.

**Solution: User-Controlled Response Depth**

**Quick Mode (30 seconds, ~$0.001)**
- Retrieval: Top 3-5 chunks, basic semantic search only
- Generation: Short response (100-200 tokens) with GPT-4o-mini
- Use case: "What is X?", "When did Y happen?"

**Standard Mode (1-2 minutes, ~$0.005)** - Default
- Retrieval: Top 10-15 chunks, hybrid search + reranking
- Generation: Medium response (300-500 tokens) with GPT-4o-mini
- Use case: Most queries

**Detailed Mode (2-5 minutes, ~$0.02)**
- Retrieval: Top 20-30 chunks, full hybrid + graph traversal
- Generation: Long response (800-1200 tokens) with GPT-4o
- Use case: "Explain the relationship between X and Y"

**Implementation Tasks:**
- [ ] Add response depth selector to chat UI (toggle or dropdown)
- [ ] Implement retrieval strategy routing based on depth
- [ ] Configure model selection per depth level
- [ ] Add cost/time estimates before query execution
- [ ] Track usage metrics by depth level
- [ ] Optimize chunk selection for each depth

**Benefits:**
- Faster responses for simple queries
- Cost optimization (match retrieval to need)
- Better UX (users control depth vs speed tradeoff)
- Clear cost transparency

**Estimated Effort:** 3-5 days

#### 🌐 Vercel AI Gateway Integration (Medium-High Priority)

**Goal:** Implement Vercel AI Gateway for unified model access, automatic failover, and better cost monitoring.

**Problem:** Currently using direct OpenAI API calls. If OpenAI has an outage, the entire system fails. Managing multiple provider API keys and tracking costs across providers is complex.

**Solution: Vercel AI Gateway**

**Key Benefits:**
- **Unified API**: Access all models (OpenAI, Anthropic, xAI, Groq, DeepSeek) through single endpoint
- **Automatic Failover**: Falls back to alternative providers during outages
- **Cost Monitoring**: Unified billing and spend tracking dashboard
- **Simplified Keys**: One API key instead of managing multiple provider keys
- **Easy Model Switching**: Change models without code changes

**Implementation Tasks:**
- [ ] Sign up for Vercel AI Gateway
- [ ] Update AI SDK configuration to use gateway endpoint
- [ ] Configure fallback providers (e.g., GPT-4o → Claude Sonnet 4 → Gemini 2.5 Pro)
- [ ] Set budget limits and alerts
- [ ] Update environment variables (single AI_GATEWAY_API_KEY)
- [ ] Test failover behavior
- [ ] Update cost tracking to use gateway metrics
- [ ] Document model selection strategy

**Code Changes Required:**
```typescript
// Before:
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o-mini');

// After (minimal change):
import { createOpenAI } from '@ai-sdk/openai';
const gateway = createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY,
});
const model = gateway('gpt-4o-mini');
```

**Fallback Configuration:**
- Primary: GPT-4o-mini (fast, cost-effective)
- Fallback 1: Claude 3.7 Sonnet (similar quality)
- Fallback 2: Gemini 2.5 Flash Lite (backup option)

**Benefits:**
- Higher uptime and reliability (automatic failover)
- Better cost visibility (unified dashboard)
- Easier to experiment with different models
- Simplified configuration management
- Production-ready resilience

**Estimated Effort:** 1-2 hours

**Priority:** Medium-High (implement before Phase 6.5 goes to production)

#### 🔬 Deep Research Mode (Medium Priority)

**Goal:** Enable multi-page research documents with CrewAI agents and o4-mini-deep-research for complex analysis.

**Features:**

**Pre-Query Clarification:**
- Ask clarifying questions upfront
- "What aspects are most important?"
- "What's your intended use?"
- "Any specific time period or context?"

**Multi-Agent Research Crew:**
- **Research Agent**: Gathers all relevant information
- **Analysis Agent**: Synthesizes findings and patterns
- **Critique Agent**: Identifies gaps and contradictions
- **Writing Agent**: Produces structured document

**Deep Reasoning with o4-mini-deep-research:**
- Cross-document synthesis
- Contradiction resolution
- Causal relationship analysis
- Strategic recommendations

**Output Format:**
- Executive summary
- Detailed findings by topic
- Source citations throughout
- Methodology notes
- Confidence levels for claims

**Implementation Tasks:**
- [ ] Design clarification question flow
- [ ] Integrate CrewAI framework
- [ ] Configure o4-mini-deep-research model
- [ ] Build multi-agent research crew
- [ ] Create structured output templates
- [ ] Add progress tracking UI
- [ ] Implement long-running job queue

**Estimated Effort:** 2-3 weeks

---

## Phase 7: Document Details & Management

### Goals
- Create detailed document view page
- Enable document inspection and debugging
- Provide access to chunks and metadata
- Support future embeddings and graph visualization

### Phase 7.1: Core Overview + Metadata + Download ✅ COMPLETE

#### 📄 Document Details Page (`/documents/[id]`)
- [x] Create dynamic route for document details
- [x] Implement document details page layout
- [x] Add breadcrumb navigation (Documents → [Document Name])

#### 📊 Core Overview Section
- [x] Display document header
  - File name, upload timestamp, owner
  - Current status with badge (uploaded/processing/ready/error)
- [x] Show quick stats cards
  - File size
  - Total chunk count, total tokens
  - Last processed timestamp

#### 🗂️ Metadata & Context Section
- [x] Display source metadata
  - Storage path, MIME type
  - File size
- [x] Show error information
  - Error message display
  - Retry count tracking

#### 📥 Original Asset Access
- [x] Add download button
  - Generate signed URL from Supabase Storage
  - Direct download of original file

### Phase 7.2: Chunks Table + Search + Drilldown ✅ COMPLETE

#### ✂️ Chunks Section
- [x] Create chunks table/list view
  - Chunk index, text preview (first 100 chars)
  - Token count
  - Created timestamp
- [x] Add chunk search/filter
  - Search within chunks
  - Filter by token count range
- [x] Implement chunk drilldown
  - Side panel or modal for full chunk text
  - Display chunk metadata
  - Show chunk index and token count
- [x] Support large documents (10,000+ chunks)

### Phase 7.3: Processing Timeline + Action Bar (Planned)

#### 🗂️ Processing Timeline
- [ ] Show processing timeline
  - Ordered log of status transitions
  - Timestamps for each state change
  - Helpful for debugging ingestion issues

#### ⚡ Action Bar
- [ ] Add action buttons
  - Reprocess document (requeue)
  - Delete document (with confirmation)
  - Download original file (already implemented)
  - Copy shareable link (future)
- [ ] Add debug tools
  - View worker logs filtered to this document
  - Requeue for processing
  - View raw metadata JSON

### Phase 7.4: Future-Ready Sections (Placeholders)
- [ ] Embeddings status section
  - Show if embeddings generated
  - Display embedding model used
  - Link to vector visualization (future)
- [ ] Knowledge graph section
  - Display entities extracted from document
  - Show relationships tied to this document
  - Link to graph view (Phase 5)
- [ ] Audit log section
  - Track delete/restore events
  - Show reprocess history
  - Compliance and debugging

### Technical Implementation

#### Data Fetching
```typescript
// Server component for initial data
async function DocumentDetailsPage({ params }: { params: { id: string } }) {
  const document = await getDocument(params.id);
  const chunks = await getDocumentChunks(params.id);
  const timeline = await getProcessingTimeline(params.id);
  
  return <DocumentDetailsView document={document} chunks={chunks} timeline={timeline} />;
}
```

#### Component Structure
```
/documents/[id]/
├── page.tsx                    # Server component (data fetching)
├── components/
│   ├── document-header.tsx     # Title, status, stats
│   ├── metadata-section.tsx    # Source info, timeline
│   ├── chunks-table.tsx        # Chunk list with search
│   ├── chunk-detail-panel.tsx  # Full chunk view
│   ├── action-bar.tsx          # Buttons and actions
│   └── processing-timeline.tsx # Status history
```

#### Database Queries
```sql
-- Get document with stats
SELECT 
  d.*,
  COUNT(c.id) as chunk_count,
  SUM(c.token_count) as total_tokens
FROM documents d
LEFT JOIN chunks c ON c.document_id = d.id
WHERE d.id = $1
GROUP BY d.id;

-- Get chunks for document
SELECT id, chunk_index, content, token_count, metadata
FROM chunks
WHERE document_id = $1
ORDER BY chunk_index;

-- Get processing timeline (future: add status_history table)
SELECT status, created_at, updated_at
FROM documents
WHERE id = $1;
```

### UI/UX Considerations
- **Progressive disclosure**: Start with overview, expand for details
- **Performance**: Paginate chunks if document has >100 chunks
- **Mobile responsive**: Stack sections vertically on mobile
- **Loading states**: Show skeletons while fetching data
- **Error states**: Handle missing documents gracefully

### Implementation Status
1. **Phase 7.1**: Core overview + metadata + download ✅ COMPLETE
2. **Phase 7.2**: Chunks table + search + drilldown ✅ COMPLETE
3. **Phase 7.3**: Processing timeline + action bar (Planned)
4. **Phase 7.4**: Embeddings section (after Phase 4)
5. **Phase 7.5**: Knowledge graph section (after Phase 5)

---

## Phase 7.3: Shared Corpus & Access Control ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Public/private documents, RLS policies for shared access

### Goals (Summary)
- Enable admin users to share documents across organization
- Implement public/private document controls
- Support bulk operations for sharing

### Completed Tasks

#### 🌍 Public/Private Documents
- [x] Add `is_admin` flag to profiles table
- [x] Add `is_public` flag to documents table
- [x] Update RLS policies for public document access
- [x] Admin-only permissions for making documents public
- [x] Helper function `is_admin()` for policy checks

#### 🎨 Frontend Controls
- [x] `useIsAdmin()` hook to check admin status
- [x] Document list: Globe icon for public docs
- [x] Document list: Public/Private toggle in dropdown (admin only)
- [x] Document details: Public/Private button in header (admin only)
- [x] Bulk actions: "Make Public" and "Make Private" buttons
- [x] Toast notifications for status changes

#### 🔒 Security
- [x] Only admins can toggle public status
- [x] Regular users can view public docs but not modify them
- [x] Chunks from public docs accessible to all users
- [x] RLS enforced at database level

### Use Cases
- **Intelligence Platform**: Share industry reports, competitor analysis
- **Research Team**: Share published papers, shared datasets
- **Enterprise**: Share company policies, onboarding docs

---

## Phase 7.4: Error Tracking & Retry Logic ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Error tracking, retry logic (max 3 retries), error display in UI

### Goals (Summary)
- Track processing failures with detailed error messages
- Implement retry limits to prevent infinite loops
- Surface error information to users

### Completed Tasks

#### 📊 Error Tracking
- [x] Add `error_message` column to documents table
- [x] Add `retry_count` column to track attempts
- [x] Add `last_error_at` timestamp
- [x] Worker updates error details on each failure

#### 🔁 Retry Logic
- [x] Max 3 automatic retries (configurable via MAX_RETRIES)
- [x] pgmq's `read_ct` field tracks retry attempts
- [x] Jobs deleted from queue after max retries
- [x] Attempt number shown in logs: "Error (attempt 2/3)"

#### 🎨 Frontend Display
- [x] Error badge shows retry count: "Error (2/3)"
- [x] Hover tooltip shows full error message
- [x] Document type includes error tracking fields

### Future Enhancement
- [ ] Manual retry button (creates new job with fresh retry count)

---

## Phase 7.5: Document Management Actions

### Goals
- Provide advanced lifecycle actions beyond delete
- Maintain data integrity across chunks/embeddings/graph
- Enable bulk operations with auditability

### Tasks

#### 🔁 Manual Retry
- [ ] Add "Retry" button for failed documents
- [ ] Creates new job with fresh retry count
- [ ] Resets document status to 'uploaded'
- [ ] Works independently of automatic retries

#### 🗄️ Archive & Restore
- [ ] Add `archived` boolean + `archived_at` timestamp to `documents` table
- [ ] Exclude archived docs from default queries and search
- [ ] Add "Archive" / "Restore" UI actions in document list and details
- [ ] Visual indicator for archived documents (grayed out, archive icon)

#### 🔁 Reprocess Document
- [ ] Add "Reprocess" action to document dropdown
- [ ] Confirmation dialog explaining data deletion
- [ ] Delete existing chunks, embeddings, entities, relationships
- [ ] Re-download file from storage
- [ ] Re-run full processing pipeline
- [ ] Maintain document ID and metadata (created_at, user_id)
- [ ] Update `updated_at` timestamp
- [ ] Handle edge cases (missing file, changed settings)

#### 📝 Replace File
- [ ] Add "Replace" action with file upload dialog
- [ ] Upload new file to storage
- [ ] Delete old file from storage
- [ ] Clean up all derived data
- [ ] Update document metadata (file_size, file_type, file_path)
- [ ] Optional: Track version history in `document_versions` table
- [ ] Rollback mechanism if replacement fails

#### 📄 Duplicate Document
- [ ] Add "Duplicate" action to dropdown
- [ ] Option: "Copy as-is" (fast) or "Reprocess with settings" (flexible)
- [ ] Create new document record with new ID
- [ ] Copy or reference file in storage
- [ ] Append "(Copy)" to file_name
- [ ] Navigate to new document after duplication

#### 📦 Batch Operations
- [ ] Extend bulk delete to support other actions
- [ ] Multi-select with action dropdown (Archive, Reprocess, Delete)
- [ ] Progress modal: "Processing 5 of 10 documents..."
- [ ] Summary of results: "8 succeeded, 2 failed"
- [ ] Ability to cancel in-progress batch operation
- [ ] Queue-based processing with rate limiting

#### 📊 Processing Audit Log
- [ ] Create `document_processing_log` table
- [ ] Track actions: upload, reprocess, replace, archive
- [ ] Store status: started, completed, failed
- [ ] Record error messages and performer
- [ ] Display processing history in document details

### Database Schema
```sql
-- Archive support
ALTER TABLE documents ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN archived_at TIMESTAMPTZ;

-- Version tracking (optional)
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  replaced_at TIMESTAMPTZ DEFAULT NOW(),
  replaced_by UUID REFERENCES auth.users(id)
);

-- Audit log
CREATE TABLE document_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Priority
- **High Priority**: Archive/Unarchive, Processing Log
- **Medium Priority**: Reprocess, Batch Operations
- **Lower Priority**: Replace (with versioning), Duplicate

---

## Phase 11: Collaborative Annotations & Comments

### Goals
- Enable inline discussions on document chunks
- Support @mentions, threading, and status tracking
- Integrate with search, graph, and analytics

### Tasks

#### ✍️ Core Annotation System
- [ ] Create `annotations` table (chunk-based anchoring)
- [ ] Text selection with character offsets
- [ ] Comment creation with rich text editor
- [ ] Threading support (parent_annotation_id, thread_position)
- [ ] Status management (open, resolved, archived)
- [ ] RLS policies for access control

#### 👥 Collaboration Features
- [ ] @mention functionality with autocomplete
- [ ] Create `annotation_mentions` table
- [ ] User notifications (email + in-app)
- [ ] Reply to existing annotations
- [ ] Show reply count and collapse/expand threads

#### 🔔 Realtime Collaboration
- [ ] Supabase Realtime channels for annotations
- [ ] Live updates when new comments added
- [ ] Presence indicators (who's viewing)
- [ ] Typing indicators for replies
- [ ] Toast notifications for @mentions

#### 🎨 UI Components
- [ ] Inline highlights for annotated text
- [ ] Annotation sidebar with filters
- [ ] Comment cards with user avatars
- [ ] Jump to chunk when clicking comment
- [ ] Annotation count badges

#### 🔐 Permissions & Sharing
- [ ] Create `document_collaborators` table
- [ ] Permission levels: view, comment, edit
- [ ] Invite users to collaborate
- [ ] RLS policies for annotations

#### 📚 Integration
- [ ] Link annotations to entities (Phase 5)
- [ ] Include annotations in search index (Phase 4)
- [ ] Export comments to PDF/CSV
- [ ] Annotation analytics dashboard

### Database Schema
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  selected_text TEXT NOT NULL,
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  comment_text TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  parent_annotation_id UUID REFERENCES annotations(id),
  thread_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE annotation_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
  mentioned_user_id UUID REFERENCES auth.users(id),
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  permission_level TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementation Phases
1. **Phase 11.1**: Basic annotations (text selection, simple comments)
2. **Phase 11.2**: Collaboration (@mentions, threading, notifications)
3. **Phase 11.3**: Advanced features (realtime, rich text, presence)
4. **Phase 11.4**: Polish (search, export, analytics)

---

## Phase 12: Polish & Production Readiness

### Goals
- Improve user experience
- Add missing features
- Prepare for production deployment

### Tasks

#### 🎨 UX Improvements
- [x] Add multiple file upload support
- [x] Implement drag-and-drop for multiple files
- [x] Show upload queue with progress for each file
- [ ] Add document sharing capabilities

#### 🔧 Error Handling & Reliability
- [ ] Implement retry logic for failed jobs
- [ ] Add dead letter queue for failed processing
- [ ] Improve error messages
- [ ] Add error recovery flows
- [ ] Implement graceful degradation

#### 📊 Monitoring & Logging
- [ ] Setup application monitoring (Sentry, LogRocket)
- [ ] Add performance tracking
- [ ] Monitor queue health
- [ ] Track processing times
- [ ] Alert on failures

#### 🚀 Performance Optimization
- [ ] Optimize database queries
- [ ] Add caching layers
- [ ] Implement pagination for large result sets
- [ ] Optimize bundle size
- [ ] Add service worker for offline support

#### 🎁 Optional Enhancements
- [ ] Upgrade to Uppy for better upload UX
- [ ] Add collaborative features (comments, annotations)
- [ ] Implement document versioning
- [ ] Add export functionality (PDF, CSV)
- [ ] Create mobile-responsive views

#### 🎨 Kibo UI Component Library Evaluation (Low-Medium Priority)

**Goal:** Evaluate and potentially migrate to Kibo UI for improved component quality and developer experience.

**Context:** Mosaic currently uses shadcn/ui components. Kibo UI is a curated collection of enhanced shadcn components with better defaults, improved accessibility, and additional features.

**What is Kibo UI:**
- Built on top of shadcn/ui (same foundation we're using)
- Enhanced components with better defaults
- Improved accessibility and keyboard navigation
- More polished animations and interactions
- Additional component variants and compositions
- Documentation: https://www.kibo-ui.com/docs/setup

**Potential Benefits:**
- Better UX with more polished components out of the box
- Faster development with pre-built component compositions
- Enhanced ARIA support and keyboard navigation
- Better design system cohesion
- Less custom component code to maintain

**Evaluation Tasks:**
- [ ] Audit current shadcn components in use
- [ ] Compare Kibo versions of same components
- [ ] Build prototype test page with Kibo components
- [ ] Measure bundle size impact
- [ ] Test performance (runtime and build time)
- [ ] Verify customization flexibility
- [ ] Check for breaking changes with existing components

**Decision Criteria:**
1. Does it provide meaningful improvements over current shadcn?
2. Is the bundle size increase acceptable?
3. Does it maintain or improve accessibility?
4. Can we easily customize for Mosaic's needs?
5. Is documentation clear and comprehensive?

**Estimated Effort:**
- Evaluation: 1-2 days
- Migration (if approved): 3-5 days

---

## Phase 13: Platform Migration & Enterprise Scaling

### Overview
Strategic plan for migrating from Render to enterprise-grade infrastructure when scaling demands it. This phase is triggered by growth milestones, not time-based.

### Migration Triggers (When to Execute)

**Trigger 1: Revenue Threshold**
- Monthly Recurring Revenue (MRR) > $5-10K
- Infrastructure costs justify migration investment

**Trigger 2: Scale Constraints**
- Processing > 1000 documents/day consistently
- Queue depth consistently > 20
- Multiple worker crashes per week

**Trigger 3: Customer Requirements**
- Enterprise customers demanding SLAs (99.9% uptime)
- Need for auto-scaling
- Compliance requirements (SOC2, HIPAA)

**Trigger 4: Cost Efficiency**
- Render costs > $300/mo
- Cloud platform would be cheaper at current scale

### Current Architecture (Render-based)

```
Frontend: Vercel (Next.js)
    ↓
Database: Supabase (Postgres + Storage + Auth)
    ↓
Queue: pgmq (Postgres-based)
    ↓
Workers: Render Background Workers (Docker)
    - 1-5 workers @ $25-125/mo
    - Manual scaling
    - 2GB /tmp limit
    - Basic monitoring
```

**Limitations:**
- ❌ No auto-scaling
- ❌ Fixed /tmp disk (2GB all plans)
- ❌ Manual worker management
- ❌ Limited observability
- ❌ No SLA guarantees (lower tiers)

### Target Architecture (Enterprise)

```
Frontend: Vercel (Next.js) [No change]
    ↓
Database: Supabase (Postgres + Storage + Auth) [No change]
    ↓
Queue: Hatchet (Postgres or RabbitMQ-based)
    - Workflow orchestration
    - Built-in monitoring GUI
    - Retry management
    - Rate limiting per tenant
    ↓
Workers: AWS ECS Fargate or GCP Cloud Run
    - Auto-scaling (1-50 workers)
    - No /tmp limits
    - Full observability
    - 99.9% SLA
```

**Benefits:**
- ✅ Auto-scaling based on queue depth
- ✅ Better cost efficiency at scale
- ✅ Full monitoring & tracing
- ✅ Enterprise SLAs
- ✅ No infrastructure limitations

### Migration Strategy

#### Phase 10.1: Preparation (Pre-Migration)

**1. Abstract Queue Interface**
```python
# Create queue abstraction layer
class QueueInterface:
    def enqueue(self, job): pass
    def dequeue(self): pass
    def delete(self, job_id): pass

# Implementations:
- PgmqQueue (current)
- HatchetQueue (future)
- SqsQueue (AWS option)
```

**2. Add Comprehensive Monitoring**
```python
# Track metrics for migration planning
- Queue depth over time
- Processing time per document
- Memory usage patterns
- Success/failure rates
- Worker health
- Cost per document processed

# Tools: Sentry, DataDog, or custom Postgres logging
```

**3. Document Everything**
- Architecture diagrams
- Deployment procedures
- Configuration management
- Environment variables
- Dependencies

**4. Implement Feature Flags**
```typescript
// Easy rollback if migration issues
const USE_NEW_QUEUE = process.env.FEATURE_NEW_QUEUE === 'true'
```

#### Phase 10.2: Hatchet Integration (Can Do on Render First)

**1. Deploy Hatchet**
```yaml
# Option A: Hatchet with Postgres (simpler)
services:
  hatchet-engine:
    environment:
      SERVER_MSGQUEUE_KIND: postgres
      DATABASE_URL: $SUPABASE_URL

# Option B: Hatchet with RabbitMQ (faster)
services:
  rabbitmq:
    image: rabbitmq:3-management
  hatchet-engine:
    environment:
      SERVER_MSGQUEUE_RABBITMQ_URL: amqp://rabbitmq:5672/
```

**2. Rewrite Worker for Hatchet**
```python
from hatchet_sdk import Hatchet

hatchet = Hatchet()

@hatchet.workflow()
class DocumentProcessing:
    @hatchet.step()
    def download_file(self, context):
        # Download from Supabase
        return {"file_data": file_data}
    
    @hatchet.step()
    def extract_text(self, context):
        # Unstructured processing
        return {"elements": elements}
    
    @hatchet.step()
    def chunk_text(self, context):
        # Chunking
        return {"chunks": chunks}
    
    @hatchet.step()
    def generate_embeddings(self, context):
        # OpenAI embeddings
        return {"embeddings": embeddings}
    
    @hatchet.step()
    def extract_graph(self, context):
        # Entity/relationship extraction
        return {"entities": entities}
    
    @hatchet.step()
    def store_results(self, context):
        # Save to database
        return {"success": True}
```

**3. Parallel Run (Dual Queue)**
```
- Keep pgmq running (primary)
- Run Hatchet in parallel (testing)
- Compare results, performance, reliability
- Gradual cutover (10% → 50% → 100%)
```

**Benefits of Hatchet:**
- ✅ Can deploy on Render initially
- ✅ Get monitoring/observability immediately
- ✅ Easier to migrate workers later
- ✅ Workflow orchestration for multi-step processing

#### Phase 10.3: Worker Migration to Cloud

**Option A: AWS ECS Fargate**

```yaml
# ECS Task Definition
{
  "family": "mosaic-worker",
  "containerDefinitions": [{
    "name": "worker",
    "image": "your-registry/mosaic-worker:latest",
    "memory": 2048,
    "cpu": 1024,
    "environment": [
      {"name": "DATABASE_URL", "value": "$SUPABASE_URL"},
      {"name": "HATCHET_URL", "value": "$HATCHET_URL"}
    ]
  }]
}

# Auto-scaling
- Min workers: 1
- Max workers: 20
- Scale up: Queue depth > 10
- Scale down: Queue depth < 2
```

**Cost:** ~$0.04/hour per worker = $30/mo for 1 worker running 24/7
- But scales to 0 during off-hours!
- Actual cost: $50-200/mo depending on usage

**Option B: GCP Cloud Run**

```yaml
# Cloud Run Service
service: mosaic-worker
image: gcr.io/project/mosaic-worker
resources:
  limits:
    memory: 2Gi
    cpu: 1
scaling:
  minInstances: 0  # Scale to zero!
  maxInstances: 20
```

**Cost:** Pay per request + compute time
- Idle: $0/mo (scales to zero)
- Active: ~$0.05/hour per worker
- Actual cost: $30-150/mo depending on usage

**Option C: Kubernetes (Advanced)**
- Full control, most complex
- Best for very high scale (1000+ docs/day)
- Cost: $100-500/mo

#### Phase 10.4: Monitoring & Observability

**1. Distributed Tracing**
```python
# OpenTelemetry integration
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("process_document"):
    # Track entire workflow
    with tracer.start_as_current_span("download"):
        download_file()
    with tracer.start_as_current_span("extract"):
        extract_text()
```

**2. Metrics Dashboard**
```
- Queue depth (real-time)
- Processing time (p50, p95, p99)
- Success/failure rates
- Worker health
- Cost per document
- Throughput (docs/hour)
```

**3. Alerting**
```
- Queue depth > 50 for 10 minutes
- Worker failure rate > 5%
- Processing time > 5 minutes
- Memory usage > 90%
```

**Tools:**
- DataDog ($15-50/mo)
- New Relic ($25-100/mo)
- Sentry ($26/mo)
- Grafana + Prometheus (self-hosted, free)

### Migration Timeline

**Week 1-2: Preparation**
- Abstract queue interface
- Add monitoring
- Document architecture
- Load test current system

**Week 3-4: Hatchet Integration**
- Deploy Hatchet (on Render)
- Rewrite worker for Hatchet
- Parallel run with pgmq
- Verify functionality

**Week 5-6: Cloud Migration**
- Setup AWS/GCP account
- Deploy workers to cloud
- Configure auto-scaling
- Cutover traffic (10% → 100%)

**Week 7-8: Optimization**
- Fine-tune auto-scaling
- Optimize costs
- Setup monitoring/alerting
- Document new architecture

**Total:** 6-8 weeks part-time

### Cost Comparison

**Current (Render):**
```
1 worker:  $25/mo
3 workers: $75/mo
5 workers: $125/mo
```

**After Migration (AWS ECS):**
```
Low traffic:    $30-50/mo (1-2 workers avg)
Medium traffic: $100-150/mo (3-5 workers avg)
High traffic:   $200-300/mo (5-10 workers avg)
Peak handling:  Auto-scales to 20+ workers
```

**Break-even:** ~3-5 workers constant = $75-125/mo

**Savings at scale:** 
- 10 workers on Render: $250/mo
- 10 workers on AWS (avg): $150/mo
- Savings: $100/mo + better reliability

### Rollback Plan

**If migration fails:**
1. Keep Render workers running during migration
2. Feature flag to switch back to pgmq
3. DNS/routing can revert instantly
4. No data loss (Supabase unchanged)
5. Maximum downtime: < 5 minutes

### Success Criteria

**Migration is successful when:**
- ✅ 99.9% uptime for 1 month
- ✅ Auto-scaling working (scales up/down correctly)
- ✅ Cost per document < Render baseline
- ✅ Processing time same or better
- ✅ Zero data loss
- ✅ Monitoring/alerting operational
- ✅ Team comfortable with new platform

### Future Enhancements (Post-Migration)

**Multi-Region Deployment**
- Deploy workers in multiple regions
- Route to nearest worker
- Disaster recovery

**Advanced Auto-Scaling**
- Predictive scaling (ML-based)
- Time-of-day patterns
- Customer-specific scaling

**Cost Optimization**
- Spot instances (AWS) for 70% savings
- Preemptible VMs (GCP) for 80% savings
- Reserved capacity for baseline

**Enterprise Features**
- Multi-tenancy isolation
- Per-customer rate limiting
- Priority queues (VIP customers)
- SLA monitoring & reporting

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **State Management**: React hooks + Supabase Realtime
- **Icons**: Lucide React

### Backend
- **Database**: Supabase (Postgres 17)
- **Storage**: Supabase Storage
- **Queue**: pgmq (Postgres Message Queue)
- **Functions**: Supabase Edge Functions (Deno)
- **Cron**: pg_cron
- **Auth**: Supabase Auth

### AI/ML
- **Document Processing**: Unstructured.io OSS or Docling
- **Embeddings**: OpenAI text-embedding-3-small
- **LLM**: GPT-4 or Claude (entity/relationship extraction)
- **Vector Search**: pgvector (HNSW index)
- **Reranking**: Cohere or cross-encoder

### DevOps
- **Hosting**: Vercel (frontend) + Supabase (backend)
- **Version Control**: Git
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry, Supabase Dashboard

---

## Development Guidelines

### Code Organization
```
mosaic/
├── apps/web/                    # Next.js application
│   ├── app/
│   │   ├── (app)/              # Authenticated routes
│   │   │   ├── documents/      # Document management
│   │   │   ├── search/         # Search interface
│   │   │   └── graph/          # Graph visualization
│   │   └── auth/               # Authentication pages
│   ├── components/             # React components
│   ├── lib/                    # Utilities
│   └── public/                 # Static assets
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations
└── docs/                       # Documentation
```

### Best Practices
1. **Always use RLS**: Every table must have Row Level Security enabled
2. **Type safety**: Use TypeScript for all code
3. **Error handling**: Always handle errors gracefully
4. **Testing**: Write tests for critical paths
5. **Documentation**: Document complex logic and decisions
6. **Performance**: Monitor and optimize slow queries
7. **Security**: Never expose service role keys client-side

### Git Workflow
1. Create feature branch from `main`
2. Make changes and commit frequently
3. Test locally before pushing
4. Create PR with description
5. Review and merge to `main`
6. Deploy to production

---

## Deployment Strategy

### Environments
- **Development**: Local (localhost:3000)
- **Staging**: Vercel preview deployments
- **Production**: Vercel + Supabase Pro

### Deployment Checklist
- [ ] Run database migrations
- [ ] Deploy Edge Functions
- [ ] Update environment variables
- [ ] Test critical paths
- [ ] Monitor for errors
- [ ] Verify queue processing
- [ ] Check performance metrics

---

## Cost Estimates (Monthly)

### Free Tier (Development)
- Supabase: $0
- Vercel: $0
- OpenAI: ~$5-10 (testing)
- **Total**: ~$5-10/month

### Production (Small Scale)
- Supabase Pro: $25
- Vercel Pro: $20
- OpenAI Embeddings: ~$20-50
- OpenAI LLM: ~$50-100
- **Total**: ~$115-195/month

### Production (Medium Scale)
- Supabase Pro: $25
- Vercel Pro: $20
- OpenAI Embeddings: ~$100-200
- OpenAI LLM: ~$200-500
- Monitoring: ~$30
- **Total**: ~$375-775/month

---

## Success Metrics

### User Engagement
- Documents uploaded per user
- Search queries per user
- Time spent in application
- Return rate

### System Performance
- Upload success rate > 99%
- Processing time < 5 minutes per document
- Search latency < 500ms
- Queue processing rate > 10 docs/minute

### Quality Metrics
- Search relevance (user feedback)
- Entity extraction accuracy
- Relationship extraction accuracy
- User satisfaction score

---

## Risks & Mitigations

### Technical Risks
1. **API Rate Limits**: Implement batching and caching
2. **Processing Failures**: Add retry logic and dead letter queue
3. **Slow Queries**: Optimize indexes and add caching
4. **Storage Costs**: Implement file size limits and cleanup policies

### Business Risks
1. **API Costs**: Monitor usage and set budgets
2. **Scalability**: Plan for horizontal scaling
3. **Data Privacy**: Implement proper RLS and encryption
4. **Vendor Lock-in**: Use standard APIs where possible

---

## Phase 8: Settings Management System ✅ COMPLETE
**Moved to COMPLETED_ITEMS.md:** October 19, 2025  
Database-driven configuration, SettingsService with 60s cache, comprehensive test suite

### Goals (Summary)
- Move configuration from hardcoded ENV vars to database
- Enable real-time settings changes without deployments
- Provide admin UI for system configuration
- Add infrastructure-aware recommendations

### Completed Tasks

#### ⚙️ Settings Service
- [x] Create `SettingsService` class with 60-second TTL cache
- [x] Type-safe getters: `get_bool()`, `get_int()`, `get_float()`, `get_string()`
- [x] Automatic fallback to ENV variables if DB unavailable
- [x] Cache refresh on stale reads (60s TTL)

#### 🔌 Backend Integration
- [x] Update `main.py` to use SettingsService instead of ENV vars
- [x] Update DoclingProcessor to read VLM model from settings
- [x] Update HybridChunker to read summary model/workers from settings
- [x] Update GraphExtractor to read graph model/workers from settings
- [x] Update EmbeddingsGenerator to read embedding model from settings
- [x] Add consolidated settings log on startup for easy verification

#### 🧪 Testing
- [x] Create comprehensive test suite (23 tests)
  - 14 unit tests for SettingsService
  - 9 integration tests for processor settings
- [x] Mock heavy dependencies to avoid requiring full stack
- [x] Verify cache behavior, type conversions, fallbacks
- [x] Test end-to-end: Settings change → Cache refresh → New value used

#### 📝 Settings Configuration
- [x] Add infrastructure-aware recommendations to descriptions
  - OpenAI Tier 4: 10,000 RPM limit
  - Render Standard: 1 CPU, 2GB RAM constraints
- [x] Rename `processing.summaryWorkers` → `processing.summaryNeighbors` (clearer naming)
- [x] Add `processing.summaryParallelWorkers` setting (was missing)
- [x] All 4 worker settings properly configured:
  - `processing.pdfWorkers` - Parallel workers for PDF processing (10-20 recommended)
  - `processing.summaryNeighbors` - Neighboring chunks for context (2-3 recommended)
  - `processing.summaryParallelWorkers` - Parallel workers for summaries (10-20 recommended)
  - `processing.graphWorkers` - Parallel workers for graph extraction (10-20 recommended)

### Technical Decisions
- **Cache TTL**: 60 seconds (balance freshness vs DB load)
- **Fallback strategy**: ENV vars → Default values (graceful degradation)
- **Storage**: `system_settings` table with JSONB values
- **Testing**: Mocked dependencies for fast, reliable tests

### Files Created/Modified
- `apps/backend/ingest/settings_service.py` - Core settings service
- `apps/backend/ingest/main.py` - Use settings service
- `apps/backend/ingest/processors/docling_processor.py` - Read VLM model
- `apps/backend/ingest/chunkers/hybrid_chunker.py` - Read summary settings
- `apps/backend/ingest/processors/graph_extractor.py` - Read graph model
- `apps/backend/ingest/processors/embeddings_generator.py` - Read embedding model
- `apps/backend/ingest/tests/test_settings_service.py` - Unit tests
- `apps/backend/ingest/tests/test_settings_integration.py` - Integration tests
- `apps/backend/ingest/TESTING.md` - Updated with settings testing guide

### Benefits
- ✅ No code deployments for configuration changes
- ✅ Real-time updates (60s cache refresh)
- ✅ Infrastructure-aware recommendations
- ✅ Type-safe configuration
- ✅ Comprehensive test coverage
- ✅ Graceful fallbacks

---

## Phase 9: Living Entities - Continuously Updated Knowledge Pages

### Overview

Transform Mosaic from "smart search" to "living knowledge base" with template-based, AI-maintained entity pages that serve as single source of truth for critical domain entities.

**The Killer Feature:** Living Entities are what make "Mosaic for X" truly powerful for any domain where expert decision-making creates value.

### What Are Living Entities?

**Living Entities** are continuously-updated, structured knowledge pages that evolve automatically as new information is ingested:

- **Template-based**: Each entity type (Material, Mine, Supplier, etc.) follows consistent structure
- **AI-maintained**: CrewAI agents automatically update entities when new content arrives
- **Cross-linked**: Bidirectional relationships between related entities
- **Auditable**: Complete history of all changes with source attribution
- **Contextual AI**: Each entity has its own AI chat scoped to its knowledge

### Living Entities vs. Graph Entities

**Graph Entities** (Current - Phase 5):
- Lightweight, extracted automatically during ingestion
- Simple schema: name, type, description, relationships
- Purpose: Enable semantic search and relationship discovery
- Example: "Strategic Planning" entity linking documents

**Living Entities** (Phase 9):
- Rich, curated pages with domain-specific schemas
- Complex templates with 10-20+ sections per entity type
- Purpose: Single source of truth for critical domain entities
- Example: "Antimony" page with supply chain, pricing, geopolitics, applications, recent developments, etc.

**The Relationship:**
```
Graph Entities → Identify what matters (discovery)
Living Entities → Deep, structured knowledge about what matters (intelligence)
```

### Goals

- ✅ Create structured, template-based entity pages
- ✅ Automatic updates via CrewAI agents when new content arrives
- ✅ Cross-linking between related entities
- ✅ Contextual AI chat scoped to each entity
- ✅ Complete audit trail of all changes
- ✅ Domain-specific templates (Materials, Mines, Suppliers, Agencies, etc.)

### Use Case Example

**User asks:** "I'm about to make a purchasing decision on 40 tons of Antimony, what do I need to know?"

**Platform provides:**
1. Comprehensive Antimony living entity page with structured sections:
   - Overview (chemical properties, criticality score)
   - Supply Chain Analysis (global production, major producers, US import reliance)
   - Pricing & Market Dynamics (current price, trends, historical data)
   - Geopolitical Risk Assessment (risk score, export controls, trade restrictions)
   - Applications & Use Cases (primary applications, industries)
   - Alternatives & Substitutes (feasibility, performance, cost comparisons)
   - Recent Developments (timeline of news and updates)
2. Inline links to related entities (MP Materials, Arizona Mine, DLA, F-35)
3. Contextual AI chat grounded in entity's knowledge
4. Always current - updated automatically as new information arrives

### Phase 9.1: Database Schema & Templates (1 week)

**Goal:** Create database tables and template system for living entities

#### Tasks

**Database Schema:**
- [ ] Create `living_entities` table
  - Core fields: id, org_id, entity_type, name, slug
  - JSONB sections field for flexible template-based content
  - Metadata: last_updated, update_count, source_count, confidence_score
  - Full-text search vector
- [ ] Create `living_entity_relationships` table
  - Bidirectional links between entities
  - Relationship types: produces, supplies, regulates, competes_with, located_in
  - Context and strength fields
  - Source attribution
- [ ] Create `living_entity_updates` table
  - Complete audit trail of all changes
  - Old/new content tracking
  - Source attribution (document, news, data, manual)
  - Agent tracking (which CrewAI agent made the change)
  - Validation status (approved, pending, rejected)
- [ ] Create `living_entity_graph_links` table
  - Links between living entities and graph entities
  - Link strength and type
- [ ] Add RLS policies for all tables
- [ ] Create indexes for performance

**Template System:**
- [ ] Create `EntityTemplate` TypeScript interface
- [ ] Create `SectionDefinition` interface with JSON Schema validation
- [ ] Create `TemplateRegistry` class for template management
- [ ] Define Material entity template (7 sections)
- [ ] Define Mine entity template (6+ sections)
- [ ] Define Supplier entity template
- [ ] Define Agency entity template
- [ ] Define Technology entity template
- [ ] Add template validation logic

**Estimated Effort:** 4-5 days

**Files to Create:**
- `supabase/migrations/2025XX_create_living_entities_tables.sql`
- `apps/web/lib/templates/entity-template.ts`
- `apps/web/lib/templates/material-template.ts`
- `apps/web/lib/templates/mine-template.ts`
- `apps/web/lib/templates/template-registry.ts`

**Reference:** `docs/living_entities/01_architecture.md`

### Phase 9.2: CrewAI Update Crew (2 weeks)

**Goal:** Build multi-agent system to automatically update living entities

#### The Update Crew (5 Agents)

**Agent 1: Entity Identifier**
- Identifies which living entities should be updated from new content
- Tools: search_living_entities, search_graph_entities, semantic_similarity
- Output: List of entity slugs with confidence scores

**Agent 2: Information Extractor**
- Extracts structured information that fits entity templates
- Tools: read_content, get_entity_template, extract_structured_data
- Output: Section-specific content with confidence scores

**Agent 3: Content Synthesizer**
- Merges new information with existing entity content
- Handles deduplication and conflict resolution
- Tools: read_entity, compare_content, merge_strategies
- Output: Synthesized content for each section

**Agent 4: Relationship Linker**
- Creates/updates relationships between entities
- Tools: find_related_entities, create_relationship, validate_relationship
- Output: List of relationships to create/update

**Agent 5: Quality Validator**
- Validates accuracy and quality of updates
- Tools: fact_check, schema_validate, confidence_score
- Output: Approval/rejection with quality metrics

#### Tasks

**CrewAI Setup:**
- [ ] Install CrewAI dependencies (`crewai`, `crewai-tools`)
- [ ] Create `apps/backend/living_entities/` directory
- [ ] Set up CrewAI configuration

**Agent Implementation:**
- [ ] Implement Entity Identifier agent
- [ ] Implement Information Extractor agent
- [ ] Implement Content Synthesizer agent
- [ ] Implement Relationship Linker agent
- [ ] Implement Quality Validator agent

**Tools Development:**
- [ ] Create `search_living_entities` tool
- [ ] Create `search_graph_entities` tool
- [ ] Create `get_entity_template` tool
- [ ] Create `extract_structured_data` tool
- [ ] Create `merge_content` tool
- [ ] Create `create_relationship` tool
- [ ] Create `validate_update` tool

**Workflow Integration:**
- [ ] Create update orchestration workflow
- [ ] Integrate with document processing pipeline
- [ ] Add queue for living entity updates
- [ ] Implement error handling and retry logic
- [ ] Add logging and metrics

**Testing:**
- [ ] Test with sample news articles
- [ ] Test with uploaded documents
- [ ] Verify entity identification accuracy
- [ ] Verify extraction quality
- [ ] Verify synthesis correctness
- [ ] Test relationship creation

**Estimated Effort:** 8-10 days

**Files to Create:**
- `apps/backend/living_entities/crew.py`
- `apps/backend/living_entities/agents/identifier.py`
- `apps/backend/living_entities/agents/extractor.py`
- `apps/backend/living_entities/agents/synthesizer.py`
- `apps/backend/living_entities/agents/linker.py`
- `apps/backend/living_entities/agents/validator.py`
- `apps/backend/living_entities/tools/entity_tools.py`
- `apps/backend/living_entities/tools/extraction_tools.py`
- `apps/backend/living_entities/workflow.py`

**Reference:** `docs/living_entities/02_crewai_agents.md`, `docs/living_entities/03_update_workflow.md`

### Phase 9.3: UI Components (1-2 weeks)

**Goal:** Build rich, interactive entity pages

#### Tasks

**Entity Page Components:**
- [ ] Create entity page layout (`/entities/[slug]`)
- [ ] Create section renderer (handles different section types)
- [ ] Create MaterialOverview component
- [ ] Create SupplyChainAnalysis component
- [ ] Create PricingData component
- [ ] Create GeopoliticalRisk component
- [ ] Create Applications component
- [ ] Create Alternatives component
- [ ] Create RecentDevelopments timeline component
- [ ] Create QuickStats dashboard
- [ ] Create RelatedEntities sidebar

**Entity Management:**
- [ ] Create entity list page (`/entities`)
- [ ] Add search and filtering
- [ ] Add entity type filtering
- [ ] Create entity creation form
- [ ] Create entity editing interface
- [ ] Add manual update capability

**Relationship Visualization:**
- [ ] Create relationship graph component
- [ ] Add interactive entity network view
- [ ] Show relationship strength visually
- [ ] Enable click-to-navigate between entities

**Audit Trail:**
- [ ] Create update history component
- [ ] Show what changed, when, why, by whom
- [ ] Add diff view for content changes
- [ ] Link to source documents

**Contextual AI Chat:**
- [ ] Create entity-scoped chat component
- [ ] Integrate with existing search/chat
- [ ] Filter context to entity's knowledge
- [ ] Show entity context in chat

**Estimated Effort:** 6-8 days

**Files to Create:**
- `apps/web/app/(app)/entities/page.tsx`
- `apps/web/app/(app)/entities/[slug]/page.tsx`
- `apps/web/components/living-entities/entity-page.tsx`
- `apps/web/components/living-entities/section-renderer.tsx`
- `apps/web/components/living-entities/material-overview.tsx`
- `apps/web/components/living-entities/supply-chain-analysis.tsx`
- `apps/web/components/living-entities/pricing-data.tsx`
- `apps/web/components/living-entities/geopolitical-risk.tsx`
- `apps/web/components/living-entities/quick-stats.tsx`
- `apps/web/components/living-entities/related-entities.tsx`
- `apps/web/components/living-entities/update-history.tsx`
- `apps/web/components/living-entities/entity-chat.tsx`

### Phase 9.4: Integration with Ingestion Pipeline (1 week)

**Goal:** Connect living entity updates to document processing

#### Tasks

**Pipeline Integration:**
- [ ] Add living entity update trigger to document processing
- [ ] Queue living entity updates after graph extraction
- [ ] Pass document content and metadata to CrewAI crew
- [ ] Handle success/failure states

**API Endpoints:**
- [ ] `GET /api/living-entities` - List entities with filtering
- [ ] `GET /api/living-entities/[slug]` - Get entity details
- [ ] `POST /api/living-entities` - Create new entity
- [ ] `PUT /api/living-entities/[slug]` - Update entity
- [ ] `DELETE /api/living-entities/[slug]` - Delete entity
- [ ] `GET /api/living-entities/[slug]/updates` - Get update history
- [ ] `GET /api/living-entities/[slug]/relationships` - Get relationships
- [ ] `POST /api/living-entities/[slug]/chat` - Entity-scoped chat

**Background Processing:**
- [ ] Create living entity update queue
- [ ] Implement worker to process updates
- [ ] Add retry logic for failed updates
- [ ] Add rate limiting for CrewAI calls
- [ ] Monitor queue depth and processing time

**Testing:**
- [ ] End-to-end test: Upload document → Entity updated
- [ ] Test with multiple documents updating same entity
- [ ] Test relationship creation across entities
- [ ] Verify audit trail accuracy
- [ ] Load test with concurrent updates

**Estimated Effort:** 4-5 days

**Files to Create:**
- `apps/web/app/api/living-entities/route.ts`
- `apps/web/app/api/living-entities/[slug]/route.ts`
- `apps/web/app/api/living-entities/[slug]/updates/route.ts`
- `apps/web/app/api/living-entities/[slug]/relationships/route.ts`
- `supabase/functions/update-living-entities/index.ts`

**Reference:** `docs/living_entities/03_update_workflow.md`

### Phase 9.5: Domain-Specific Templates (Optional)

**Goal:** Create templates for specific use cases

#### Strategic Materials Platform Templates
- [ ] Material template (Antimony, Lithium, Rare Earths)
- [ ] Mine template (mining operations)
- [ ] Supplier template (companies in supply chain)
- [ ] Technology template (applications and use cases)
- [ ] Agency template (government bodies and regulators)

#### Nuclear Cybersecurity Platform Templates
- [ ] Threat Actor template (APT groups, nation-states)
- [ ] Vulnerability template (CVEs, zero-days)
- [ ] Asset template (control systems, facilities)
- [ ] Incident template (past attacks, security events)
- [ ] Mitigation template (patches, procedures, controls)

#### Veteran Services Platform Templates
- [ ] Individual template (veterans with risk profiles, anonymized)
- [ ] Program template (intervention programs and services)
- [ ] Facility template (VA centers, community organizations)
- [ ] Risk Factor template (PTSD, TBI, social isolation)
- [ ] Protective Factor template (support systems, resources)

**Estimated Effort:** 2-3 days per domain

### Benefits

**For Users:**
- ✅ Single source of truth for any entity
- ✅ Always up-to-date without manual curation
- ✅ Structured, comparable information across entities
- ✅ Deep exploration via entity links
- ✅ Grounded AI answers scoped to entity context

**For Platform Builders:**
- ✅ Scalable - Handles thousands of entities automatically
- ✅ Extensible - Easy to add new entity types
- ✅ Maintainable - AI handles updates, not manual curation
- ✅ Auditable - Complete history of all changes
- ✅ Flexible - Templates adapt to domain needs

### Technical Decisions

- **Storage:** JSONB for flexible template-based content
- **Updates:** CrewAI multi-agent system for intelligent processing
- **Validation:** JSON Schema for section validation
- **Relationships:** Bidirectional links with strength scores
- **Audit:** Complete history with source attribution
- **Search:** Full-text search + semantic search on entity content

### Cost Estimates

**Per Document Processing:**
- Entity identification: ~$0.02
- Information extraction: ~$0.05-0.10
- Content synthesis: ~$0.03-0.05
- Relationship linking: ~$0.02
- Quality validation: ~$0.02
- **Total:** ~$0.14-0.21 per document

**At Scale (1000 documents/month):**
- ~$140-210/month for living entity updates
- Scales linearly with document volume
- Can batch updates to reduce costs

### Success Metrics

- Number of living entities created
- Update frequency per entity
- User engagement with entity pages
- Entity page views vs. search results
- Relationship accuracy (manual review)
- Update quality scores (validator agent)
- Time from content ingestion to entity update

### Documentation

Complete implementation details available in:
- `docs/living_entities/README.md` - Overview and concept
- `docs/living_entities/01_architecture.md` - Database schema and templates
- `docs/living_entities/02_crewai_agents.md` - AI agents that update entities
- `docs/living_entities/03_update_workflow.md` - End-to-end workflow

---

## Phase 10: Advanced Graph & Document Intelligence

### Overview

Enhance graph quality, document organization, and intelligent automation features to create a production-grade enterprise RAG platform.

### Phase 10.1: Entity Deduplication & Merge Assistant (1-2 weeks)

**Goal:** Clean up duplicate entities and improve graph quality

**Priority:** High

**Estimated Effort:** 7-10 days

**Tasks:**
- [ ] **Phase 1: Manual Merge Workflow** (2-3 days)
  - Add "Merge Entities" action to entity list
  - Create merge dialog with side-by-side comparison
  - Implement merge operation (union references, update relationships)
  - Add "Mark as Alias" quick action
- [ ] **Phase 2: Automated Duplicate Detection** (2-3 days)
  - Create background job: `detect_duplicate_entities`
  - Detection algorithm (embedding similarity + Levenshtein + co-occurrence)
  - Store suggestions in `entity_merge_suggestions` table
  - Add "Merge Suggestions" tab to graph page
- [ ] **Phase 3: AI-Assisted Merge Intelligence** (3-4 days)
  - Use LLM to analyze entity pairs
  - Generate confidence scores and reasoning
  - Synthesized descriptions
  - User review queue with AI explanations

**Reference:** INBOX lines 38-211

### Phase 10.2: Generic Entity Detection & Cleanup (3-4 days)

**Goal:** Remove overly generic entities that provide little semantic value

**Priority:** Medium

**Estimated Effort:** 2-3 days

**Tasks:**
- [ ] **Phase 1: Detection & Flagging** (1-2 days)
  - Create `detect_generic_entities` function
  - Combine frequency, pattern, and context-based detection
  - Add `is_generic` flag and `generic_score` to entities table
  - Create "Generic Entities" section in cleanup UI
- [ ] **Phase 2: Review & Cleanup UI** (1 day)
  - Add "Generic Entities" tab to cleanup page
  - Show flagged entities with scores and reasons
  - Bulk delete workflow
  - "Keep" option for false positives

**Reference:** INBOX lines 335-432

### Phase 10.3: Document Organization System (1-2 weeks)

**Goal:** Folders, tags, and AI-powered organization

**Priority:** Medium-High

**Estimated Effort:** 7-10 days

**Tasks:**
- [ ] **Phase 1: Folder/Subfolder Hierarchy** (2-3 days)
  - Create `document_folders` table
  - Folder management UI (create, rename, delete, drag-drop)
  - Nested folder structure with breadcrumb navigation
  - Search within folders
- [ ] **Phase 2: Tagging System** (1-2 days)
  - Create `document_tags` and `document_tag_assignments` tables
  - Tag management UI with color picker
  - Tag filtering (AND/OR logic)
  - Bulk tag assignment
- [ ] **Phase 3: Combined Folder + Tag Views** (1 day)
  - Flexible organization (folders AND tags)
  - Smart collections (Recent, Favorites, Needs Review)
  - Multiple view options (list, grid, compact)
- [ ] **Phase 4: AI-Powered Organization Suggestions** (3-4 days)
  - Automatic folder/tag suggestions for new uploads
  - Bulk organization assistant
  - Smart folder creation from document clusters
  - Learning system (track user patterns)

**Reference:** INBOX lines 607-835

### Phase 10.4: Document-Level Intelligence & Graph Integration (2-3 weeks)

**Goal:** Add intelligence layer to documents with summaries, metadata, and graph integration

**Priority:** High

**Estimated Effort:** 12-15 days

**Tasks:**
- [ ] **Phase 1: Document Summarization & Metadata** (2-3 days)
  - Add document-level fields (summary, key_topics, document_type, primary_entities)
  - Generate document summary during processing
  - Display in document list and details page
- [ ] **Phase 2: Auto-Tagging from Content** (1-2 days)
  - Automatic tag generation from content
  - Tag suggestion algorithm with confidence scores
  - Smart tag application (auto-apply high-confidence)
- [ ] **Phase 3: Documents as Graph Entities** (3-4 days)
  - Integrate documents into knowledge graph
  - Document-to-topic relationships
  - Graph queries for documents
  - Visual graph integration
- [ ] **Phase 4: Staleness Detection & Freshness Tracking** (2-3 days)
  - Temporal metadata (effective_date, expiration_date)
  - Staleness detection algorithm
  - Freshness indicators and badges
  - Staleness dashboard
- [ ] **Phase 5: Document Clustering & Discovery** (2-3 days)
  - Document similarity analysis
  - Document clustering UI
  - Smart document discovery
  - Document network analysis

**Reference:** INBOX lines 838-1141

### Phase 10.5: Temporal Data Management & Versioning (1 week)

**Goal:** Handle document versions and temporal relevance

**Priority:** Medium-High

**Estimated Effort:** 5-7 days

**Tasks:**
- [ ] **Phase 1: Basic Temporal Metadata** (1-2 days)
  - Add `effective_date`, `expiration_date`, `is_current` to documents
  - Add temporal filters to search UI
  - Display document age/freshness in results
- [ ] **Phase 2: Document Versioning** (2-3 days)
  - Create `document_versions` table
  - Add "Upload New Version" workflow
  - Link documents in version chains
  - Search defaults to latest versions only
- [ ] **Phase 3: Temporal Search Weighting** (1-2 days)
  - Add time-decay function to search scoring
  - Configurable decay rates per document type
  - Show temporal relevance indicators

**Reference:** INBOX lines 212-332

### Phase 10.6: Intelligent Source Discovery (1-2 weeks)

**Goal:** NotebookLM-style source discovery with knowledge gap analysis

**Priority:** Medium-High

**Estimated Effort:** 7-10 days

**Tasks:**
- [ ] **Phase 1: Knowledge Gap Analysis** (3-4 days)
  - Analyze corpus to identify knowledge gaps
  - Create "Knowledge Gaps" dashboard
  - Gap detection algorithm
- [ ] **Phase 2: Web Source Discovery** (2-3 days)
  - Add "Discover Sources" button
  - Implement web search integration (Tavily API)
  - Source evaluation criteria
  - Show source candidates with relevance scores
- [ ] **Phase 3: Automated Source Ingestion** (2-3 days)
  - Web scraping/extraction for recommended sources
  - Support for web pages, PDFs, academic papers
  - Automatic metadata extraction
  - Add to processing queue with source tracking

**Reference:** INBOX lines 435-605

### Phase 10.7: Adaptive Chunk Quality Enhancement (1-2 weeks)

**Goal:** Detect and fix poor chunking quality

**Priority:** Medium-High

**Estimated Effort:** 6-9 days

**Tasks:**
- [ ] **Phase 1: Automatic Quality Detection** (2-3 days)
  - Implement chunk quality scoring (0-1 scale)
  - Add quality metadata to documents
  - Run quality assessment after chunking
  - Flag documents below quality threshold
- [ ] **Phase 2: Selective LLM Post-Processing** (2-3 days)
  - Implement boundary fixing for low-quality chunks
  - Batch processing for efficiency
  - Automatic application for docs with quality <0.7
  - Cost optimization (only fix problem chunks)
- [ ] **Phase 3: On-Demand Re-Chunking UI** (2-3 days)
  - Add quality indicators to document list
  - Document details page enhancements
  - Re-chunking strategies (standard, enhanced, agentic)
  - Cost estimation and confirmation
  - Preserve original chunks for rollback

**Cost:** ~$0.01 per document average, $15-30/month at 1000 docs/month

**Reference:** INBOX lines 1144-1377

### Phase 10.8: OCR Cleanup Pre-Processing (1 week)

**Goal:** Fix OCR errors in scanned documents before chunking

**Priority:** Medium

**Estimated Effort:** 5-7 days

**Tasks:**
- [ ] **Phase 1: Scanned Document Detection** (1 day)
  - Detect OCR artifacts
  - Add metadata flags (is_scanned, ocr_error_score)
  - Flag documents during initial processing
- [ ] **Phase 2: Conservative OCR Cleanup** (2-3 days)
  - Implement LLM-based OCR error correction (Gemini 2.0 Flash)
  - Strict rules to prevent hallucination
  - Process only flagged documents
- [ ] **Phase 3: Verification & Rollback** (1-2 days)
  - Implement hallucination detection
  - Preserve original document
  - Automatic rollback on verification failure
- [ ] **Phase 4: UI & User Control** (1-2 days)
  - Document details page indicators
  - Settings page controls
  - Manual trigger with preview

**Cost:** ~$0.02 per scanned document, $2/month at 100 scanned docs/month

**Reference:** INBOX lines 1379-1687

### Phase 10.9: Prompt Management System (1 week)

**Goal:** Move prompts from code to database for easier iteration

**Priority:** Medium

**Estimated Effort:** 5-7 days

**Tasks:**
- [ ] **Phase 1: Prompt Settings Page** (3-4 days)
  - Create dedicated settings page for system prompts
  - Store prompts in `system_settings` table
  - Categories: chunk summary, graph extraction, HyDE, multi-query
  - Allow real-time editing without code changes
  - Version tracking for prompt changes
- [ ] **Phase 2: Automated Prompt Optimization** (Future)
  - A/B testing framework for prompts
  - Track metrics: quality, latency, token usage
  - Statistical significance testing
  - Automated rollback if performance degrades

**Reference:** INBOX lines 5-36

---

## Future Enhancements

### Short Term (1-3 months)
- Multi-language support
- Advanced filtering and sorting
- Collaborative features

### Medium Term (3-6 months)
- Custom embedding models
- Fine-tuned entity extraction
- API for external integrations

### Long Term (6-12 months)
- Multi-modal support (images, audio)
- Real-time collaboration
- Enterprise features (SSO, audit logs)

---

## Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [pgvector Guide](https://github.com/pgvector/pgvector)
- [Unstructured Docs](https://unstructured-io.github.io/unstructured/)

### Community
- [Supabase Discord](https://discord.supabase.com)
- [Next.js Discord](https://nextjs.org/discord)

### Tools
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)

---

## Changelog

### 2025-01-16
- ✅ Phase 1-3 Complete: Full document processing pipeline
- ✅ Phase 7.1-7.4 Complete: Document details page with chunks view
- ✅ Docling VLM processor implemented and deployed
- ✅ Parallel page processing (10 workers)
- ✅ Shared corpus support (public/private documents)
- ✅ Error tracking and retry logic
- ✅ Tested with 200+ page PDFs (1972+ chunks)
- 🔄 Next: Phase 4 (Vector Embeddings & Semantic Search)

### 2025-10-16
- ✅ **Production-Ready End-to-End Pipeline Complete**
- ✅ Fixed Docling API timeout handling (120s timeout in ApiVlmOptions)
- ✅ Fixed .txt file processing (convert to .md for Docling compatibility)
- ✅ Fixed PGMQ queue corruption on document deletion (added cleanup function)
- ✅ Verified working across all document types:
  - PDF: 48-page doc processed in ~3 min with parallel VLM (15 workers)
  - PPTX: 15.5MB file processed in 5.47 sec
  - TXT: Plain text files now process correctly
  - CSV: 7-line CSV processed in 0.00 sec with table extraction
- ✅ Automatic embedding generation integrated into processing pipeline
- ✅ All documents → chunks → embeddings → searchable
- ✅ **Graph RAG Implementation Complete (Phase 5.1 & 5.2)**
  - Postgres-native entities and relationships tables with pgvector
  - Automatic entity/relationship extraction during document processing
  - 64 entities, 46 relationships extracted from test document
  - Semantic entity search with adaptive thresholds (0.5 → 0.3 fallback)
  - Graph search integrated into main search API
  - Multi-hop graph traversal (1-hop default)
  - Relationship query detection (automatic graph search trigger)
  - ~$0.23 per 200-page document, ~$0.0001 per search
- 🎯 **System Status: Production-ready with Graph RAG for real-world use**

### 2025-10-19
- ✅ **BUILD_PLAN Reorganization**
- ✅ Fixed duplicate phase numbers (old Phases 8-10 renumbered to 11-13)
- ✅ Added Phase 9: Living Entities (CrewAI-powered knowledge pages)
- ✅ Added Phase 10: Advanced Graph & Document Intelligence (9 sub-phases)
- ✅ Cleaned up INBOX.md (all items migrated to BUILD_PLAN or TO_PROCESS)
- ✅ Cleaned up TO_PROCESS.md (moved bugs to BUGS.md, removed completed items)
- 📋 **Current Structure:**
  - Phases 1-5: Core RAG pipeline ✅ COMPLETE
  - Phase 6: Hybrid Search & Query Interface (in progress)
  - Phase 7: Document Details & Management (mostly complete)
  - Phase 8: Settings Management System ✅ COMPLETE
  - Phase 9: Living Entities (future)
  - Phase 10: Advanced Graph & Document Intelligence (future)
  - Phases 11-13: Collaborative features, polish, enterprise scaling (future)

### 2025-10-17
- ✅ **Phase 8 Complete: Settings Management System**
- ✅ Created SettingsService with 60s TTL cache and type-safe getters
- ✅ Connected all backend processors to database settings
- ✅ Comprehensive test suite (23 passing tests)
- ✅ Verified end-to-end: Settings changes picked up within 60s
- ✅ Added infrastructure-aware recommendations (OpenAI T4: 10k RPM, Render: 1 CPU/2GB)
- ✅ Renamed settings for clarity (`summaryWorkers` → `summaryNeighbors`)
- ✅ Added missing `summaryParallelWorkers` setting
- ✅ Consolidated settings log on startup for easy verification
- 🎯 **System Status: Production-ready with database-driven configuration**

### 2025-10-15
- ✅ Completed Phase 1: Core Upload Infrastructure
- ✅ Completed Phase 2: Real-time status updates
- ✅ Completed Phase 3: Document processing pipeline
- ✅ Implemented background processing queue with pgmq
- ✅ Deployed Python background worker to Render.com

---

**Next Phase**: Phase 6 - Hybrid Search Enhancements or Phase 9 - Living Entities
