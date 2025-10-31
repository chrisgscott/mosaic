# Mosaic RAG Platform - Master Build Plan

**Last Updated:** October 30, 2025  
**Status:** Production-Ready Core Pipeline + Active Enhancement Development

---

## Executive Summary

Mosaic is a comprehensive RAG platform combining semantic search with graph-based knowledge extraction. The core pipeline is production-ready with document upload, processing, embeddings, graph extraction, and search working across all document types. Current development focuses on advanced features and user experience enhancements.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│  Upload → Processing → Search → Chat → Knowledge Graph       │
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐          │
│  │ Supabase │ →  │   pgmq   │ →  │ Edge Function│          │
│  │ Storage  │    │  Queue   │    │   Worker     │          │
│  └──────────┘    └──────────┘    └──────────────┘          │
│                                           ↓                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Document Processing Pipeline                   │   │
│  │  Extract → Chunk → Embed → Graph → Living Entities    │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Storage Layer (Postgres)                    │   │
│  │  • Vector Store (pgvector)                           │   │
│  │  • Graph Database (entities + relationships)         │   │
│  │  • Living Entities (curated knowledge)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Search & Query Interface                       │   │
│  │  Hybrid Search (Semantic + BM25 + Graph + Rerank)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Completed Features ✅

### Phase 1: Core Infrastructure
- Document upload with Supabase Storage
- Background processing with pgmq
- Real-time status updates
- Multi-file upload support

### Phase 2: Document Processing
- VLM-powered extraction with Docling
- Structure-aware chunking
- Agentic chunking for complex documents
- Document augmentation (question generation)
- Planner-executor chunking for large docs
- Sorting Hat intelligent routing

### Phase 3: Knowledge Graph
- Automatic entity and relationship extraction
- Performance optimizations (caching, rate limiting)
- Relationship extraction fixes
- Graph-enhanced search

### Phase 4: Search & RAG
- Hybrid search (semantic + BM25)
- Query enhancement (HyDE, Multi-Query)
- Cohere reranking
- RAG chat interface with streaming
- Source citations and links

### Phase 5: Configuration & Management
- Centralized model configuration
- Prompt management system
- Settings-driven operation
- AI Gateway integration

---

## Current Development 🚧

### Phase 6: Advanced RAG Features

#### 6.1 Vercel AI SDK Tool-Based Architecture
**Status:** Phase 1 complete, Phase 2 ready to start  
**Priority:** High (Daily QoL improvement)  
**Estimated:** 2-3 days for Phase 2

**Current State:**
- Phase 1 (message persistence) completed
- Chat always calls search endpoint (not optimal)

**Phase 2: Tool-Based Search**
- Make search a tool (AI decides when to search)
- Enable multi-step reasoning
- Add knowledge management tools
- Optimize with caching

**Benefits:**
- More natural conversation flow
- Fewer unnecessary searches (30-50% reduction)
- Can search multiple times per query
- Better AI decision-making
- Aligns with industry best practices

#### 6.2 Conversation Features
**Status:** Scheduled  
**Priority:** High  
**Estimated:** 3-4 days

**Features:**
- Conversation persistence in database
- Thread management UI
- Conversation search
- Export functionality

**Rationale:** Foundation for context management and better UX

#### 6.3 Grounding Controls
**Status:** Ready to start  
**Priority:** High  
**Estimated:** 2-3 days

**Features:**
- Toggle between strict grounding vs interpretive analysis
- Clear labeling of facts vs AI inference
- User trust improvements
- Answer quality indicators

#### 6.4 Context Management
**Status:** Planning  
**Priority:** High  
**Estimated:** 2-3 days

**Features:**
- Token counting and window management
- Smart chunk prioritization
- Conversation summarization
- Cost tracking per user

**Implementation:**
- Add token estimation utilities
- Implement context window limits
- Create chunk prioritization algorithms
- Add conversation compression

#### 6.5 Entity Deduplication During Extraction
**Status:** Ready to start  
**Priority:** Medium  
**Estimated:** 2-5 days (phased)

**Current State:** Entities are extracted without checking for existing duplicates, leading to graph pollution.

**Implementation Phases:**
- **Phase 1:** Simple exact matching (1-2 days)
- **Phase 2:** Fuzzy matching with confidence scores (2-3 days)  
- **Phase 3:** LLM-powered contextual resolution (future)

**Benefits:**
- Cleaner knowledge graph
- Better relationship accumulation
- Improved search quality
- Prevention vs cure approach

**Implementation Approach:**
```python
def extract_entities_with_dedup(text, existing_entities):
    potential = llm_extract_entities(text)
    resolved = []
    
    for entity in potential:
        match = find_exact_match(entity.name, existing_entities)
        if match:
            resolved.append(match)  # Use existing
        else:
            resolved.append(create_entity(entity))  # Create new
    
    return resolved
```

#### 6.6 Intelligent Query Caching
**Status:** Ready to start  
**Priority:** High (quick win)  
**Estimated:** 1-2 days for Phase 1

**Current State:**
- No caching, every search runs full pipeline (500-1000ms)
- Significant performance improvement opportunity

**Phase 1: Simple Query Cache with TTL**
- Cache exact query matches with 1-hour TTL
- Use Redis or Supabase cache
- Expected: 30-50% cache hit rate
- Result: <50ms response for cached queries (10-20x faster)

**Implementation Approach:**
```typescript
// Simple cache wrapper
async function searchWithCache(query: string) {
  const cacheKey = `search:${hash(query)}`
  const cached = await cache.get(cacheKey)
  
  if (cached) return cached
  
  const result = await fullSearchPipeline(query)
  await cache.set(cacheKey, result, { ttl: 3600 })
  return result
}
```

**Benefits:**
- Immediate user experience improvement
- Reduced API costs
- Foundation for advanced caching (semantic, prediction)

**Future Phases:**
- Phase 2: Semantic cache matching (2-3 days)
- Phase 3: Smart pre-computation (2-3 days)
- Phase 4: Query prediction (2-3 days)

#### 6.7 Schema Analytics & Usage Tracking
**Status:** Ready to start  
**Priority:** Medium  
**Estimated:** 2-3 days

**Current State:**
- Custom entity/relationship types implemented
- No visibility into which types are actively used
- Users cannot identify unused or redundant types

**Features:**
- Display active usage count for each entity type
- Display active usage count for each relationship type
- Show last used date for each type
- Identify unused types for cleanup
- Export usage analytics

**Implementation Approach:**
```sql
-- Query to get entity type usage
SELECT 
  e.type,
  COUNT(*) as entity_count,
  MAX(e.created_at) as last_used
FROM entities e
GROUP BY e.type
ORDER BY entity_count DESC;

-- Query to get relationship type usage
SELECT 
  r.relationship_type,
  COUNT(*) as relationship_count,
  MAX(r.created_at) as last_used
FROM relationships r
GROUP BY r.relationship_type
ORDER BY relationship_count DESC;
```

**UI Updates:**
- Add usage counts to Schema Configuration page
- Color-code unused types (gray)
- Show "Last used" column
- Add "Clean up unused types" button

**Benefits:**
- Users can identify which types add value
- Ability to clean up unused schema elements
- Better understanding of graph composition
- Data-driven schema management

---

## Future Roadmap 🗺️

### Phase 7: Knowledge Graph Enhancement

#### 7.1 DEG-RAG Implementation
**Status:** Reference available  
**Priority:** Medium  
**Estimated:** 1-2 weeks

**Features:**
- Entity resolution across documents
- Relationship pruning and validation
- Evidence-based verification
- Directionality corrections

#### 7.2 Graph Learning
**Status:** Phases 1-3 complete  
**Priority:** Medium  
**Estimated:** 1 week

**Features:**
- Search signal capture and analysis
- Relationship suggestion from patterns
- Automatic graph improvement
- Query-driven expansion

#### 7.3 Living Entities System
**Status:** Database Schema Ready  
**Priority:** Medium  
**Estimated:** 2-3 weeks

**Features:**
- CrewAI agent system for entity curation
- Template-based entity pages (materials, mines, suppliers, etc.)
- Automated updates from new document insights
- Bridge table linking raw graph to curated entities
- Entity versioning and audit trail

**Implementation:**
- [ ] CrewAI agent configuration for entity types
- [ ] Entity page templates and UI components
- [ ] Automated update triggers from graph changes
- [ ] Entity relationship management
- [ ] Search integration for living entities

#### 7.4 Multi-Floor Architecture
**Status:** Conceptual  
**Priority:** Low  
**Estimated:** 2-3 weeks

**Features:**
- Temporal graph traversal
- "As-of" queries for point-in-time views
- Diff trails for change tracking
- Floor-to-floor navigation UI

### Phase 8: Advanced Features

#### 8.1 Structured Data & Spreadsheet Intelligence
**Status:** Ready to start  
**Priority:** Medium-High (for financial/enterprise implementations)  
**Estimated:** 2-3 days (Phase 1) + 1-2 days (Phase 2)

**Strategic Importance:**
- Critical for financial analysis use cases
- Some Mosaic implementations will be heavily spreadsheet-dependent
- Key differentiator for enterprise customers
- Positioned as advanced feature for end of Phase 1

**Phase 1: Document-Level Narratives** (2-3 days, ~$0.05/CSV)
- Detect CSV/XLSX uploads
- Generate single document-level summary:
  - What the data represents
  - Key columns and their purposes
  - Data quality observations (missing values, outliers)
  - Notable patterns or characteristics
  - Potential use cases
- Embed summary alongside table chunks
- Skip: Column narratives, trends, anomalies (too expensive)
- Skip: Long-table format (storage explosion)

**Phase 2: Optional Deep Analysis** (User-triggered, 1-2 days)
- Add "Analyze Data" button for CSVs
- User can trigger expensive analysis on-demand:
  - Statistical analysis
  - Trend detection
  - Anomaly identification
  - Column-specific narratives
- Show cost estimate before processing
- Cost: ~$0.20-0.50 per CSV (multiple LLM calls)

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
- Phase 1: $0.05 per CSV → $5/month for 100 CSVs
- Phase 2: $0.20-0.50 per CSV (user-triggered)
- Significant improvement for spreadsheet discovery
- Users can find relevant CSVs via summaries

#### 8.2 Advanced AI Features
**Status:** Planned  
**Priority:** Low  
**Estimated:** 2-3 weeks

**Features:**
- Complex query decomposition
- Multi-hop reasoning across floors
- Advanced context management
- Custom AI tool development

#### 8.2 Performance Optimizations
**Status:** Continuous  
**Priority:** Ongoing  
**Estimated:** Ongoing

**Features:**
- Caching middleware for search results
- Parallel processing improvements
- Database query optimization
- Response time improvements

---

## Phase 9: Living Data & Versioning

### 9.1 Living Data - Iterative Updates & Version Tracking
**Status:** Planned  
**Priority:** Medium-High  
**Estimated:** 6-10 weeks

**Goal:** Support evolving, mutable data with full version history and chat-driven updates

**Use Cases:**
- Ideation & Brainstorming with iterative refinement
- Project planning with evolving concepts
- Knowledge refinement through user feedback
- Collaborative research with shared knowledge
- Living documentation that updates with new insights

**Implementation Phases:**

**Phase 1: Mutable Entity System (1-2 weeks)**
- Add `entity_source` field: 'extracted' | 'created' | 'hybrid'
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

---

## Phase 10: External Integration & Ecosystem

### 10.1 MCP Server for External Tool Integration
**Status:** Planned  
**Priority:** Medium-High  
**Estimated:** 1-2 weeks

**Goal:** Provide Model Context Protocol server for n8n, Make, Zapier, Claude Desktop, and other AI tools

**Why MCP:**
- Standard protocol for AI/automation tool integration
- Automatic schema discovery and validation
- Single server exposes multiple tools and resources
- Native support in Claude Desktop, Cline, and emerging AI platforms

**Implementation Phases:**

**Phase 1: Core MCP Server (2-3 days)**
- Set up MCP SDK (`@modelcontextprotocol/sdk`)
- Implement HTTP transport with API key auth
- Expose search functionality as MCP tool
- Expose graph operations as MCP tools
- Expose document management as MCP resources

**Phase 2: Tool Definitions (2-3 days)**
- Search documents with filters
- Create/update entities
- Query relationships
- Upload and process documents
- Export search results

**Phase 3: Resource Management (2-3 days)**
- Document collections as resources
- Entity graphs as resources
- Living entities as resources
- Change notifications via MCP
- Batch operations support

**Phase 4: Integration Examples (1-2 days)**
- n8n node examples
- Claude Desktop integration guide
- Make/Zapier webhooks
- Custom AI assistant integration

### 10.2 Entity Type Management
**Status:** Planned  
**Priority:** High  
**Estimated:** 3-5 days

**Features:**
- Dynamic entity type configuration
- Custom entity type creation
- Type-specific validation rules
- Relationship type management
- Source document references

---

## Technical Debt & Maintenance 🔧

### High Priority
- [ ] Comprehensive test suite
- [ ] Error handling improvements
- [ ] Logging and monitoring
- [ ] Documentation updates

### Medium Priority
- [ ] Code refactoring for consistency
- [ ] Dependency updates
- [ ] Security audit
- [ ] Performance profiling

### Low Priority
- [ ] UI/UX polish
- [ ] Accessibility improvements
- [ ] Internationalization
- [ ] Mobile app

---

## Resource Allocation 📊

### Development Focus (Next 12 Weeks)

#### Short Term (Weeks 1-4): Core RAG Enhancement
1. **Week 1-2:** Vercel AI SDK Tool-Based Architecture (Phase 2) - Daily QoL
2. **Week 2-3:** Conversation Features & Grounding Controls
3. **Week 4:** Context Management (builds on conversations)
4. **Week 5:** Entity Deduplication During Extraction (Phase 1)
5. **Week 6:** Intelligent Query Caching (Phase 1) - Quick win
6. **Week 7:** Schema Analytics & Usage Tracking
7. **Week 8:** DEG-RAG Planning & Setup

#### Medium Term (Weeks 5-8): Knowledge Graph & Living Entities
1. **Week 5-6:** DEG-RAG Implementation
2. **Week 7:** Graph Learning & Relationship Expansion
3. **Week 8:** Living Entities System (CrewAI integration)

#### Long Term (Weeks 9-12): Advanced Features
1. **Week 9:** Structured Data & Spreadsheet Intelligence (Phase 1)
2. **Week 9-10:** Multi-Floor Architecture
3. **Week 11:** Living Data & Versioning (Phase 1-2)
4. **Week 12:** MCP Server & External Integration

### Testing & QA
- Continuous integration testing
- User acceptance testing
- Performance benchmarking
- Security scanning

### Documentation
- API documentation
- User guides
- Developer documentation
- Deployment guides

---

## Success Metrics 📈

### Performance Targets
- **Document Processing:** < 3 minutes for 100-page doc
- **Search Response:** < 2 seconds
- **Chat Response:** < 5 seconds with streaming
- **Graph Extraction:** < 5 minutes with optimizations

### Quality Targets
- **Search Relevance:** > 85% user satisfaction
- **Answer Accuracy:** > 90% factual correctness
- **System Uptime:** > 99.5%
- **Error Rate:** < 1%

### Usage Targets
- **Document Processing:** 1000+ documents/day
- **Search Queries:** 10000+ queries/day
- **Chat Sessions:** 1000+ sessions/day
- **Concurrent Users:** 100+ simultaneous

---

## Dependencies & Risks ⚠️

### External Dependencies
- **OpenAI API:** Rate limits and pricing changes
- **Supabase:** Service reliability and feature updates
- **Vercel:** Deployment platform stability
- **Cohere:** Reranking service availability

### Mitigation Strategies
- Multiple model providers via AI Gateway
- Graceful degradation for service outages
- Local caching for critical operations
- Monitoring and alerting for all services

### Phase 15: Inline Citations with Deep-Linking
**Status:** Ready for Implementation  
**Effort:** 1 week  
**Priority:** High  

**Objective:** Implement Perplexity-style inline citations with hover previews and deep-linking to specific chunks in Docling documents.

**Implementation Phases:**

**Phase 15.1: Store Docling Metadata (1-2 days)**
- Update chunkers to preserve Docling identifiers
- Store JSON pointers (`#/texts/5`) in chunk metadata
- Preserve page numbers and bounding boxes
- Enable direct navigation to specific elements

**Phase 15.2: Add shadcn Components (1 day)**
- Install required shadcn components
- Create custom inline citation component
- Based on Vercel AI Elements (Apache 2.0)

**Phase 15.3: Update Chat Response (2 days)**
- Parse citations in AI responses
- Render inline badges instead of end sources
- Structured citation data in backend
- Mobile touch support

**Phase 15.4: Document Viewer Enhancement (1 day)**
- Accept chunk ID in URL/hash
- Scroll to and highlight chunk
- Show chunk in full context

**Phase 15.5: Integration & Testing (1 day)**
- End-to-end citation flow
- Mobile responsiveness
- Performance optimization

**Key Components:**
- shadcn Inline Citation Component
- Docling deep-link support
- Enhanced citation URLs
- Document viewer hash navigation

---

### Phase 16: shadcn AI Components UI Modernization
**Status:** Ready for Implementation  
**Effort:** 1 week  
**Priority:** High  

**Objective:** Transform chat, search, and overall AI interface from functional to professional-grade using shadcn AI components.

**Available Components (18 total):**
- Core Chat: Conversation, Message, PromptInput, Response
- Citations: InlineCitation, Source, WebPreview
- Advanced: Tool, Reasoning, Actions, Loader, CodeBlock
- Utility: Branch, Image, Suggestion, Task

**Implementation Phases:**

**Phase 16.1: Chat Interface Overhaul (2-3 days)**
- Replace chat-client.tsx with new components
- Add Conversation with auto-scroll
- Implement Message with avatars
- Add PromptInput with toolbar
- Integrate Response component with streaming

**Phase 16.2: Search Results Enhancement (1-2 days)**
- Replace sources.tsx with InlineCitation
- Add WebPreview for URL sources
- Enhance result cards with new styling

**Phase 16.3: Advanced Features (2-3 days)**
- Show tool calls (graph search, entity extraction)
- Display reasoning steps for transparency
- Add action buttons (copy, regenerate, share)
- Implement conversation branching

**Key Benefits:**
- Professional ChatGPT/Perplexity-style interface
- Better UX with smooth scrolling and proper layout
- Streaming support with partial markdown handling
- Mobile-optimized with touch interactions
- Accessibility with ARIA labels and keyboard nav
- Transparency with tool calls and reasoning

---

## Documentation Structure 📚

### Single Sources of Truth (SSoT)
- **[Architecture SSoT](./docs/architecture/SSOT.md)** - System design and principles
- **[Features SSoT](./docs/features/SSOT.md)** - Feature documentation and status
- **[Guides SSoT](./docs/guides/SSOT.md)** - User and developer guides
- **[Reference SSoT](./docs/reference/SSOT.md)** - Technical reference library
- **[Completed SSoT](./docs/completed/SSOT.md)** - Implementation archive

### Supporting Documents
- **Executive Documents** (ORIENTATION.md, SYNTHESIS.md) - Project overview and direction
- **Planning Documents** - Detailed phase planning and proposals
- **Reference Materials** - External research and best practices

---

## Decision Log 📝

### Key Architectural Decisions
1. **Postgres-Native Stack:** All data in Supabase for simplicity
2. **Human-AI Parity:** Same graph traversal for both users and AI
3. **Modular Chunking:** Fast default with optional LLM enhancement
4. **Unified Search:** Same pipeline for search and chat
5. **Settings-Driven:** All configuration via database

### Recent Changes
- Moved from raw OpenAI SDK to Vercel AI SDK
- Implemented centralized model configuration
- Added prompt management system
- Optimized graph extraction performance

---

*This master plan integrates all SSoT documents and provides the authoritative roadmap for Mosaic development. For detailed implementation information, refer to the specific SSoT documents linked throughout.*
