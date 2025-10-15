# Mosaic RAG Platform - Build Plan

**Last Updated:** October 14, 2025  
**Status:** Phase 1 Complete - Background Processing Active

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

## Phase 2: Real-Time Status Updates 🔄 IN PROGRESS

### Goals
- Users see document status changes without refreshing
- Live updates as documents move through processing pipeline
- Better UX with instant feedback

### Tasks

#### 🔄 Supabase Realtime Integration
- [ ] Subscribe to `documents` table changes
- [ ] Update UI when status changes
- [ ] Show processing progress indicators
- [ ] Handle connection states (connecting, connected, error)

#### 🔄 UI Enhancements
- [ ] Add status badges with animations
- [ ] Show "Processing..." spinner for active documents
- [ ] Toast notifications for status changes
- [ ] Optimistic updates for better perceived performance

### Implementation Notes
```typescript
// Subscribe to document changes
const subscription = supabase
  .channel('documents')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Update UI with new status
  })
  .subscribe()
```

---

## Phase 3: Document Processing Pipeline

### Goals
- Extract text from various document formats
- Implement intelligent chunking strategies
- Store chunks with metadata for retrieval

### Tasks

#### 📄 Text Extraction
- [ ] Integrate Unstructured.io OSS or Docling
- [ ] Support PDF text extraction
- [ ] Support DOCX text extraction
- [ ] Support TXT/MD direct reading
- [ ] Preserve document structure (headers, sections)
- [ ] Extract tables and maintain formatting
- [ ] Handle multi-column layouts

#### ✂️ Text Chunking
- [ ] Implement semantic chunking (sentence boundaries)
- [ ] Implement fixed-size chunking with overlap
- [ ] Implement recursive chunking for long documents
- [ ] Add metadata to chunks (page numbers, section headers)
- [ ] Configurable chunk size (default: 512-1024 tokens)
- [ ] Configurable overlap (default: 50-100 tokens)

#### 🗄️ Chunks Database
- [ ] Create `chunks` table
  - `id`, `document_id`, `user_id`
  - `content`, `chunk_index`, `token_count`
  - `metadata` (JSONB: page, section, etc.)
  - `created_at`
- [ ] Add RLS policies for user isolation
- [ ] Create indexes for efficient querying

### Technical Decisions
- **Unstructured vs Docling**: Start with Unstructured (more mature), evaluate Docling for complex PDFs
- **Chunking strategy**: Semantic chunking with overlap for better context preservation
- **Chunk size**: 512 tokens (balance between context and precision)

---

## Phase 4: Vector Embeddings & Semantic Search

### Goals
- Generate embeddings for all text chunks
- Enable semantic search across documents
- Implement efficient vector similarity search

### Tasks

#### 🧮 Embeddings Generation
- [ ] Setup pgvector extension (already installed)
- [ ] Create `embeddings` table
  - `id`, `chunk_id`, `document_id`, `user_id`
  - `embedding` (vector(1536) for OpenAI)
  - `model`, `created_at`
- [ ] Integrate OpenAI Embeddings API (or alternatives)
- [ ] Generate embeddings for all chunks
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

## Phase 7: Polish & Production Readiness

### Goals
- Improve user experience
- Add missing features
- Prepare for production deployment

### Tasks

#### 🎨 UX Improvements
- [ ] Add multiple file upload support
- [ ] Implement drag-and-drop for multiple files
- [ ] Show upload queue with progress for each file
- [ ] Add document download functionality
- [ ] Implement document preview
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
