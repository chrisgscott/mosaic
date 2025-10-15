# Future Enhancements & Advanced Patterns

This document captures advanced RAG patterns and optimizations that could be applied to Mosaic.

**Note:** Many enhancements have been migrated to BUILD_PLAN.md. This file now contains only patterns not yet scheduled for implementation.

---

## 🎯 LLM-Enhanced Chunk Summaries ✅ MIGRATED TO BUILD_PLAN (Phase 4)

### Concept
Generate AI summaries of chunks that are more "sticky" for vector/graph search while preserving original content.

### Implementation Options
**Option A: Metadata Storage (Previous Projects)**
- Store original chunk text in metadata field
- Use summary as primary searchable content

**Option B: Dual Column Approach (Recommended for Mosaic)**
```sql
ALTER TABLE chunks ADD COLUMN chunk_summary TEXT;
ALTER TABLE chunks RENAME COLUMN content TO original_content;
-- Keep both original_content and chunk_summary
```

### Key Requirement
⚠️ **Context-Aware Summarization**: Summaries must be generated with surrounding chunk context, not in isolation. This preserves meaning and relationships between chunks.

### Benefits
- Better semantic search results
- More relevant retrieval
- Improved graph entity extraction from summaries

---

## 🏗️ Hierarchical Chunking

### Concept
Multi-layer chunk hierarchy allowing AI to navigate up/down for context or detail.

### Architecture
```
Document
  ↓
Page/Chapter Chunks (Layer 3 - Broadest)
  ↓
Context Chunks (Layer 2 - Medium)
  ↓
Atomic Chunks (Layer 1 - Single concepts/ideas)
```

### Schema Design
```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  content TEXT,
  chunk_level INTEGER, -- 1=atomic, 2=context, 3=page/chapter
  parent_chunk_id UUID REFERENCES chunks(id), -- Link to parent
  child_chunk_ids UUID[], -- Array of child chunk IDs
  ...
);
```

### Use Cases
- **Need more context?** → Navigate up to parent chunk
- **Need more detail?** → Navigate down to child chunks
- **Adaptive retrieval** → Start at appropriate level based on query

### Benefits
- AI can dynamically adjust context window
- Better handling of complex documents
- Preserves document structure

---

## 🤖 Agentic/LLM-Based Chunking

### Concept
Let an LLM decide chunk boundaries based on semantic meaning rather than fixed sizes.

### Implementation
- Set min/max chunk size boundaries
- LLM analyzes content and determines optimal split points
- Chunks based on concepts, topics, or natural breaks

### Trade-offs
**Pros:**
- More semantically coherent chunks
- Better preservation of meaning
- Context-aware boundaries

**Cons:**
- ⚠️ **Expensive** - LLM call per chunk decision
- ⚠️ **Time-consuming** - Significantly slower ingestion
- ⚠️ **ROI unclear** - May not justify cost/time investment

### Recommendation
Consider for high-value documents only, or as an optional "premium" processing mode.

---

## ⚡ Lazy Processing Pattern

### Concept
Move expensive operations from ingestion → retrieval to only process what's actually used.

### What to Move to Retrieval
- **Embeddings generation** - Only embed chunks that get retrieved
- **Entity extraction** - Only extract entities from accessed chunks
- **Summarization** - Generate summaries on-demand
- **Translation** - Translate only when needed

### What to Keep in Ingestion
- **Text extraction** - Must happen upfront
- **Basic chunking** - Foundation for everything else
- **Metadata extraction** - File info, dates, etc.

### Implementation Strategy
```python
# Ingestion: Minimal processing
def ingest_document(doc):
    text = extract_text(doc)
    chunks = chunk_text(text)
    store_chunks(chunks)  # No embeddings yet!
    
# Retrieval: On-demand processing
def retrieve_chunks(query):
    # Generate query embedding
    query_embedding = embed(query)
    
    # Find candidate chunks (keyword/BM25)
    candidates = keyword_search(query)
    
    # Generate embeddings for candidates only
    for chunk in candidates:
        if not chunk.embedding:
            chunk.embedding = embed(chunk.content)
            update_chunk(chunk)
    
    # Now do vector search
    results = vector_search(query_embedding, candidates)
    return results
```

### Benefits
- ⚡ **Faster ingestion** - Documents ready immediately
- 💰 **Cost savings** - Only process what's used
- 🎯 **Better ROI** - No wasted processing on unused content
- 📈 **Scales better** - Large document sets don't require massive upfront processing

### Trade-offs
- First retrieval is slower (cold start)
- Need caching strategy for frequently accessed chunks
- More complex retrieval logic

### Hybrid Approach
- Process popular/recent documents eagerly
- Process older/rarely accessed documents lazily
- Use access patterns to decide processing strategy

---

## 📊 Structured Data & Spreadsheet Chunking

### Concept
Specialized chunking strategy for spreadsheets, CSV files, and other structured/tabular data that differs from traditional text-based chunking.

### The Challenge
Traditional text chunking doesn't work well for structured data:
- Row-by-row splitting loses column context
- Column headers get separated from data
- Relationships between cells are lost
- Numerical patterns and trends become invisible

### Narrative Generation Approach

**Transform structured data into natural language narratives** that can be chunked and searched semantically.

**Example Transformation:**
```
Raw Spreadsheet:
| Product | Q1 Sales | Q2 Sales | Growth |
|---------|----------|----------|--------|
| Widget A| $50,000  | $65,000  | 30%    |

Generated Narrative:
"Widget A demonstrated strong performance in the first half of the year. 
Q1 sales reached $50,000, followed by Q2 sales of $65,000, representing 
a 30% quarter-over-quarter growth rate. This upward trend indicates 
increasing market demand for Widget A."
```

### Long-Table Approach

**Preserve tabular structure while making it searchable** by converting wide tables into long-format with descriptive keys.

**Example Transformation:**
```
Wide Format (Original):
| Product  | Q1_Sales | Q2_Sales | Q3_Sales |
|----------|----------|----------|----------|
| Widget A | 50000    | 65000    | 72000    |

Long Format (Searchable):
| Entity   | Metric    | Period | Value  | Context                           |
|----------|-----------|--------|--------|-----------------------------------|
| Widget A | Sales     | Q1     | 50000  | Product: Widget A, Quarter: Q1    |
| Widget A | Sales     | Q2     | 65000  | Product: Widget A, Quarter: Q2    |
| Widget A | Sales     | Q3     | 72000  | Product: Widget A, Quarter: Q3    |
| Widget A | Growth    | Q1-Q2  | 30%    | Widget A growth from Q1 to Q2     |
```

### Implementation Strategies

**1. Hybrid Approach (Recommended)**
- Store original structured data as-is
- Generate narrative chunks for semantic search
- Generate long-table format for precise queries
- Link all formats to original source

**2. Metadata-Rich Chunks**
```json
{
  "chunk_id": "uuid",
  "content": "Widget A Q1 sales: $50,000",
  "metadata": {
    "source_type": "spreadsheet",
    "sheet_name": "Sales_2024",
    "row": 5,
    "columns": ["Product", "Q1_Sales"],
    "entity": "Widget A",
    "metric": "Sales",
    "period": "Q1_2024",
    "value": 50000,
    "value_type": "currency"
  }
}
```

**3. Multi-Granularity Chunking**
- **Cell-level**: Individual data points with full context
- **Row-level**: Complete records with all attributes
- **Section-level**: Related rows (e.g., all Q1 data)
- **Sheet-level**: Summary of entire sheet/table

### Benefits

**Narrative Approach:**
- ✅ Natural language queries work better
- ✅ LLMs can understand context and trends
- ✅ Better for semantic search and RAG
- ✅ Humans can read and verify results

**Long-Table Approach:**
- ✅ Preserves exact values and relationships
- ✅ Enables precise filtering and aggregation
- ✅ Maintains data integrity
- ✅ Supports analytical queries

### Use Cases

**Best for Narrative Generation:**
- Financial reports with trends
- Performance dashboards
- Survey results with insights
- Time-series data with patterns

**Best for Long-Table Format:**
- Large datasets with many columns
- Data requiring exact value lookup
- Multi-dimensional analysis
- Aggregation and filtering needs

### Trade-offs

**Narrative Generation:**
- ⚠️ **Expensive** - LLM calls to generate narratives
- ⚠️ **Slower** - Processing time increases significantly
- ⚠️ **Accuracy** - Generated text may introduce interpretation
- ⚠️ **Storage** - Duplicates data (original + narrative)

**Long-Table Format:**
- ⚠️ **Storage** - Explodes row count (wide → long)
- ⚠️ **Complexity** - More complex query logic
- ⚠️ **Processing** - Transformation overhead

### Research Needed

Before implementing, evaluate:
1. **ROI Analysis** - Cost vs. benefit for your use cases
2. **Volume Assessment** - How many spreadsheets will you process?
3. **Query Patterns** - What types of questions will users ask?
4. **Accuracy Testing** - How well do narratives preserve meaning?
5. **Performance Benchmarks** - Processing time and storage costs
6. **User Testing** - Do users prefer narrative or structured results?

### Recommended Approach

**Start Simple:**
1. Phase 1: Store spreadsheets as-is, extract basic metadata
2. Phase 2: Test narrative generation on sample files
3. Phase 3: Measure search quality improvement
4. Phase 4: Evaluate if ROI justifies the complexity

**Only implement if:**
- Users frequently query structured data
- Semantic search on tables is critical
- Budget allows for LLM-based transformation
- Testing shows significant quality improvement

### Alternative: Structured Data Plugins

Consider specialized tools:
- **Pandas AI** - Natural language queries on DataFrames
- **LlamaIndex Structured Data** - Pre-built structured data loaders
- **LangChain CSV/Excel Agents** - Agent-based structured data querying

These may provide better ROI than custom implementation.

---

## 👥 Collaborative Annotations & Comments ✅ MIGRATED TO BUILD_PLAN (Phase 8)

### Concept
Enable multiple users to collaborate on documents through inline comments, annotations, and @mentions, similar to Google Docs commenting functionality.

### The Challenge
Deciding where to anchor comments and annotations:
- **Source documents** (PDFs, DOCX) - Not easily editable, would require complex overlay system
- **Database chunks** - More flexible, but may not preserve exact visual context
- **Hybrid approach** - Store references to both source location and chunk

### Use Cases

**Primary Scenarios:**
- Team reviewing a contract or legal document
- Researchers collaborating on academic papers
- Editors providing feedback on content
- Subject matter experts annotating technical documents
- Compliance teams flagging issues in reports

**Key Features Needed:**
- Select text and add comment
- @mention users to notify them
- Reply to comments (threaded discussions)
- Resolve/close comments
- View comment history
- Filter by commenter, status, date

### Implementation Approaches

#### **Option 1: Chunk-Based Annotations (Recommended)**

Anchor comments to database chunks rather than source documents.

**Pros:**
- ✅ Works with any document format
- ✅ Survives document reprocessing
- ✅ Easy to query and display
- ✅ Can link to embeddings and entities
- ✅ Supports semantic search within comments

**Cons:**
- ⚠️ Loses exact visual context from original
- ⚠️ If chunks change, annotations may become orphaned
- ⚠️ Can't annotate images or diagrams

**Schema Design:**
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Text selection
  selected_text TEXT NOT NULL,
  chunk_start_offset INTEGER, -- Character offset in chunk
  chunk_end_offset INTEGER,
  
  -- Comment content
  comment_text TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'open', -- open, resolved, archived
  
  -- Threading
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

-- Indexes
CREATE INDEX idx_annotations_document ON annotations(document_id);
CREATE INDEX idx_annotations_chunk ON annotations(chunk_id);
CREATE INDEX idx_annotations_user ON annotations(user_id);
CREATE INDEX idx_annotations_status ON annotations(status);
CREATE INDEX idx_annotation_mentions_user ON annotation_mentions(mentioned_user_id);
```

#### **Option 2: Source Document Overlay (Complex)**

Create visual overlay system on rendered documents (PDFs, etc.).

**Pros:**
- ✅ Preserves exact visual context
- ✅ Works like Google Docs/Adobe Acrobat
- ✅ Can annotate images and diagrams

**Cons:**
- ⚠️ **Very complex** - Requires PDF rendering library
- ⚠️ Format-specific (different for PDF vs DOCX)
- ⚠️ Breaks if document is reprocessed
- ⚠️ Harder to search and query
- ⚠️ Performance issues with large documents

**When to Consider:**
- Only if visual context is critical
- Budget allows for complex implementation
- Primary use case is PDF annotation

#### **Option 3: Hybrid Approach (Best of Both)**

Store both chunk reference AND source document coordinates.

**Implementation:**
```sql
CREATE TABLE annotations (
  -- ... (same as Option 1)
  
  -- Chunk reference (always present)
  chunk_id UUID REFERENCES chunks(id),
  chunk_start_offset INTEGER,
  chunk_end_offset INTEGER,
  
  -- Source document reference (optional, if available)
  source_page_number INTEGER,
  source_coordinates JSONB, -- {x, y, width, height}
  source_format TEXT, -- 'pdf', 'docx', etc.
  
  -- ... rest of fields
);
```

**Benefits:**
- ✅ Fallback to chunk if source unavailable
- ✅ Can show visual context when possible
- ✅ More resilient to changes
- ✅ Supports both text and visual annotations

### Features Breakdown

#### **Core Annotation Features**
1. **Text Selection**
   - User highlights text in chunk view
   - Capture selected text + offsets
   - Show annotation indicator (highlight, icon)

2. **Comment Creation**
   - Rich text editor for comments
   - @mention autocomplete (search users)
   - Attach to selected text
   - Save with user ID and timestamp

3. **Threading**
   - Reply to existing annotations
   - Nested comment threads
   - Show reply count
   - Collapse/expand threads

4. **Status Management**
   - Mark as resolved/unresolved
   - Archive old comments
   - Filter by status
   - Show resolved comments with strikethrough

5. **Notifications**
   - Email/in-app notification on @mention
   - Notify when someone replies
   - Notify document owner of new comments
   - Digest emails for multiple notifications

#### **UI Components**

**Chunk View with Annotations:**
```
┌─────────────────────────────────────────┐
│ Chunk #5                         [💬 3] │
├─────────────────────────────────────────┤
│ The quarterly revenue increased by      │
│ 30% compared to last year. This growth  │
│ was primarily driven by...              │
│                                          │
│ 💬 @john: Is this data verified?        │
│    └─ @sarah: Yes, confirmed with CFO   │
│    └─ @john: ✓ Resolved                │
└─────────────────────────────────────────┘
```

**Annotation Sidebar:**
- Show all comments for document
- Filter by status, user, date
- Jump to chunk when clicking comment
- Show unread count

**Inline Highlights:**
- Highlight annotated text in chunks
- Different colors for different users
- Hover to preview comment
- Click to open full thread

### Permissions & Access Control

**Who Can Annotate:**
- Document owner (always)
- Collaborators (invited users)
- Team members (if document shared with team)
- Public viewers (read-only, no annotations)

**Permission Levels:**
```sql
CREATE TABLE document_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  permission_level TEXT NOT NULL, -- 'view', 'comment', 'edit'
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
```sql
-- Users can only see annotations on documents they have access to
CREATE POLICY "Users can view annotations on accessible documents"
  ON annotations FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
      UNION
      SELECT document_id FROM document_collaborators 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create annotations on documents they can comment on
CREATE POLICY "Users can create annotations on commentable documents"
  ON annotations FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
      UNION
      SELECT document_id FROM document_collaborators 
      WHERE user_id = auth.uid() 
      AND permission_level IN ('comment', 'edit')
    )
  );
```

### Real-Time Collaboration

**Supabase Realtime Integration:**
```typescript
// Subscribe to new annotations
const channel = supabase
  .channel(`document:${documentId}:annotations`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'annotations',
      filter: `document_id=eq.${documentId}`
    },
    (payload) => {
      // Show new annotation in UI
      addAnnotationToUI(payload.new);
      
      // Show toast if @mentioned
      if (isMentioned(payload.new, currentUserId)) {
        toast.info('You were mentioned in a comment');
      }
    }
  )
  .subscribe();
```

**Presence Indicators:**
- Show who's currently viewing the document
- Display active commenters
- Typing indicators for replies

### Integration with Existing Features

**Phase 4 (Embeddings):**
- Search within comments/annotations
- Find similar comments across documents
- Semantic search: "Show all comments about revenue"

**Phase 5 (Knowledge Graph):**
- Extract entities from comments
- Link comments to graph nodes
- Show comments related to specific entities

**Phase 7 (Document Details):**
- Show annotation count in document list
- Display recent comments on details page
- Filter chunks by "has comments"

### Implementation Phases

**Phase 1: Basic Annotations**
1. Create database schema
2. Add text selection to chunk view
3. Simple comment creation (no threading)
4. Display annotations inline
5. Basic RLS policies

**Phase 2: Collaboration**
1. @mention functionality
2. User notifications
3. Comment threading (replies)
4. Status management (resolve/unresolve)

**Phase 3: Advanced Features**
1. Rich text editor for comments
2. Annotation sidebar
3. Real-time updates
4. Presence indicators
5. Email notifications

**Phase 4: Polish**
1. Annotation search
2. Export comments to PDF/CSV
3. Annotation analytics
4. Mobile-responsive UI

### Technical Considerations

**Performance:**
- Index annotations by document_id and chunk_id
- Paginate annotations for large documents
- Cache annotation counts
- Lazy load comment threads

**Storage:**
- Annotations are lightweight (text only)
- Estimated: ~1KB per annotation
- 1000 annotations = ~1MB
- Negligible compared to document storage

**Scalability:**
- Annotations scale linearly with users
- Real-time subscriptions per document
- Consider rate limiting for spam prevention

### Alternative: Third-Party Solutions

If building from scratch is too complex, consider:
- **Hypothesis** - Open-source annotation platform
- **Annotator.js** - JavaScript annotation library
- **PDF.js** - Mozilla's PDF viewer with annotation support
- **Tiptap** - Rich text editor with collaboration features

These can be integrated and customized for your needs.

### Recommendation

**Start with Option 1 (Chunk-Based) for MVP:**
1. Simpler to implement
2. Works with all document types
3. Integrates well with existing chunk system
4. Can add source coordinates later (Option 3)

**Upgrade to Option 3 (Hybrid) if:**
- Users need visual context
- Budget allows for complexity
- PDF annotation is primary use case

**Only consider Option 2 if:**
- Visual annotation is absolutely critical
- You have dedicated resources for PDF rendering
- Users are willing to pay premium for this feature

---

## 🎨 Implementation Priority

For Mosaic, recommended order:

1. **Phase 4**: Basic embeddings (all chunks, ingestion-time)
2. **Phase 5**: Knowledge graph (entities/relationships)
3. **Phase 6**: LLM chunk summaries (context-aware)
4. **Phase 7**: Hierarchical chunking (if needed for large docs)
5. **Phase 8**: Lazy processing pattern (optimization)
6. **Future**: Agentic chunking (evaluate ROI first)

---

## 🔄 Document Management Actions ✅ MIGRATED TO BUILD_PLAN (Phase 7.5)

### Overview
Advanced document management operations beyond basic upload/delete that require careful handling of the entire RAG pipeline.

### Proposed Actions

#### 1. **Reprocess Document**
**Use Case**: Re-extract and re-chunk a document with updated settings or after fixing processing errors.

**Implementation Considerations**:
- Delete existing chunks for the document
- Delete existing embeddings (if Phase 4 implemented)
- Delete extracted entities and relationships (if Phase 5 implemented)
- Re-download file from storage
- Re-run extraction → chunking → embedding → graph extraction pipeline
- Maintain document ID and metadata (upload date, user, etc.)
- Update `updated_at` timestamp
- Handle status transitions: `ready` → `processing` → `ready`/`error`

**UI/UX**:
- Show confirmation dialog: "This will delete all chunks and embeddings. Continue?"
- Display processing progress
- Disable other actions while reprocessing

**Edge Cases**:
- What if original file was deleted from storage?
- What if processing settings changed (chunk size, overlap, etc.)?
- How to handle if user deletes document while reprocessing?

---

#### 2. **Replace File**
**Use Case**: Update a document with a newer version while maintaining the same document record.

**Implementation Considerations**:
- Upload new file to storage
- Delete old file from storage
- Delete all chunks, embeddings, entities, relationships
- Update document metadata (file_size, file_type, file_path)
- Re-run full processing pipeline
- Maintain document ID, created_at, user_id
- Update file_name if different
- Update updated_at timestamp

**UI/UX**:
- File upload dialog with "Replace" action
- Show diff of metadata (old vs new file size, type)
- Confirmation: "This will replace all content and delete existing chunks/embeddings"
- Progress indicator during replacement

**Edge Cases**:
- What if new file is different format? (PDF → XLSX)
- What if new file fails processing?
- Should we keep a version history?
- Rollback mechanism if replacement fails?

---

#### 3. **Duplicate Document**
**Use Case**: Create a copy of a document for testing different processing settings.

**Implementation Considerations**:
- Create new document record with new ID
- Copy file in storage (or reference same file)
- Option A: Copy all chunks/embeddings (fast)
- Option B: Reprocess from scratch (allows different settings)
- Update created_at to current time
- Append "(Copy)" to file_name

**UI/UX**:
- "Duplicate" action in dropdown menu
- Option to choose: "Copy as-is" or "Reprocess with settings"
- Navigate to new document after duplication

---

#### 4. **Archive/Unarchive Document**
**Use Case**: Soft-delete documents without losing data, exclude from search.

**Implementation Considerations**:
- Add `archived` boolean column to documents table
- Archived documents excluded from default queries
- Archived documents excluded from vector search
- Keep all chunks, embeddings, entities intact
- Add "Archived" filter to documents list
- Add "Restore" action for archived documents

**UI/UX**:
- "Archive" instead of "Delete" as primary action
- "Delete Permanently" as secondary destructive action
- Archived documents shown in separate tab/filter
- Visual indicator (grayed out, archive icon)

---

#### 5. **Batch Operations**
**Use Case**: Apply actions to multiple documents at once.

**Implementation Considerations**:
- Extend existing bulk delete to support other actions
- Queue-based processing for bulk reprocess/replace
- Progress tracking for batch operations
- Atomic operations (all or nothing) vs partial success handling
- Rate limiting to avoid overwhelming worker

**UI/UX**:
- Multi-select with action dropdown
- Progress modal showing: "Processing 5 of 10 documents..."
- Summary of results: "8 succeeded, 2 failed"
- Ability to cancel in-progress batch operation

---

### Database Schema Implications

**Required Additions**:
```sql
-- Track document versions (if implementing replace with history)
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  replaced_at TIMESTAMPTZ DEFAULT NOW(),
  replaced_by UUID REFERENCES auth.users(id)
);

-- Archive support
ALTER TABLE documents ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN archived_at TIMESTAMPTZ;

-- Processing history/audit log
CREATE TABLE document_processing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'upload', 'reprocess', 'replace', 'archive'
  status TEXT NOT NULL, -- 'started', 'completed', 'failed'
  error_message TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Worker Implications

**Queue Message Types**:
- `process_new` (existing)
- `reprocess` (new)
- `replace` (new)
- Each type needs different cleanup logic

**Cleanup Functions**:
```python
def cleanup_document_data(document_id):
    """Delete all derived data for a document"""
    # Delete chunks
    supabase.table("chunks").delete().eq("document_id", document_id).execute()
    
    # Delete embeddings (Phase 4)
    # supabase.table("embeddings").delete().eq("document_id", document_id).execute()
    
    # Delete entities (Phase 5)
    # supabase.table("entities").delete().eq("document_id", document_id).execute()
    
    # Delete relationships (Phase 5)
    # supabase.table("relationships").delete().eq("document_id", document_id).execute()
```

---

### Priority & Complexity

**High Priority, Low Complexity**:
- ✅ Archive/Unarchive (soft delete)
- ✅ Processing audit log

**Medium Priority, Medium Complexity**:
- 🟡 Reprocess document
- 🟡 Batch operations (extend existing)

**Lower Priority, High Complexity**:
- 🔴 Replace file (version history, rollback)
- 🔴 Duplicate with settings

### Recommended Implementation Order

1. **Phase 7.2**: Archive/Unarchive + Processing Log
2. **Phase 7.3**: Reprocess Document
3. **Phase 7.4**: Batch Reprocess
4. **Phase 8+**: Replace File with versioning (after embeddings/graph)

---

## 📝 Notes

- These patterns are proven in production but add complexity
- Start simple, add sophistication based on actual user needs
- Measure impact before investing in expensive optimizations
- Consider cost/benefit for each enhancement

---

*Document created: 2025-10-15*
*Last updated: 2025-10-15 (Added document management actions)*
