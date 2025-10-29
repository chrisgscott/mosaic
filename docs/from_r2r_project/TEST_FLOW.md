# Multifloor Traversal - End-to-End Test

**Status:** All tables cleared and ready for fresh test  
**Test Document:** `test_document.txt` (simple 7-paragraph doc about Tesla/SpaceX)

## ✅ Step 1: Database Cleared

All tables are now empty:
- ✅ documents: 0
- ✅ chunks: 0
- ✅ graphs_entities: 0
- ✅ graphs_relationships: 0
- ✅ documents_entities: 0
- ✅ documents_relationships: 0
- ✅ floor_bridges: 0

## Step 2: Upload Test Document

### Option A: Via R2R API (Recommended)

```bash
# Upload the test document
curl -X POST http://localhost:7272/v3/documents \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_document.txt" \
  -F "metadata={\"title\":\"Tesla and SpaceX Overview\"}"
```

### Option B: Via Python

```python
from r2r import R2RClient

client = R2RClient("http://localhost:7272")

# Upload document
result = client.documents.create(
    file_path="test_document.txt",
    metadata={"title": "Tesla and SpaceX Overview"}
)

print(f"Document ID: {result['document_id']}")
```

**Expected Result:**
- Document ingested
- Chunks created (should be ~3-5 chunks)
- Entities extracted (Tesla, SpaceX, Elon Musk, Panasonic, etc.)
- Relationships extracted (founded_by, partners_with, etc.)

## Step 3: Verify R2R Ingestion

```sql
-- Check what R2R created
SELECT 
    'documents' as table_name, COUNT(*) as count FROM mosaic.documents
UNION ALL
SELECT 'chunks', COUNT(*) FROM mosaic.chunks
UNION ALL
SELECT 'documents_entities', COUNT(*) FROM mosaic.documents_entities
UNION ALL
SELECT 'documents_relationships', COUNT(*) FROM mosaic.documents_relationships;
```

**Expected:**
- 1 document
- 3-5 chunks
- 10-15 entities
- 5-10 relationships

## Step 4: Run Graph Pull (Manual)

R2R doesn't automatically move entities to graph-level tables. We need to trigger it:

```bash
# Get collection ID first
curl http://localhost:7272/v3/collections

# Then pull the graph
curl -X POST http://localhost:7272/v3/graphs/{collection_id}/pull
```

**Or via Python:**
```python
# Get collection ID
collections = client.collections.list()
collection_id = collections[0]['id']

# Pull graph
client.graphs.pull(collection_id)
```

## Step 5: Verify Graph Pull

```sql
-- Check if entities moved to graph tables
SELECT 
    'graphs_entities' as table_name, COUNT(*) as count FROM mosaic.graphs_entities
UNION ALL
SELECT 'graphs_relationships', COUNT(*) FROM mosaic.graphs_relationships;
```

**Expected:**
- graphs_entities: 10-15 entities
- graphs_relationships: 5-10 relationships

## Step 6: Create Bridges (Manual)

Run the bridge seeding script:

```sql
-- 1. Chunk → Entity bridges (A → B)
INSERT INTO mosaic.floor_bridges (
    source_floor, source_id, target_floor, target_id, bridge_type, weight, metadata
)
SELECT DISTINCT
    'A' as source_floor,
    unnest(e.chunk_ids) as source_id,
    'B' as target_floor,
    e.id as target_id,
    'mentions' as bridge_type,
    1.0 as weight,
    jsonb_build_object('entity_name', e.name, 'entity_type', e.category) as metadata
FROM mosaic.graphs_entities e
WHERE e.chunk_ids IS NOT NULL AND array_length(e.chunk_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- 2. Entity → Document bridges (B → C)
INSERT INTO mosaic.floor_bridges (
    source_floor, source_id, target_floor, target_id, bridge_type, weight, metadata
)
SELECT DISTINCT
    'B' as source_floor,
    e.id as source_id,
    'C' as target_floor,
    e.parent_id as target_id,
    'extracted_from' as bridge_type,
    1.0 as weight,
    jsonb_build_object('entity_name', e.name, 'entity_type', e.category) as metadata
FROM mosaic.graphs_entities e
WHERE e.parent_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Document → Chunk bridges (C → A)
INSERT INTO mosaic.floor_bridges (
    source_floor, source_id, target_floor, target_id, bridge_type, weight, metadata
)
SELECT DISTINCT
    'C' as source_floor,
    c.document_id as source_id,
    'A' as target_floor,
    c.id as target_id,
    'contains' as bridge_type,
    1.0 as weight,
    jsonb_build_object('chunk_order', (c.metadata->>'chunk_order')::INTEGER) as metadata
FROM mosaic.chunks c
WHERE c.document_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Relationship bridges (B → B)
INSERT INTO mosaic.floor_bridges (
    source_floor, source_id, target_floor, target_id, bridge_type, weight, metadata
)
SELECT DISTINCT
    'B' as source_floor,
    r.subject_id as source_id,
    'B' as target_floor,
    r.object_id as target_id,
    r.predicate as bridge_type,
    LEAST(COALESCE(r.weight, 1.0), 1.0) as weight,
    jsonb_build_object(
        'relationship_id', r.id,
        'subject', r.subject,
        'predicate', r.predicate,
        'object', r.object,
        'description', r.description,
        'original_weight', r.weight
    ) as metadata
FROM mosaic.graphs_relationships r
WHERE r.subject_id IS NOT NULL AND r.object_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

## Step 7: Verify Bridges

```sql
-- Check bridge counts
SELECT * FROM mosaic.bridge_statistics;

-- Should see:
-- A → B: ~30-50 bridges (chunks mentioning entities)
-- B → C: ~10-15 bridges (entities from document)
-- C → A: ~3-5 bridges (document contains chunks)
-- B → B: ~5-10 bridges (entity relationships)
```

## Step 8: Test Multi-Hop Traversal

### Test 1: Find entities mentioned in chunks
```sql
SELECT 
    LEFT(c.text, 60) || '...' as chunk_text,
    e.name as entity_name,
    e.category as entity_type
FROM mosaic.chunks c
JOIN mosaic.floor_bridges b ON b.source_id = c.id
    AND b.source_floor = 'A' AND b.target_floor = 'B'
JOIN mosaic.graphs_entities e ON e.id = b.target_id
LIMIT 10;
```

**Expected:** See chunks with entities like "Tesla", "SpaceX", "Elon Musk"

### Test 2: Find related entities (2-hop)
```sql
SELECT 
    e1.name as entity,
    b.bridge_type as relationship,
    e2.name as related_entity
FROM mosaic.graphs_entities e1
JOIN mosaic.floor_bridges b ON b.source_id = e1.id
    AND b.source_floor = 'B' AND b.target_floor = 'B'
JOIN mosaic.graphs_entities e2 ON e2.id = b.target_id
WHERE e1.name = 'Tesla'
LIMIT 10;
```

**Expected:** See relationships like:
- Tesla --[founded_by]--> Elon Musk
- Tesla --[partners_with]--> Panasonic

### Test 3: Complete journey (Chunk → Entity → Related Entity → Document)
```sql
SELECT 
    LEFT(c.text, 50) || '...' as chunk_text,
    e1.name as entity_mentioned,
    b.bridge_type as relationship,
    e2.name as related_entity,
    d.title as source_document
FROM mosaic.chunks c
JOIN mosaic.floor_bridges b1 ON b1.source_id = c.id 
    AND b1.source_floor = 'A' AND b1.target_floor = 'B'
JOIN mosaic.graphs_entities e1 ON e1.id = b1.target_id
JOIN mosaic.floor_bridges b ON b.source_id = e1.id
    AND b.source_floor = 'B' AND b.target_floor = 'B'
JOIN mosaic.graphs_entities e2 ON e2.id = b.target_id
JOIN mosaic.floor_bridges b2 ON b2.source_id = e2.id
    AND b2.source_floor = 'B' AND b2.target_floor = 'C'
JOIN mosaic.documents d ON d.id = b2.target_id
LIMIT 5;
```

**Expected:** See complete paths through multiple floors

## Step 9: Success Criteria

✅ **Infrastructure Working:**
- All 4 floor types populated (A, B, C)
- All 4 bridge types created (A→B, B→C, C→A, B→B)
- Multi-hop queries return results

✅ **Data Quality:**
- Entities make sense (Tesla, SpaceX, Elon Musk, etc.)
- Relationships make sense (founded_by, partners_with, etc.)
- Bridges point to existing entities (no orphans)

✅ **Ready for Phase 7.2:**
- Can traverse multiple floors
- Can follow relationships
- Can gather context from different views

## Troubleshooting

### If no entities extracted:
```bash
# Check R2R logs
docker logs -f docker-r2r-1

# Verify entity extraction is enabled in r2r.toml
```

### If graph pull fails:
```bash
# Check if collection exists
curl http://localhost:7272/v3/collections

# Try pull again with correct collection_id
```

### If bridges have orphaned references:
```sql
-- Find orphaned bridges
SELECT COUNT(*) as orphaned
FROM mosaic.floor_bridges b
LEFT JOIN mosaic.graphs_entities e ON e.id = b.target_id
WHERE b.target_floor = 'B' AND e.id IS NULL;

-- Delete orphaned bridges
DELETE FROM mosaic.floor_bridges b
WHERE b.target_floor = 'B'
  AND NOT EXISTS (
      SELECT 1 FROM mosaic.graphs_entities e WHERE e.id = b.target_id
  );
```

## Next Steps After Success

1. ✅ Verify all tests pass
2. ➡️ Start Phase 7.2: Build Trail Execution Engine
3. ➡️ Create API endpoint for programmatic traversal
4. ➡️ Add automation for bridge creation
