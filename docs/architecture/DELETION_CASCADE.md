# Document Deletion Cascade Strategy

## Overview

When a document is deleted, the system performs a comprehensive cleanup to remove all related data while preserving entities and relationships that are still referenced by other documents.

## Deletion Flow

### 1. Queue Cleanup (Best-Effort)
```typescript
await supabase.rpc('pgmq_archive_by_document', {
  p_document_id: documentId
});
```
- Archives any pending queue messages for the document
- Prevents queue corruption for documents in error state
- Non-fatal if it fails

### 2. Graph Data Cleanup (Smart Cascade)

#### Entities
```typescript
// Get all entities referencing this document or its chunks
const entities = await supabase
  .from("entities")
  .select("id, document_ids, chunk_ids")
  .or(`document_ids.cs.{${documentId}},chunk_ids.ov.{${chunkIds.join(",")}}`);

// For each entity:
for (entity of entities) {
  // Remove this document's references
  updatedDocIds = entity.document_ids.filter(id => id !== documentId);
  updatedChunkIds = entity.chunk_ids.filter(id => !chunkIds.includes(id));
  
  if (updatedDocIds.length === 0 && updatedChunkIds.length === 0) {
    // No more references - DELETE entity
    await supabase.from("entities").delete().eq("id", entity.id);
  } else {
    // Still has references - UPDATE arrays
    await supabase.from("entities").update({
      document_ids: updatedDocIds,
      chunk_ids: updatedChunkIds
    }).eq("id", entity.id);
  }
}
```

**Behavior:**
- ✅ Removes document_id and chunk_ids from entity arrays
- ✅ Deletes entity if no other documents reference it
- ✅ Preserves entity if other documents still reference it

#### Relationships
```typescript
// Get all relationships referencing this document or its chunks
const relationships = await supabase
  .from("relationships")
  .select("id, document_ids, chunk_ids")
  .or(`document_ids.cs.{${documentId}},chunk_ids.ov.{${chunkIds.join(",")}}`);

// For each relationship:
for (rel of relationships) {
  // Remove this document's references
  updatedDocIds = rel.document_ids.filter(id => id !== documentId);
  updatedChunkIds = rel.chunk_ids.filter(id => !chunkIds.includes(id));
  
  if (updatedDocIds.length === 0 && updatedChunkIds.length === 0) {
    // No more references - DELETE relationship
    await supabase.from("relationships").delete().eq("id", rel.id);
  } else {
    // Still has references - UPDATE arrays
    await supabase.from("relationships").update({
      document_ids: updatedDocIds,
      chunk_ids: updatedChunkIds
    }).eq("id", rel.id);
  }
}
```

**Behavior:**
- ✅ Removes document_id and chunk_ids from relationship arrays
- ✅ Deletes relationship if no other documents reference it
- ✅ Preserves relationship if other documents still reference it

### 3. Storage Cleanup
```typescript
await supabase.storage
  .from("documents")
  .remove([document.file_path]);
```
- Deletes the actual file from Supabase Storage
- Fails the entire deletion if storage deletion fails

### 4. Database Cleanup (Automatic CASCADE)
```typescript
await supabase
  .from("documents")
  .delete()
  .eq("id", documentId);
```

**Automatic CASCADE deletes:**
- ✅ All chunks (`chunks.document_id → documents.id ON DELETE CASCADE`)
- ✅ All embeddings (`embeddings.document_id → documents.id ON DELETE CASCADE`)
- ✅ All embeddings via chunks (`embeddings.chunk_id → chunks.id ON DELETE CASCADE`)

## Database CASCADE Rules

### Direct Cascades (Automatic)

```sql
-- Chunks cascade from documents
chunks.document_id → documents.id ON DELETE CASCADE

-- Embeddings cascade from documents
embeddings.document_id → documents.id ON DELETE CASCADE

-- Embeddings cascade from chunks
embeddings.chunk_id → chunks.id ON DELETE CASCADE

-- Relationships cascade from entities
relationships.source_entity_id → entities.id ON DELETE CASCADE
relationships.target_entity_id → entities.id ON DELETE CASCADE

-- User cascades (everything)
*.user_id → auth.users.id ON DELETE CASCADE
```

### Smart Cascades (Application Logic)

**Entities:**
- Removed from arrays when document deleted
- Deleted only if no other documents reference them
- Preserved if still referenced by other documents

**Relationships:**
- Removed from arrays when document deleted
- Deleted only if no other documents reference them
- Preserved if still referenced by other documents
- **Also cascade deleted** if source or target entity is deleted (database rule)

## What Gets Deleted

When you delete a document:

| Item | Deletion Behavior |
|------|------------------|
| **Document record** | ✅ Always deleted |
| **Storage file** | ✅ Always deleted |
| **Chunks** | ✅ Always deleted (CASCADE) |
| **Embeddings** | ✅ Always deleted (CASCADE) |
| **Queue messages** | ✅ Archived (best-effort) |
| **Entities** | ⚠️ Only if no other documents reference them |
| **Relationships** | ⚠️ Only if no other documents reference them |

## Example Scenarios

### Scenario 1: Document with Unique Entities
```
Document A: Contains "Tesla" entity (only document with this entity)
→ Delete Document A
Result:
  ✅ Document A deleted
  ✅ Chunks deleted
  ✅ Embeddings deleted
  ✅ "Tesla" entity deleted (no other references)
  ✅ All relationships involving "Tesla" deleted (CASCADE from entity)
```

### Scenario 2: Document with Shared Entities
```
Document A: Contains "Tesla" entity
Document B: Also contains "Tesla" entity
→ Delete Document A
Result:
  ✅ Document A deleted
  ✅ Chunks deleted
  ✅ Embeddings deleted
  ⚠️ "Tesla" entity preserved (still referenced by Document B)
  ⚠️ "Tesla" entity updated: document_ids and chunk_ids arrays cleaned
  ⚠️ Relationships involving "Tesla" preserved (still referenced by Document B)
```

### Scenario 3: Entity Becomes Orphaned
```
Document A: Contains "Tesla" entity
Document B: Contains "Tesla" entity
→ Delete Document A (Tesla still has Document B)
→ Delete Document B (Tesla now has no references)
Result:
  ✅ Document B deleted
  ✅ "Tesla" entity deleted (no more references)
  ✅ All relationships involving "Tesla" deleted (CASCADE from entity)
```

## Error Handling

- **Queue cleanup failure:** Non-fatal, logs warning
- **Graph cleanup failure:** Non-fatal, logs warning
- **Storage deletion failure:** Fatal, returns error
- **Database deletion failure:** Fatal, returns error

## Performance Considerations

- Entity and relationship cleanup runs in parallel (`Promise.all`)
- Each entity/relationship is processed independently
- No blocking between entity updates and relationship updates
- Graph cleanup is best-effort and won't block document deletion

## Future Improvements

Potential enhancements:
1. **Soft deletes** - Mark as deleted instead of hard delete
2. **Batch operations** - Optimize for bulk document deletion
3. **Audit trail** - Track what was deleted and when
4. **Undo capability** - Restore deleted documents within time window
5. **Orphan detection** - Background job to find and clean orphaned entities

## Testing Checklist

When testing document deletion:
- [ ] Single document with unique entities
- [ ] Single document with shared entities
- [ ] Multiple documents with same entities
- [ ] Document with no entities
- [ ] Document in error state (queue messages)
- [ ] Verify storage file is deleted
- [ ] Verify chunks are deleted
- [ ] Verify embeddings are deleted
- [ ] Verify entities are cleaned/deleted appropriately
- [ ] Verify relationships are cleaned/deleted appropriately
- [ ] Verify no orphaned data remains
