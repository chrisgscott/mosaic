# Mosaic RAG Platform - Build Plan

**Last Updated:** October 15, 2025  
**Status:** Phase 1-3 & 7 Complete - Full document processing pipeline with shared corpus + error tracking + Docker deployment

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

---

## Phase 3: Document Processing Pipeline ✅ COMPLETE

### Goals
- Extract text from various document formats
- Implement intelligent chunking strategies
- Store chunks with metadata for retrieval

### Tasks

#### 📄 Text Extraction
- [x] Integrate Unstructured.io OSS
- [x] Support PDF text extraction
- [x] Support DOCX text extraction
- [x] Support TXT/MD direct reading
- [x] Preserve document structure (headers, sections)
- [x] Extract tables and maintain formatting
- [x] Handle multi-column layouts
- [x] Create Python background worker service
- [ ] Deploy to Render.com
- [ ] Test with real documents
- [ ] Add Docling as Tier 2 fallback (future)

#### ✂️ Text Chunking
- [x] Implement Unstructured by_title chunking strategy
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

#### 🗄️ Chunks Database
- [x] Create `chunks` table migration
  - `id`, `document_id`, `user_id`
  - `content`, `chunk_index`, `token_count`
  - `metadata` (JSONB: page, section, etc.)
  - `created_at`
- [x] Add RLS policies for user isolation
- [x] Create indexes for efficient querying
- [ ] Apply migration to Supabase
- [ ] Verify chunks are being stored

### Technical Decisions

#### Text Extraction Strategy: Tiered Approach
- **Tier 1 (Default): Unstructured.io OSS**
  - Why: Mature, broad format support (20+ types), good for 80% of documents
  - Use for: All initial document processing
  - Features: OCR, table extraction, layout detection, spreadsheet handling
  
- **Tier 2 (Fallback for PDFs): Docling (IBM)**
  - Why: Superior table extraction and layout analysis for complex PDFs
  - Use when: Unstructured fails on tables or structured content from PDFs
  - Best for: Academic papers, technical documents, multi-column layouts
  
- **Tier 3 (Fallback for Complex Cases): Multimodal LLM (GPT-4V/Claude 3 Vision)**
  - Why: Extract from complex diagrams, images, or layouts that parsers fail on
  - Use when: Both Unstructured and Docling fail on specific pages/documents
  - Note: Most expensive option, use sparingly

#### Service Architecture
- **Background Worker**: Python service deployed on Render.com (2GB RAM, $21/mo)
  - **Environment**: Docker (for system package support)
  - **System Dependencies**: Tesseract OCR, OpenGL (OpenCV), Poppler, Pandoc
  - **Retry Logic**: Max 3 attempts with exponential backoff
  - **Error Tracking**: Stores error messages, retry counts, timestamps
- **Queue**: pgmq (Postgres-based message queue)
- **Processing Flow**:
  1. Server action adds job to pgmq queue
  2. Python worker polls queue every 5 seconds
  3. Downloads file from Supabase Storage
  4. Extracts elements with Unstructured (strategy="auto", page breaks, table structure)
  5. Chunks elements with Unstructured by_title strategy
  6. Extracts comprehensive metadata (pages, coordinates, tables, links)
  7. Stores chunks in Postgres
  8. Updates document status
  9. Real-time UI update via Supabase Realtime
  10. Orphaned job cleanup (deletes jobs for deleted documents)

#### Other Decisions
- **Chunking strategy**: by_title (respects section boundaries, never splits titles)
- **Chunk size**: 1200 char soft max, 2000 char hard max (balance context and precision)
- **Overlap**: 100 characters between chunks
- **Deployment**: Render.com Background Worker with 2GB RAM for "auto" strategy
- **File types**: PDF, DOC, DOCX, TXT, MD, HTML, XML, CSV, XLSX, PPTX

---

## Phase 4: Vector Embeddings & Semantic Search

### Goals
- Generate embeddings for all text chunks (or summaries)
- Enable semantic search across documents
- Implement efficient vector similarity search
- Optional: LLM-enhanced chunk summaries for better retrieval

### Tasks

#### 📝 Chunk Summaries (Optional Enhancement)
- [ ] Add `chunk_summary` column to chunks table
- [ ] Generate context-aware summaries with GPT-4o Mini
- [ ] Include surrounding chunk context when summarizing
- [ ] Store both original content and summary
- [ ] Backfill summaries for existing chunks
- [ ] Decide: Embed summaries vs original content

#### 🧮 Embeddings Generation
- [ ] Setup pgvector extension (already installed)
- [ ] Create `embeddings` table
  - `id`, `chunk_id`, `document_id`, `user_id`
  - `embedding` (vector(1536) for OpenAI)
  - `model`, `created_at`
- [ ] Integrate OpenAI Embeddings API (or alternatives)
- [ ] Generate embeddings for all chunks (or summaries)
- [ ] Store embeddings with chunk references
- [ ] Add HNSW index for fast similarity search

#### 🔍 Semantic Search
- [ ] Implement vector similarity search
- [ ] Add search API endpoint
- [ ] Create search UI component
- [ ] Show relevant chunks with context
- [ ] Highlight matching text
- [ ] Link back to source documents

#### ⚡ Performance Optimization
- [ ] Batch embedding generation (reduce API calls)
- [ ] Implement embedding caching
- [ ] Add rate limiting for API calls
- [ ] Monitor embedding costs

### Technical Decisions
- **Embedding model**: OpenAI `text-embedding-3-small` (1536 dimensions, cost-effective)
- **Vector index**: HNSW for fast approximate nearest neighbor search
- **Similarity metric**: Cosine similarity (standard for embeddings)

---

## Phase 5: Graph RAG - Knowledge Extraction

### Goals
- Extract entities and relationships from documents
- Build knowledge graph for advanced querying
- Enable graph-based retrieval

### Tasks

#### 🕸️ Graph Database Schema
- [ ] Create `entities` table
  - `id`, `document_id`, `user_id`
  - `name`, `type`, `description`
  - `metadata` (JSONB)
  - `created_at`
- [ ] Create `relationships` table
  - `id`, `source_entity_id`, `target_entity_id`
  - `relationship_type`, `description`
  - `confidence_score`
  - `document_id`, `user_id`
- [ ] Add indexes for graph traversal
- [ ] Implement RLS policies

#### 🤖 Entity Extraction
- [ ] Integrate LLM for entity extraction (GPT-4, Claude)
- [ ] Define entity types (Person, Organization, Concept, etc.)
- [ ] Extract entities from chunks
- [ ] Deduplicate entities across documents
- [ ] Store entity metadata

#### 🔗 Relationship Extraction
- [ ] Extract relationships between entities
- [ ] Classify relationship types
- [ ] Calculate confidence scores
- [ ] Handle multi-hop relationships
- [ ] Store relationship metadata

#### 📊 Graph Visualization
- [ ] Integrate graph visualization library (D3.js, Cytoscape, React Flow)
- [ ] Create interactive graph view
- [ ] Show entity details on hover
- [ ] Enable graph exploration (zoom, pan, filter)
- [ ] Highlight paths between entities

### Technical Decisions
- **LLM for extraction**: GPT-4 or Claude (better reasoning for complex relationships)
- **Graph library**: React Flow (React-native, good performance)
- **Entity deduplication**: Fuzzy matching + embedding similarity

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

### Tasks

#### 📄 Document Details Page (`/documents/[id]`)
- [ ] Create dynamic route for document details
- [ ] Implement document details page layout
- [ ] Add breadcrumb navigation (Documents → [Document Name])

#### 📊 Core Overview Section
- [ ] Display document header
  - File name, upload timestamp, owner (if multi-user)
  - Current status with badge (uploaded/processing/ready/error)
- [ ] Show quick stats cards
  - File size, page count (if available)
  - Total chunk count, total tokens
  - Last processed timestamp, processing duration

#### 🗂️ Metadata & Context Section
- [ ] Display source metadata
  - Storage path, MIME type
  - File hash/checksum (if tracked)
  - Processing duration, retry count
- [ ] Show processing timeline
  - Ordered log of status transitions
  - Timestamps for each state change
  - Helpful for debugging ingestion issues

#### ✂️ Chunks Section
- [ ] Create chunks table/list view
  - Chunk index, text preview (first 100 chars)
  - Token count, embedding status (Phase 4)
- [ ] Add chunk search/filter
  - Search within chunks
  - Filter by token count range
- [ ] Implement chunk drilldown
  - Side panel or modal for full chunk text
  - Display chunk metadata (level, entities, etc.)
  - Show embedding status and vector (Phase 4)

#### 📥 Original Asset Access
- [ ] Add download button
  - Generate signed URL from Supabase Storage
  - Direct download of original file
- [ ] Optional: Inline viewer
  - PDF viewer for PDFs (if lightweight)
  - Markdown preview for .md files
  - Text display for .txt files
  - Keep simple, fallback to download for complex formats

#### 🔮 Future-Ready Sections (Placeholders)
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

#### ⚡ Action Bar
- [ ] Add action buttons
  - Reprocess document (requeue)
  - Delete document (with confirmation)
  - Download original file
  - Copy shareable link (future)
- [ ] Add debug tools
  - View worker logs filtered to this document
  - Requeue for processing
  - View raw metadata JSON

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

### Phase Rollout
1. **Phase 7.1**: Core overview + metadata + download ✅
2. **Phase 7.2**: Chunks table + search + drilldown ✅
3. **Phase 7.3**: Processing timeline + action bar
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

### 2025-10-14
- ✅ Completed Phase 1: Core Upload Infrastructure
- ✅ Implemented background processing queue with pgmq
- ✅ Deployed Edge Function worker
- ✅ Setup cron job for automatic processing
- 🔄 Started Phase 2: Real-time status updates

---

**Next Session**: Implement real-time status updates with Supabase Realtime
