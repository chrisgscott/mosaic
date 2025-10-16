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

## 🏗️ Docling Native Chunking (HybridChunker & HierarchicalChunker)

### Overview
Docling provides built-in chunking capabilities that operate directly on the `DoclingDocument` object, offering significant advantages over our current markdown-based approach.

### Current Approach (Markdown-Based)
```python
# What we do now:
markdown = docling_processor.process(pdf)  # Export to markdown
chunks = markdown_chunker.chunk(markdown)  # Post-process markdown
```

**Limitations:**
- ❌ Loses document structure information
- ❌ No token awareness (guessing chunk sizes)
- ❌ No context enrichment
- ❌ Manual handling of tables/lists
- ❌ Character-based splitting (not semantic)

### Docling's Native Chunkers

#### **1. HierarchicalChunker**
Creates one chunk per document element (paragraph, table, list, heading).

**Features:**
- ✅ Preserves document structure
- ✅ Attaches metadata (headings, captions)
- ✅ Merges list items automatically
- ✅ Keeps tables intact
- ✅ Links chunks to source elements

**Architecture:**
```
Document
  ↓
Heading 1 (chunk)
  ↓
Paragraph (chunk)
  ↓
Table (chunk - stays together)
  ↓
List (chunk - items merged)
  ↓
Heading 2 (chunk)
  ↓
...
```

#### **2. HybridChunker** (Recommended)
Combines hierarchical structure with token-aware refinements.

**How It Works:**
1. Starts with HierarchicalChunker output
2. Uses embedding model's tokenizer (e.g., sentence-transformers)
3. **Splits** oversized chunks (respects token limits)
4. **Merges** undersized chunks (same headings/captions)
5. Provides `contextualize()` method for context enrichment

**Key Feature - Context Enrichment:**
```python
# Raw chunk text:
"IBM originated with several innovations..."

# After contextualize():
"IBM\n1910s–1950s\nIBM originated with several innovations..."
```
**Adds heading hierarchy to each chunk for better retrieval!**

### Implementation Example

```python
from docling.chunking import HybridChunker
from transformers import AutoTokenizer

# Initialize with your embedding model's tokenizer
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
chunker = HybridChunker(tokenizer=tokenizer)

# Process DoclingDocument directly (no markdown export!)
docling_doc = converter.convert(pdf).document

# Generate chunks
for chunk in chunker.chunk(dl_doc=docling_doc):
    # Get context-enriched text
    enriched_text = chunker.contextualize(chunk)
    
    # Store with metadata
    store_chunk({
        "content": enriched_text,
        "token_count": tokenizer.count_tokens(enriched_text),
        "metadata": {
            "doc_items": chunk.meta.doc_items,  # Source elements
            "headings": chunk.meta.headings,    # Heading hierarchy
            "captions": chunk.meta.captions,    # Table/figure captions
        }
    })
```

### Advanced Serialization

Docling allows custom serialization strategies for different element types:

**Table Serialization Options:**
- **Markdown format** (default) - Human-readable tables
- **Triplet notation** - Structured for LLMs
- **Custom serializers** - Define your own

**Example:**
```python
from docling_core.transforms.chunker.hierarchical_chunker import (
    ChunkingDocSerializer,
    ChunkingSerializerProvider,
)
from docling_core.transforms.serializer.markdown import MarkdownTableSerializer

class CustomSerializerProvider(ChunkingSerializerProvider):
    def get_serializer(self, doc):
        return ChunkingDocSerializer(
            doc=doc,
            table_serializer=MarkdownTableSerializer(),  # Use markdown for tables
            # Can add custom serializers for images, code blocks, etc.
        )

chunker = HybridChunker(
    tokenizer=tokenizer,
    serializer_provider=CustomSerializerProvider(),
)
```

### Benefits Over Current Approach

| Aspect | Current (Markdown) | Docling Native |
|--------|-------------------|----------------|
| **Structure Preservation** | Lost in markdown | ✅ Fully preserved |
| **Token Awareness** | Manual (char-based) | ✅ Automatic (tokenizer) |
| **Context Enrichment** | None | ✅ Heading hierarchy added |
| **Table Handling** | Manual parsing | ✅ Automatic, configurable |
| **Semantic Boundaries** | Guessing | ✅ Document-aware |
| **Metadata** | Basic | ✅ Rich (headings, captions, refs) |
| **Complexity** | Low | Medium |
| **Quality** | Good | **Better** |

### Migration Path

**Phase 1: Validate Current Pipeline** (Now)
- ✅ Finish markdown-based chunking
- ✅ Test with 216-page PDF
- ✅ Verify retrieval works

**Phase 2: Add HybridChunker** (Next 1-2 weeks)
- Keep MarkdownChunker as fallback
- Add HybridChunker as optional processor
- A/B test retrieval quality
- Compare: markdown chunks vs hybrid chunks

**Phase 3: Switch Default** (If better)
- Make HybridChunker the default
- Keep MarkdownChunker for edge cases
- Update documentation

### Implementation Estimate

**Effort:**
- Coding: ~2-3 hours
- Testing: ~1-2 hours
- Documentation: ~1 hour
- **Total: ~4-6 hours**

**Complexity:** Medium
- Requires understanding Docling's chunker API
- Need to match embedding model tokenizer
- More configuration options to manage

### When to Implement

**Not Right Now Because:**
- ❌ Just fixed token_count bug in current pipeline
- ❌ Need to validate end-to-end flow first
- ❌ Don't want to introduce new complexity yet

**Soon (1-2 weeks) Because:**
- ✅ Better retrieval quality (context-enriched chunks)
- ✅ Token-aware (respects embedding limits)
- ✅ Structure-preserved (tables, lists intact)
- ✅ Less manual code (Docling handles complexity)
- ✅ Production-ready (well-documented, tested)

### Documentation Links

- [Docling Chunking Concepts](https://docling-project.github.io/docling/concepts/chunking/)
- [Hybrid Chunking Example](https://docling-project.github.io/docling/examples/hybrid_chunking/)
- [Advanced Chunking & Serialization](https://docling-project.github.io/docling/examples/advanced_chunking_and_serialization/)

### Recommendation

**YES, we should use Docling's HybridChunker, but:**
1. ✅ Validate current pipeline first (almost done!)
2. ✅ Test with 216-page PDF
3. 🔜 Add HybridChunker as enhancement
4. 🔜 A/B test quality
5. 🔜 Switch if better

**Priority:** High (but not urgent)
**Risk:** Low (can run in parallel with current approach)
**ROI:** High (better retrieval quality for minimal effort)

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

## ⚡ Parallel Document Processing

### Concept
Enable concurrent processing of multiple documents or parallel processing within a single document to improve throughput and reduce processing time.

### Implementation Options

#### **Option 1: Multiple Workers (Recommended for MVP)**

**How It Works:**
- Deploy 2-3 identical worker instances on Render
- All workers poll the same pgmq queue
- pgmq ensures each job is delivered to only one worker
- Zero code changes required

**Benefits:**
- ✅ **Simple** - Just duplicate service configuration
- ✅ **Fault tolerant** - If one worker crashes, others continue
- ✅ **Easy scaling** - Add/remove workers anytime
- ✅ **Proven pattern** - pgmq handles coordination automatically

**Cost:**
- 1 worker: $7/mo (baseline)
- 2 workers: $14/mo (2x throughput)
- 3 workers: $21/mo (3x throughput)

**Implementation:**
```yaml
# render.yaml - Just duplicate the service
services:
  - type: worker
    name: mosaic-document-processor-1
    # ... same config
  
  - type: worker
    name: mosaic-document-processor-2
    # ... same config
  
  - type: worker
    name: mosaic-document-processor-3
    # ... same config
```

**When to Use:**
- Multiple users uploading simultaneously
- Need to process document backlog faster
- Want simple horizontal scaling
- Budget allows for additional workers

---

#### **Option 2: Multi-threaded Single Worker**

**How It Works:**
- Single worker with ThreadPoolExecutor
- Polls queue for multiple jobs
- Spawns threads to process N documents concurrently
- Requires code changes

**Benefits:**
- ✅ More efficient resource usage per worker
- ✅ Single worker to manage and monitor
- ✅ Better CPU utilization

**Drawbacks:**
- ⚠️ Requires more RAM (2GB → 4GB recommended)
- ⚠️ More complex error handling
- ⚠️ Python GIL limitations (threading not true parallelism)
- ⚠️ Code changes required

**Implementation:**
```python
from concurrent.futures import ThreadPoolExecutor

class DocumentProcessor:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=3)
    
    def run(self):
        while self.running:
            # Poll for multiple jobs
            jobs = self.poll_queue(batch_size=3)
            
            # Process in parallel
            futures = [
                self.executor.submit(self.process_document, job)
                for job in jobs
            ]
            
            # Wait for completion
            for future in futures:
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"Job failed: {e}")
```

**Cost:**
- Requires Standard plan ($21/mo) for 4GB RAM
- Single worker but processes 2-3x faster

**When to Use:**
- Want to maximize single worker efficiency
- Have budget for larger instance
- Documents are small-medium (< 50 pages)
- Comfortable with code complexity

---

#### **Option 3: Parallel Page Processing (Advanced)**

**How It Works:**
- Break large documents into page ranges
- Process pages in parallel within single document
- Merge results back together

**Benefits:**
- ✅ Faster processing for large documents (100+ pages)
- ✅ Better CPU utilization
- ✅ Reduces single-document processing time

**Drawbacks:**
- ⚠️ **High complexity** - Difficult to implement correctly
- ⚠️ Not all formats support page-range extraction
- ⚠️ Chunk ordering becomes tricky
- ⚠️ Metadata coordination required
- ⚠️ May not provide significant speedup for most documents

**Implementation:**
```python
def process_document_parallel(self, file_path):
    # Split PDF into page ranges
    total_pages = get_page_count(file_path)
    page_ranges = [
        (1, 33), (34, 66), (67, 100)
    ]
    
    # Process each range in parallel
    with ThreadPoolExecutor(max_workers=3) as executor:
        chunk_groups = executor.map(
            lambda pages: self.extract_pages(file_path, pages),
            page_ranges
        )
    
    # Merge chunks (preserve order!)
    all_chunks = []
    for group in chunk_groups:
        all_chunks.extend(group)
    
    return all_chunks
```

**When to Use:**
- Processing 500+ page documents regularly
- Single-document speed is critical bottleneck
- Have engineering time for complexity
- Documents are primarily PDFs (easier to split)

---

### Performance Comparison

| Approach | Docs/min | Cost/mo | Complexity | Best For |
|----------|----------|---------|------------|----------|
| **1 Worker** | 1-2 | $7 | Simple ✅ | Low volume, testing |
| **3 Workers** | 3-6 | $21 | Simple ✅ | Multiple users, production |
| **Multi-threaded** | 2-4 | $21 | Medium | Single worker efficiency |
| **Parallel Pages** | 1-3 (faster) | $21 | High ⚠️ | Large documents only |

### Recommendation

**Start with Option 1 (Multiple Workers):**
1. Simplest to implement (just config change)
2. Proven to work with pgmq
3. Easy to scale up/down based on demand
4. No code changes or testing required

**Consider Option 2 later if:**
- Want to optimize cost per document
- Have consistent high volume
- Comfortable with code complexity

**Skip Option 3 unless:**
- Processing massive documents (500+ pages) regularly
- Single-document speed is critical
- Have dedicated engineering resources

### Implementation Notes

**Multiple Workers:**
- Each worker needs same environment variables
- All connect to same database and queue
- Render auto-restarts failed workers
- Can mix worker sizes (1x Standard + 2x Starter)

**Monitoring:**
- Track which worker processed which document
- Add worker_id to processing logs
- Monitor queue depth to decide scaling
- Set up alerts for worker failures

**Future Enhancements:**
- Auto-scaling based on queue depth
- Priority queues for urgent documents
- Worker specialization (PDFs vs spreadsheets)
- Load balancing across regions

---

## 🎨 Docling with Vision Language Models (VLM)

### Concept
Replace traditional OCR-based document processing (Unstructured) with modern Vision Language Models for faster, more accurate document understanding. Docling supports both local VLM models and API-based services.

### The Problem with Current Approach (Unstructured + OCR)
**Processing a 200-page complex PDF:**
- **Time:** 15-20 minutes
- **Method:** Tesseract OCR + image extraction + table detection
- **Disk usage:** 2.3GB temp files (images, intermediate processing)
- **Bottleneck:** CPU-bound OCR processing
- **Quality:** Good for text, struggles with complex layouts

### Docling VLM Solutions

#### **Option 1: Docling + Local VLM (GraniteDocling-258M)**

**Self-hosted, privacy-first approach:**
```python
from docling.document_converter import DocumentConverter
from docling.datamodel import vlm_model_specs
from docling.pipeline.vlm_pipeline import VlmPipeline

# 100% local processing - no API calls
pipeline_options = VlmPipelineOptions(
    vlm_options=vlm_model_specs.GRANITEDOCLING
)

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_cls=VlmPipeline,
            pipeline_options=pipeline_options,
        )
    }
)
```

**Performance:**
- **Speed:** ~6 seconds per page = 20 minutes for 200 pages (similar to current)
- **Cost:** $0 (free, local)
- **Model:** IBM's GraniteDocling-258M (specialized for documents)
- **Output:** Structured DocTags format (better than raw text)
- **Disk:** Still uses temp storage for model weights (~500MB)

**Benefits:**
- ✅ 100% self-hosted (no data leaves server)
- ✅ Works in air-gapped environments
- ✅ Better structured output than OCR
- ✅ No API costs
- ✅ Handles complex layouts better
- ✅ Drop-in replacement for Unstructured

**Drawbacks:**
- ⚠️ Similar speed to current OCR approach
- ⚠️ Still needs temp disk space (but less than Unstructured)
- ⚠️ Requires model download (~500MB, one-time)

---

#### **Option 2: Docling + API-based VLM (GPT-4o-mini)**

**Cloud-based, ultra-fast approach:**
```python
from docling.datamodel.pipeline_options_vlm_model import ApiVlmOptions

# Configure for OpenAI GPT-4o-mini
vlm_options = ApiVlmOptions(
    url="https://api.openai.com/v1/chat/completions",
    params=dict(
        model="gpt-4o-mini",
        max_tokens=4096,
    ),
    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
    prompt="Convert this document page to markdown with tables and structure.",
    temperature=0.1,
    response_format=ResponseFormat.MARKDOWN,
)

pipeline_options = VlmPipelineOptions(
    vlm_options=vlm_options,
    enable_remote_services=True
)
```

**Performance:**
- **Speed:** 1-2 seconds per page = **3-7 minutes for 200 pages** (3-4x faster!)
- **Cost:** ~$0.005 per document (half a cent)
- **Scaling:** 1000 docs/month = $5/mo
- **Disk:** Zero temp files (API-based)

**Benefits:**
- ✅ **3-4x faster** than OCR
- ✅ **No temp disk usage** (solves /tmp problem completely)
- ✅ Better at understanding complex layouts
- ✅ Handles tables, charts, graphs semantically
- ✅ Very cheap ($0.005 per doc)
- ✅ No model management or updates

**Drawbacks:**
- ⚠️ Requires internet connection
- ⚠️ Data sent to OpenAI (privacy consideration)
- ⚠️ API rate limits (60 req/min for GPT-4o-mini)
- ⚠️ Ongoing cost (though minimal)

---

#### **Option 3: Hybrid Approach (Best of Both Worlds)**

**Intelligent routing based on document characteristics:**
```python
def choose_processor(document):
    if document.is_sensitive:
        return local_vlm_processor  # Privacy-first
    elif document.page_count > 100:
        return api_vlm_processor    # Speed-first
    elif document.has_complex_tables:
        return api_vlm_processor    # Quality-first
    else:
        return local_vlm_processor  # Cost-first
```

**Or user-selectable:**
- **"Accurate" mode:** Local VLM (free, private, slower)
- **"Fast" mode:** API VLM (cheap, fast, cloud)

---

### Benchmark Comparison

**Processing 200-page complex PDF with tables/charts:**

| Method | Time | Cost | Disk | Privacy | Quality |
|--------|------|------|------|---------|---------|
| **Unstructured (current)** | 15-20 min | $0 | 2.3GB | 🔒 Local | Good |
| **Docling + Local VLM** | ~20 min | $0 | ~500MB | 🔒 Local | Better |
| **Docling + GPT-4o-mini** | 3-7 min | $0.005 | 0 | ⚠️ Cloud | Best |
| **LlamaParse (comparison)** | ~6 min | $0.10 | 0 | ⚠️ Cloud | Good |

**Source:** [PDF Data Extraction Benchmark 2025](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/)

---

### Implementation Considerations

#### **Migration Path**
1. **Phase 1:** Add Docling + Local VLM as alternative processor
2. **Phase 2:** Test side-by-side with Unstructured
3. **Phase 3:** Make Docling default, keep Unstructured as fallback
4. **Phase 4:** Add API VLM as "fast mode" option
5. **Phase 5:** Remove Unstructured entirely

#### **Code Changes Required**
- Create new `DoclingProcessor` class (similar to `UnstructuredProcessor`)
- Add processor selection logic
- Update worker to support multiple processors
- Add configuration for VLM model selection
- Update UI to show processing method used

#### **Infrastructure Impact**
- **Local VLM:** Needs model download on first run (~500MB)
- **API VLM:** Needs `OPENAI_API_KEY` environment variable
- **Both:** Significantly less temp disk usage than current

#### **Cost Analysis**

**Current (Unstructured + Render):**
```
Worker: $27.50/mo (Standard + 10GB disk)
Processing: $0
Total: $27.50/mo
```

**With Docling + Local VLM:**
```
Worker: $25/mo (Standard, less disk needed)
Processing: $0
Total: $25/mo (saves $2.50/mo)
```

**With Docling + API VLM:**
```
Worker: $7/mo (Starter, no disk needed!)
Processing: $5/mo (1000 docs)
Total: $12/mo (saves $15.50/mo)
```

**Break-even:** API VLM is cheaper until ~4000 docs/month

---

### Docling Features

**What Docling Provides:**
- 🗂️ Multiple format support (PDF, DOCX, PPTX, XLSX, HTML, images, audio)
- 📑 Advanced PDF understanding (layout, reading order, tables, formulas)
- 🧬 Unified DoclingDocument format
- ↪️ Multiple export formats (Markdown, HTML, DocTags, JSON)
- 🔒 Local execution for sensitive data
- 🤖 Integrations with LangChain, LlamaIndex, Crew AI, Haystack
- 🔍 Extensive OCR support (fallback if needed)
- 👓 Multiple VLM model support (local and API)
- 🎙️ Audio support with ASR models
- 🔌 MCP server for agentic applications

**Supported VLM Models:**
- **Local:** GraniteDocling-258M, SmolDocling-256M, Granite Vision
- **Self-hosted:** VLLM, LM Studio, Ollama
- **API:** OpenAI (GPT-4o, GPT-4o-mini), IBM watsonx.ai
- **Any OpenAI-compatible endpoint**

---

### Privacy & Security

**Docling is built for sensitive data:**
- 🔒 Local execution capabilities
- 🔒 Air-gapped environment support
- 🔒 No telemetry or phone-home
- 🔒 Open source (MIT license)
- 🔒 Self-hostable VLM servers

**From their docs:**
> "🔒 Local execution capabilities for sensitive data and air-gapped environments"

---

### Recommendation

**For Mosaic:**

**Short-term (Now):**
- Implement Docling + Local VLM as alternative to Unstructured
- Test with sample documents
- Compare quality, speed, and disk usage
- Keep Unstructured as fallback during transition

**Medium-term (After validation):**
- Make Docling default processor
- Add API VLM as optional "fast mode"
- Let users choose processing method at upload
- Remove Unstructured dependency

**Long-term (Production):**
- Use Local VLM for sensitive documents
- Use API VLM for speed-critical documents
- Hybrid routing based on document characteristics
- Consider self-hosted VLM server for best of both worlds

**Why this is valuable:**
1. **Solves /tmp disk problem** - API VLM uses zero disk
2. **3-4x faster processing** - Better user experience
3. **Better quality** - VLMs understand document structure
4. **Cost effective** - API VLM cheaper than larger Render instance
5. **Future-proof** - VLM technology improving rapidly
6. **Flexible** - Can choose local or API based on needs

---

### Resources

- **Docling GitHub:** https://github.com/docling-project/docling
- **Docling Docs:** https://docling-project.github.io/docling/
- **GraniteDocling Model:** https://huggingface.co/ibm-granite/granite-docling-258M
- **Benchmark Study:** https://procycons.com/en/blogs/pdf-data-extraction-benchmark/
- **VLM Examples:** https://docling-project.github.io/docling/examples/

---

## 📝 Notes

- These patterns are proven in production but add complexity
- Start simple, add sophistication based on actual user needs
- Measure impact before investing in expensive optimizations
- Consider cost/benefit for each enhancement

---

*Document created: 2025-10-15*
*Last updated: 2025-10-15 (Added parallel processing options)*
