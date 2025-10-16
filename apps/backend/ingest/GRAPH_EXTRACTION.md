# Graph RAG Integration in Document Worker

## Overview

Graph extraction has been integrated into the document processing pipeline. Entities and relationships are now extracted automatically during document processing, immediately after embeddings are generated.

## Processing Flow

```
Upload → Queue (pgmq) → Python Worker →
  1. Download from Supabase Storage
  2. Extract text (Docling VLM)
  3. Chunk text (MarkdownChunker)
  4. Generate embeddings (OpenAI)
  5. Store chunks + embeddings
  6. Extract entities & relationships ← NEW
  7. Store in graph tables
  8. Update document status to 'ready'
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Enable/disable graph extraction
ENABLE_GRAPH_EXTRACTION=true

# Entity deduplication threshold (0.0-1.0)
# Higher = stricter, Lower = looser
ENTITY_SIMILARITY_THRESHOLD=0.85

# OpenAI API key (required for graph extraction)
OPENAI_API_KEY=your-key-here
```

### Toggle Graph Extraction

**Enable (default):**
```bash
ENABLE_GRAPH_EXTRACTION=true
```

**Disable (for testing or cost savings):**
```bash
ENABLE_GRAPH_EXTRACTION=false
```

## How It Works

### 1. Entity Extraction

For each chunk, the system:
- Sends chunk text to GPT-4o-mini with structured output schema
- Extracts entities (11 types): person, organization, concept, methodology, framework, tool, technology, location, event, document, other
- Generates embedding for each entity description
- Checks for similar entities using pgvector (0.85 similarity threshold)
- Either updates existing entity or creates new one

### 2. Relationship Extraction

For each chunk, the system:
- Extracts relationships between entities (12 types): uses, requires, relates_to, part_of, implements, extends, depends_on, collaborates_with, manages, creates, analyzes, evaluates, other
- Links relationships to source/target entity IDs
- Stores with confidence scores and source tracking

### 3. Deduplication

**Canonical Name Matching:**
- Normalizes entity names (lowercase, trim, collapse spaces)
- Unique constraint on `(user_id, canonical_name, type)`

**Semantic Similarity:**
- Generates embedding for entity description
- Searches for similar entities using pgvector cosine similarity
- Threshold: 0.85 (configurable via `ENTITY_SIMILARITY_THRESHOLD`)

**Array Tracking:**
- Tracks all documents and chunks where entity appears
- Updates arrays when entity found in new chunks

## Performance

### Speed
- **Extraction**: ~2-3 seconds per chunk
- **Typical document** (100 chunks): ~3-5 minutes additional processing time
- **Runs in parallel** with other processing (non-blocking)

### Cost
- **Per chunk**: ~$0.0015 (GPT-4o-mini)
- **Per entity**: ~$0.0001 (embedding)
- **200-page document**: ~$0.23 total

### Error Handling
- Graph extraction failures are **non-fatal**
- Document still marked as 'ready' even if graph extraction fails
- Errors logged but don't block document processing

## Database Schema

### Entities Table
```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  user_id UUID,
  name TEXT,
  type TEXT,
  description TEXT,
  embedding VECTOR(1536),
  canonical_name TEXT,
  aliases TEXT[],
  document_ids UUID[],
  chunk_ids UUID[],
  extraction_confidence FLOAT,
  UNIQUE (user_id, canonical_name, type)
);
```

### Relationships Table
```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY,
  user_id UUID,
  source_entity_id UUID,
  target_entity_id UUID,
  relationship_type TEXT,
  description TEXT,
  document_ids UUID[],
  chunk_ids UUID[],
  extraction_confidence FLOAT,
  UNIQUE (user_id, source_entity_id, target_entity_id, relationship_type)
);
```

## Monitoring

### Logs

**Successful extraction:**
```
INFO - Extracting entities and relationships for knowledge graph
INFO - Processed 10/100 chunks for graph extraction
INFO - Graph extraction complete: 42 entities, 18 relationships from 100 chunks
```

**Extraction disabled:**
```
INFO - Graph extraction disabled
```

**Extraction failure (non-fatal):**
```
ERROR - Graph extraction failed (non-fatal): [error message]
```

### Database Queries

**Check entities extracted:**
```sql
SELECT 
  name, 
  type, 
  array_length(chunk_ids, 1) as appearances
FROM entities
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Check relationships:**
```sql
SELECT 
  se.name as source,
  r.relationship_type,
  te.name as target
FROM relationships r
JOIN entities se ON se.id = r.source_entity_id
JOIN entities te ON te.id = r.target_entity_id
WHERE r.user_id = 'your-user-id'
ORDER BY r.created_at DESC
LIMIT 10;
```

**Check deduplication:**
```sql
SELECT 
  name,
  type,
  array_length(chunk_ids, 1) as appearances
FROM entities
WHERE user_id = 'your-user-id'
  AND array_length(chunk_ids, 1) > 1
ORDER BY appearances DESC;
```

## Troubleshooting

### Graph extraction not running

**Check configuration:**
```bash
# In worker logs
grep "Graph extraction" logs.txt
```

**Expected output:**
```
INFO - Initialized graph extractor
INFO - Extracting entities and relationships for knowledge graph
```

**If disabled:**
```
INFO - Graph extraction disabled
```

### No entities found

**Possible causes:**
1. Chunks contain no extractable entities
2. OpenAI API key missing or invalid
3. LLM extraction returning empty results

**Debug:**
```python
# Test extraction on sample text
from processors.graph_extractor import GraphExtractor

extractor = GraphExtractor(supabase)
result = extractor.extract_from_chunk("Your test text here")
print(f"Entities: {len(result.entities)}")
print(f"Relationships: {len(result.relationships)}")
```

### High duplicate count

**Adjust similarity threshold:**
```bash
# Stricter matching (fewer duplicates)
ENTITY_SIMILARITY_THRESHOLD=0.90

# Looser matching (more duplicates but catches variations)
ENTITY_SIMILARITY_THRESHOLD=0.80
```

### Cost concerns

**Disable for specific documents:**
```bash
# Temporarily disable
ENABLE_GRAPH_EXTRACTION=false

# Process documents
# ...

# Re-enable
ENABLE_GRAPH_EXTRACTION=true
```

**Backfill later:**
- Use TypeScript API endpoint `/api/graph/extract` for manual extraction
- Process specific documents on-demand

## Architecture Benefits

### Why Python Worker?

**✅ Advantages:**
- Single processing pass (no re-fetching chunks)
- Chunks already in memory
- Consistent pipeline (all processing in one place)
- Better error handling (unified retry logic)
- Automatic for all documents
- Python ecosystem (can use spaCy, etc. if needed)

**vs TypeScript API:**
- TypeScript: Manual extraction, requires API call, re-fetches chunks
- Python: Automatic extraction, integrated pipeline, uses in-memory chunks

### What Stays in TypeScript?

**Keep in TypeScript:**
- Graph search functions (`lib/graph/graph-search.ts`)
- Entity/relationship querying
- Frontend integration
- Manual extraction API (for backfill)

**Python handles:**
- Automatic extraction during processing
- Deduplication logic
- Database storage

## Migration from TypeScript

### Phase 1: Python Integration ✅ COMPLETE
- [x] Port extraction logic to Python
- [x] Integrate into worker pipeline
- [x] Test with new documents

### Phase 2: Backfill (Optional)
- [ ] Keep TypeScript API for manual extraction
- [ ] Add "Extract Graph" button in UI
- [ ] Process existing documents

### Phase 3: Cleanup (Future)
- [ ] Remove TypeScript extraction code
- [ ] Keep search functions only
- [ ] Document Python-first approach

## Testing

### Test with New Document

1. Upload a document via UI
2. Check worker logs for graph extraction
3. Verify entities in database
4. Check relationships

### Verify Extraction

```sql
-- Get latest document
SELECT id, file_name FROM documents 
WHERE status = 'ready' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check entities for that document
SELECT e.name, e.type, e.description
FROM entities e
WHERE 'YOUR_DOC_ID' = ANY(e.document_ids);

-- Check relationships
SELECT 
  se.name as source,
  r.relationship_type,
  te.name as target,
  r.description
FROM relationships r
JOIN entities se ON se.id = r.source_entity_id
JOIN entities te ON te.id = r.target_entity_id
WHERE 'YOUR_DOC_ID' = ANY(r.document_ids);
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Automatic extraction during processing
- ✅ Deduplication via pgvector
- ✅ Non-fatal error handling

### Phase 2 (Planned)
- [ ] Batch processing optimization
- [ ] Parallel extraction for large documents
- [ ] Entity resolution improvements
- [ ] Confidence score refinement

### Phase 3 (Future)
- [ ] Community detection (Leiden clustering)
- [ ] Temporal relationships
- [ ] Cross-document entity linking
- [ ] Graph-based summarization

---

**Last updated:** October 16, 2025
