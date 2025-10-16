# Mosaic RAG Platform - Build Plan

**Last Updated:** October 16, 2025  
**Status:** Phase 1-4 Complete + Phase 7.1-7.4 Complete - **Production-ready end-to-end pipeline: Upload → Processing → Embeddings → Search working across all document types (PDF, PPTX, TXT, CSV, MD)**

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

### Goals
- Enable users to upload documents
- Store files securely in Supabase Storage
- Track document metadata in database
- Implement background processing queue

### Completed Tasks

#### ✅ Document Upload System
- [x] Direct client-side uploads to Supabase Storage (bypasses Next.js)
- [x] Support for PDF, TXT, MD, DOC, DOCX formats
- [x] File size validation (50MB limit for free tier)
- [x] File type validation
- [x] Progress bar UI with simulated progress
- [x] Session refresh for long uploads
- [x] Resumable uploads for files > 6MB

#### ✅ Database Schema
- [x] `documents` table with RLS policies
- [x] User-isolated storage (files stored in `user_id/` folders)
- [x] Status tracking: `uploaded`, `processing`, `ready`, `error`
- [x] Metadata: file name, size, type, timestamps

#### ✅ Background Processing Queue
- [x] Enabled `pgmq` extension (Postgres Message Queue)
- [x] Created `document_processing` queue
- [x] Automatic job creation after upload
- [x] Edge Function worker to process jobs
- [x] Cron job (runs every minute) to trigger worker
- [x] Status updates: `uploaded` → `processing` → `ready`

### Files Created/Modified
- `apps/web/app/(app)/documents/page.tsx` - Documents management page
- `apps/web/app/(app)/documents/actions.ts` - Server actions for CRUD + queue
- `apps/web/components/document-upload.tsx` - Upload dialog with progress
- `apps/web/components/document-list.tsx` - Document table with actions
- `supabase/migrations/20241014_create_documents_table.sql` - DB schema
- `supabase/functions/process-documents/index.ts` - Background worker

### Technical Decisions
- **Direct uploads**: Bypasses Next.js server for better performance and no size limits
- **pgmq over external queue**: Postgres-native, simpler, no extra services
- **Edge Functions**: Serverless processing, scales automatically
- **Free tier limits**: 50MB per file, 1GB total storage (upgrade to Pro for 5GB files)

---

## Phase 2: Real-Time Status Updates & UX Improvements ✅ COMPLETE

### Goals
- Users see document status changes without refreshing
- Live updates as documents move through processing pipeline
- Better UX with instant feedback
- Support multiple file uploads

### Completed Tasks

#### ✅ Supabase Realtime Integration
- [x] Subscribe to `documents` table changes
- [x] Update UI when status changes (INSERT, UPDATE, DELETE)
- [x] Show processing progress indicators with animated spinners
- [x] Handle connection states

#### ✅ UI Enhancements
- [x] Add status badges with animations (Uploading, Processing, Ready)
- [x] Show "Processing..." spinner for active documents
- [x] Toast notifications for status changes (upload start, complete, ready)
- [x] Optimistic updates for instant feedback
- [x] Non-blocking upload (modal closes immediately)
- [x] Multiple file selection and parallel uploads
- [x] Shared state management via DocumentsPageClient wrapper

### Key Features Implemented
- **Optimistic UI**: Files appear in table instantly with "Uploading" status
- **Real-time updates**: Status changes reflected immediately via Supabase Realtime
- **Multiple uploads**: Select and upload multiple files simultaneously
- **Toast notifications**: Clear feedback at each stage
- **Non-blocking**: Users can continue working while uploads happen

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

**Priority:** Low - Nice to have but not critical

---

## Phase 3: Document Processing Pipeline ✅ COMPLETE

### Goals
- Extract text from various document formats
- Implement intelligent chunking strategies
- Store chunks with metadata for retrieval

### Completed Tasks

#### 📄 Text Extraction
- [x] Integrate Unstructured.io OSS (legacy)
- [x] Integrate Docling with VLM support (primary processor)
- [x] Support PDF text extraction with parallel page processing
- [x] Support DOCX text extraction
- [x] Support TXT/MD direct reading
- [x] Preserve document structure (headers, sections)
- [x] Extract tables and maintain formatting
- [x] Handle multi-column layouts
- [x] Create Python background worker service
- [x] Deploy to Render.com with Docker
- [x] Test with real documents (200+ page PDFs)
- [x] Implement API VLM (GPT-4o-mini) for fast processing
- [x] Implement local VLM (GraniteDocling) for privacy-first processing

#### ✂️ Text Chunking
- [x] Implement markdown-based chunking strategy
- [x] Respect section boundaries (never split titles)
- [x] Configurable chunk size (1200 char soft max, 2000 char hard max)
- [x] Configurable overlap (100 characters)
- [x] Token counting with tiktoken
- [x] Extract comprehensive metadata:
  - Page numbers for citations
  - Element types (Title, NarrativeText, Table, etc.)
  - Table HTML for structured data
  - PDF coordinates for deep linking
  - File metadata (source, last modified)
  - Links from HTML/web documents
- [x] Parallel page processing (10 workers default, configurable)

#### 🗄️ Chunks Database
- [x] Create `chunks` table migration
  - `id`, `document_id`, `user_id`
  - `content`, `chunk_index`, `token_count`
  - `metadata` (JSONB: page, section, etc.)
  - `created_at`
- [x] Add RLS policies for user isolation
- [x] Create indexes for efficient querying
- [x] Apply migration to Supabase
- [x] Verify chunks are being stored (tested with 1972+ chunk documents)

### Technical Decisions

#### Text Extraction Strategy: VLM-First Approach
- **Primary Processor: Docling with VLM**
  - Why: 20-40x faster than OCR for table-heavy documents (3-7 min vs 2-4 hours for 200 pages)
  - Features: Vision Language Model, parallel page processing, superior table extraction
  - Options:
    - **API VLM (GPT-4o-mini)**: Fastest, ~$0.005/document, recommended for production
    - **Local VLM (GraniteDocling)**: Privacy-first, free, slower but still faster than OCR
  - Best for: All document types, especially PDFs with tables, charts, complex layouts
  
- **Legacy Processor: Unstructured.io OSS**
  - Why: Kept as fallback option, traditional OCR approach
  - Use when: Docling unavailable or specific edge cases
  - Features: OCR, table extraction, layout detection, spreadsheet handling
  - Note: Significantly slower, higher temp disk usage
  
- **Future Enhancement: Multimodal LLM (GPT-4V/Claude 3 Vision)**
  - Why: Extract from complex diagrams, images, or layouts that parsers fail on
  - Use when: Docling fails on specific pages/documents
  - Note: Most expensive option, use sparingly

#### Service Architecture
- **Background Worker**: Python service deployed on Render.com (2GB RAM, $25/mo Standard plan)
  - **Environment**: Docker (for system package support)
  - **System Dependencies**: Minimal (Docling handles most internally)
  - **Retry Logic**: Max 3 attempts with exponential backoff
  - **Error Tracking**: Stores error messages, retry counts, timestamps in database
  - **Parallel Processing**: 10 concurrent page workers (configurable via DOCLING_MAX_WORKERS)
- **Queue**: pgmq (Postgres-based message queue)
- **Processing Flow**:
  1. Server action adds job to pgmq queue
  2. Python worker polls queue every 5 seconds
  3. Downloads file from Supabase Storage
  4. Splits PDF into individual pages (for parallel processing)
  5. Processes pages in parallel with Docling VLM (10 workers)
  6. Combines page results into full markdown
  7. Chunks markdown with MarkdownChunker
  8. Extracts comprehensive metadata (pages, coordinates, tables, links)
  9. Stores chunks in Postgres
  10. Updates document status
  11. Real-time UI update via Supabase Realtime
  12. Orphaned job cleanup (deletes jobs for deleted documents)

#### Other Decisions
- **Chunking strategy**: Markdown-based with heading preservation (respects section boundaries)
- **Chunk size**: 1200 char soft max, 2000 char hard max (balance context and precision)
- **Overlap**: 100 characters between chunks
- **Deployment**: Render.com Background Worker with 2GB RAM, Docker container
- **File types**: PDF (primary), DOC, DOCX, TXT, MD, HTML, XML, CSV, XLSX, PPTX
- **Processor selection**: Environment variable `USE_DOCLING` (default: true)
- **VLM mode**: Environment variable `USE_API_VLM` (default: true for speed)

### Phase 3 Improvements (Future Enhancements)

#### 🧠 Intelligent Chunking for Better Graph Extraction (High Priority)
**Goal**: Improve chunking quality to enhance all downstream results (embeddings, search, graph extraction)

**Problem**: Current fixed-size chunking doesn't preserve semantic boundaries or context, limiting graph extraction quality.

**Proposed Solutions:**

1. **Agentic Chunking**
   - [ ] Use LLM to determine optimal chunk boundaries based on semantic meaning
   - [ ] Preserve entity boundaries (don't split entities across chunks)
   - [ ] Maintain relationship context within chunks
   - [ ] Implement as optional chunking strategy

2. **Chunk Summaries**
   - [ ] Generate summaries by comparing each chunk to nearest X neighbors
   - [ ] Provide better context for entity/relationship extraction
   - [ ] Improve embedding quality
   - [ ] Help LLM understand chunk's role in larger document
   - [ ] Store summaries in `chunks.metadata` JSONB field

**Benefits:**
- Better entity extraction (entities won't be split across chunks)
- More accurate relationships (context preserved)
- Improved search results (better embeddings)
- Addresses root cause of many RAG quality issues

**Implementation Approach:**
1. Add new chunking strategy option (markdown, agentic, hybrid)
2. Implement chunk summary generation as post-processing step
3. Store summaries in existing metadata field
4. Use summaries for graph extraction instead of raw content
5. Measure quality improvement vs cost increase

**Priority:** High - Improves entire pipeline quality

---

#### 🔧 OpenAI API Timeout Handling
- [ ] Increase API timeout from 60s to 120s
- [ ] Implement retry logic for failed pages (3 attempts with exponential backoff)
- [ ] Track failed pages in document metadata
- [ ] Display failed pages in frontend document details
- [ ] Add "Reprocess Failed Pages" action

**Current Issue:** Occasional OpenAI API timeouts cause individual pages to fail during parallel processing. Failed pages are skipped, rest of document continues.

**Recommended Implementation:**
1. **Phase 1 (Immediate):** Increase timeout to 120s
2. **Phase 2 (Next sprint):** Add retry logic with exponential backoff
3. **Phase 3 (Future):** Track and display failed pages to users

**Priority:** Medium-High - Affects document completeness

---

## Phase 4: Vector Embeddings & Semantic Search ✅ COMPLETE

### Goals
- ✅ Generate embeddings for all text chunks
- ✅ Enable semantic search across documents
- ✅ Implement efficient vector similarity search
- Optional: LLM-enhanced chunk summaries for better retrieval (future enhancement)

### Completed Tasks

#### 🧮 Embeddings Generation ✅
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

### Goals
- ✅ Extract entities and relationships from documents
- ✅ Build knowledge graph for advanced querying
- ✅ Enable graph-based retrieval

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

### Phase 5.3: Smart Cascade Delete & Data Integrity (High Priority)
**Goal**: Ensure graph data is properly cleaned up when documents are deleted

- [ ] Implement smart cascade delete for entities
  - Check if entity has multiple `document_ids` in array
  - If yes: Remove only the deleted document_id
  - If no: Delete the entity entirely
- [ ] Implement smart cascade delete for relationships
  - Same logic as entities for `document_ids` and `chunk_ids`
- [ ] Add database trigger or function for automatic cleanup
- [ ] Add tests for cascade delete logic
- [ ] Update delete endpoint to handle graph cleanup

**Files to modify:**
- Database migration for trigger/function
- `apps/web/app/api/documents/[id]/route.ts`

### Phase 5.4: Graph Management UI (Medium Priority)
**Goal**: Give users control over extracted entities and relationships

#### Entity/Relationship Editing
- [ ] Create graph management page (`/graph`)
- [ ] View all entities with filtering (by type, document, search)
- [ ] Edit entity names, types, descriptions
- [ ] Merge duplicate entities
- [ ] Delete incorrect entities
- [ ] Add manual entities
- [ ] View all relationships with filtering
- [ ] Edit relationship types and descriptions
- [ ] Delete incorrect relationships
- [ ] Add manual relationships

#### Type Management
- [ ] Create type management interface
- [ ] Edit entity types (add/remove/rename)
- [ ] Edit relationship types (add/remove/rename)
- [ ] Add custom types per user/organization
- [ ] Type validation and suggestions
- [ ] Audit trail for type changes

#### API Endpoints
- [ ] `GET /api/graph/entities` - List entities with filters
- [ ] `PATCH /api/graph/entities/:id` - Update entity
- [ ] `DELETE /api/graph/entities/:id` - Delete entity
- [ ] `POST /api/graph/entities/merge` - Merge entities
- [ ] `GET /api/graph/relationships` - List relationships
- [ ] `PATCH /api/graph/relationships/:id` - Update relationship
- [ ] `DELETE /api/graph/relationships/:id` - Delete relationship
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

### Goals
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

### Goals
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

## Phase 8: Collaborative Annotations & Comments

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
1. **Phase 8.1**: Basic annotations (text selection, simple comments)
2. **Phase 8.2**: Collaboration (@mentions, threading, notifications)
3. **Phase 8.3**: Advanced features (realtime, rich text, presence)
4. **Phase 8.4**: Polish (search, export, analytics)

---

## Phase 9: Polish & Production Readiness

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

---

## Phase 10: Platform Migration & Enterprise Scaling

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

## Future Enhancements

### Short Term (1-3 months)
- Multi-language support
- Advanced filtering and sorting
- Document collections/folders
- Collaborative features

### Medium Term (3-6 months)
- Custom embedding models
- Fine-tuned entity extraction
- Advanced graph analytics
- API for external integrations

### Long Term (6-12 months)
- Multi-modal support (images, audio)
- Real-time collaboration
- Advanced AI agents
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

### 2025-10-15
- ✅ Completed Phase 1: Core Upload Infrastructure
- ✅ Completed Phase 2: Real-time status updates
- ✅ Completed Phase 3: Document processing pipeline
- ✅ Implemented background processing queue with pgmq
- ✅ Deployed Python background worker to Render.com

---

**Next Phase**: Phase 5 - Knowledge Graph Extraction (Graph RAG)
