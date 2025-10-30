# Graph RAG Implementation

## Overview

Mosaic's Graph RAG implementation follows **R2R's Postgres-native approach**: no external graph database (like Neo4j), all graph data stored in Postgres tables, graph traversal via SQL joins.

## Architecture

### Storage Layer: Postgres Tables

**Entities Table:**
- Stores extracted entities (people, organizations, concepts, methodologies, etc.)
- Each entity has: name, type, description, embedding (for semantic search)
- Tracks source documents and chunks
- Deduplication via unique constraint on `(user_id, canonical_name, type)`
- pgvector HNSW index for semantic entity search

**Relationships Table:**
- Stores subject-predicate-object triples
- Links source entity → relationship type → target entity
- Tracks source documents and chunks
- Deduplication via unique constraint on `(user_id, source_entity_id, target_entity_id, relationship_type)`
- Indexed for efficient graph traversal

### Processing Layer: LLM-Driven Extraction

**Entity Extraction:**
- Uses Vercel AI SDK `generateObject` with structured output (Zod schemas)
- Extracts entities from each chunk
- Generates embeddings for entity descriptions
- Deduplicates via:
  1. Canonical name normalization (lowercase, trimmed)
  2. pgvector similarity search (0.85 threshold)
  3. Unique constraints in database

**Relationship Extraction:**
- Extracts relationships between entities in same chunk
- Classifies relationship types (uses, requires, relates_to, etc.)
- Stores with confidence scores
- Deduplicates via unique constraints

### Search Layer: Hybrid Vector + Graph

**Graph-Enhanced Search:**
1. Generate query embedding
2. Search for semantically similar entities (pgvector)
3. Optionally expand via graph traversal (N-hop)
4. Get relationships between entities (SQL joins)
5. Collect related chunk IDs for context
6. Combine with traditional vector search results

## Database Schema

### Entities Table

```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Entity identification
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- person, organization, concept, methodology, etc.
  
  -- Entity content
  description TEXT,
  embedding VECTOR(1536),  -- For semantic entity search
  
  -- Source tracking
  document_ids UUID[],
  chunk_ids UUID[],
  
  -- Deduplication
  canonical_name TEXT,  -- Normalized for deduplication
  aliases TEXT[],       -- Alternative names
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  extraction_confidence FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (user_id, canonical_name, type)
);

-- HNSW index for semantic search
CREATE INDEX entities_embedding_idx ON entities 
  USING hnsw (embedding vector_cosine_ops);
```

### Relationships Table

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Relationship triple
  source_entity_id UUID REFERENCES entities(id),
  target_entity_id UUID REFERENCES entities(id),
  relationship_type TEXT NOT NULL,
  
  -- Relationship content
  description TEXT,
  
  -- Source tracking
  document_ids UUID[],
  chunk_ids UUID[],
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  extraction_confidence FLOAT,
  bidirectional BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (user_id, source_entity_id, target_entity_id, relationship_type),
  CHECK (source_entity_id != target_entity_id)
);

-- Indexes for graph traversal
CREATE INDEX relationships_source_idx ON relationships(source_entity_id);
CREATE INDEX relationships_target_idx ON relationships(target_entity_id);
CREATE INDEX relationships_source_type_idx ON relationships(source_entity_id, relationship_type);
```

## API Endpoints

### POST /api/graph/extract

Extracts entities and relationships from a document's chunks.

**Request:**
```json
{
  "documentId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "uuid",
  "documentName": "file.pdf",
  "entities": 42,
  "relationships": 18,
  "processingTimeMs": 12500
}
```

### POST /api/search (with graph enhancement)

Search with optional graph enhancement for relationship queries.

**Request:**
```json
{
  "query": "How does CCAAAPPI relate to OA?",
  "use_graph": true,
  "graph_hops": 1
}
```

**Response includes:**
- Traditional search results (chunks)
- Graph entities found
- Relationships between entities
- Expanded context from graph traversal

## Usage Examples

### 1. Extract Graph from Document

```typescript
// After document is processed and ready
const response = await fetch('/api/graph/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentId: 'doc-uuid' }),
});

const result = await response.json();
console.log(`Extracted ${result.entities} entities and ${result.relationships} relationships`);
```

### 2. Search with Graph Enhancement

```typescript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'How does CCAAAPPI relate to Opportunity Analysis?',
    use_graph: true,
    graph_hops: 1,
  }),
});

const results = await response.json();
// Results include both chunks and graph relationships
```

### 3. Programmatic Entity Extraction

```typescript
import { processDocumentForGraph } from '@/lib/graph/entity-extraction';

const result = await processDocumentForGraph(documentId, userId, {
  batchSize: 5,
  onProgress: (processed, total) => {
    console.log(`Progress: ${processed}/${total} chunks`);
  },
});

console.log(`Extracted ${result.totalEntities} entities and ${result.totalRelationships} relationships`);
```

### 4. Graph Search

```typescript
import { graphEnhancedSearch } from '@/lib/graph/graph-search';

const result = await graphEnhancedSearch({
  query: 'Strategic Design Approaches',
  userId: 'user-uuid',
  limit: 10,
  includeRelationships: true,
  maxHops: 1,
  entitySimilarityThreshold: 0.7,
});

console.log(`Found ${result.entities.length} entities`);
console.log(`Found ${result.relationships.length} relationships`);
console.log(`Related chunks: ${result.relatedChunkIds.length}`);
```

## Query Types

Graph RAG is particularly effective for:

### Relationship Queries
- "How does X relate to Y?"
- "What is the connection between X and Y?"
- "How are X and Y linked?"

### Entity-Centric Queries
- "What is CCAAAPPI?"
- "Tell me about Strategic Design Approaches"
- "Find all methodologies related to risk analysis"

### Graph Traversal Queries
- "What concepts are connected to X?"
- "Show me everything related to Y"
- "Find all frameworks that use Z"

## Performance Considerations

### Extraction Performance
- **Batch processing**: 5 chunks at a time (configurable)
- **LLM model**: GPT-4o-mini (fast, cost-effective)
- **Deduplication**: Similarity threshold 0.85 (balance precision/recall)
- **Typical speed**: ~2-3 seconds per chunk

### Search Performance
- **Entity search**: HNSW index for fast similarity search
- **Graph traversal**: Indexed SQL joins (efficient for 1-2 hops)
- **Combined search**: Run vector + graph in parallel

### Cost Considerations
- **Extraction**: ~$0.001-0.002 per chunk (GPT-4o-mini)
- **Entity embeddings**: ~$0.0001 per entity (text-embedding-3-small)
- **Search**: No additional cost (uses existing embeddings)

## Future Enhancements

### Phase 1 (Current)
- ✅ Entity and relationship extraction
- ✅ Postgres-native storage
- ✅ Basic graph search
- ✅ Deduplication

### Phase 2 (Planned)
- [ ] Community detection (Leiden clustering)
- [ ] Entity resolution improvements
- [ ] Multi-hop traversal optimization
- [ ] Graph visualization UI

### Phase 3 (Future)
- [ ] Temporal relationships (time-aware graph)
- [ ] Confidence score refinement
- [ ] Cross-document entity linking
- [ ] Graph-based summarization

## Comparison with R2R

| Feature | R2R | Mosaic |
|---------|-----|--------|
| Storage | Postgres tables | Postgres tables ✅ |
| Entity extraction | LLM prompts | Vercel AI SDK structured output ✅ |
| Deduplication | LLM + fuzzy matching | pgvector similarity + constraints ✅ |
| Graph traversal | SQL joins | SQL joins ✅ |
| Vector search | pgvector | pgvector ✅ |
| Communities | Leiden clustering | Planned |
| Graph DB | None (Postgres-native) | None (Postgres-native) ✅ |

## Key Differences from Neo4j Approach

**Advantages of Postgres-Native:**
- ✅ No additional infrastructure (already using Supabase)
- ✅ Unified data model (documents, chunks, embeddings, graph all in Postgres)
- ✅ Simpler deployment and maintenance
- ✅ RLS policies work across all data
- ✅ Transactional consistency
- ✅ Cost-effective (no separate graph DB)

**Trade-offs:**
- ⚠️ Graph traversal performance (SQL joins vs native graph queries)
- ⚠️ Limited to 2-3 hop queries (deeper traversal gets expensive)
- ⚠️ No graph-specific query language (Cypher)

**When to Consider Neo4j:**
- Need deep graph traversal (4+ hops)
- Complex graph algorithms (PageRank, centrality, etc.)
- Graph-first application (not RAG-first)
- Massive graph scale (millions of entities)

For most RAG use cases, **Postgres-native is the right choice**.

---

*Last updated: October 16, 2025*
