# INBOX

## 💡 Graph RAG Enhancements

### Improve Chunking for Better Graph Extraction
**Priority:** High  
**Impact:** Improves all downstream results (embeddings, search, graph quality)

**Problem:**
Graph extraction quality is limited by chunk quality. Current fixed-size chunking doesn't preserve semantic boundaries or context.

**Proposed Solutions:**
1. **Agentic Chunking** - Use LLM to determine optimal chunk boundaries based on semantic meaning
2. **Chunk Summaries** - Generate summaries by comparing each chunk to its nearest X neighbors
   - Provides better context for entity/relationship extraction
   - Improves embedding quality
   - Helps LLM understand chunk's role in larger document

**Benefits:**
- Better entity extraction (entities won't be split across chunks)
- More accurate relationships (context preserved)
- Improved search results (better embeddings)

**Related:** This addresses the root cause of many RAG quality issues

---

### Graph Entity/Relationship Management UI
**Priority:** Medium  
**Impact:** User control and data quality

**Features Needed:**

1. **Entity/Relationship Editing**
   - View all extracted entities and relationships
   - Edit entity names, types, descriptions
   - Merge duplicate entities
   - Delete incorrect entities/relationships
   - Add manual entities/relationships

2. **Type Management**
   - Edit entity types (methodology, concept, framework, etc.)
   - Edit relationship types (uses, relates_to, part_of, etc.)
   - Add custom types per user/organization
   - Type validation and suggestions

3. **Graph Visualization**
   - Interactive graph view of entities and relationships
   - Filter by type, document, or search
   - Click to edit
   - Visual indication of confidence/source

**Technical Considerations:**
- Need API endpoints for CRUD operations on entities/relationships
- UI components for graph visualization (e.g., React Flow, D3.js)
- Real-time updates when editing
- Audit trail for changes

---

### Smart Cascade Delete for Graph Data
**Priority:** High  
**Impact:** Data integrity

**Problem:**
When deleting a document, we need to delete associated entities/relationships, BUT only if they're not referenced by other documents.

**Current Behavior:**
Simple CASCADE delete would remove entities even if they appear in other documents.

**Required Behavior:**
1. Check if entity/relationship has `document_ids` array with multiple documents
2. If yes: Remove only the deleted document_id from the array
3. If no (only one document): Delete the entity/relationship entirely
4. Same logic for `chunk_ids` - only delete if no remaining chunks reference it

**Implementation:**
- Database trigger or function to handle smart cascade
- Or application-level logic in delete endpoint
- Need to handle both `document_ids` and `chunk_ids` arrays

**Files to modify:**
- Database migration for trigger/function
- `apps/web/app/api/documents/[id]/route.ts` - Delete endpoint
- Consider adding tests for this critical logic

---

### Granular Document Processing Status
**Priority:** Low  
**Impact:** Better UX and debugging

**Current Status Values:**
- Uploading
- Uploaded  
- Processing

**Proposed Status Values:**
- `uploading` - File upload in progress
- `pending` - Queued for processing
- `processing` - Worker has picked up the job
- `chunking` - Creating chunks from document
- `embedding` - Generating embeddings for chunks
- `extracting_graph` - Extracting entities and relationships
- `ready` - All processing complete
- `error` - Processing failed

**Benefits:**
- Users see exactly what stage their document is in
- Easier debugging (know where failures occur)
- Better progress indication
- Can show estimated time remaining per stage

**Technical Considerations:**
- Worker needs to update status at each stage
- Frontend needs to display appropriate UI for each status
- Consider adding `processing_stage_started_at` timestamp
- May want to track duration of each stage for analytics

**Files to modify:**
- Database: Update `documents.status` enum
- `apps/backend/ingest/main.py` - Update status at each stage
- Frontend: Update status display components
- Consider adding progress percentage (0-100%)

---

## 🐛 Bugs & Issues

### PGMQ Queue State Corruption on Document Deletion
**Priority:** High  
**Impact:** Database restart required to recover

**Problem:**
When a document is deleted while in an error state, the `document_processing` queue enters a corrupted state where:
- Queue cannot be purged using standard PGMQ commands
- Messages remain stuck in the queue
- Only solution is to restart the database

**Root Cause:**
Likely a race condition between:
1. Document deletion (CASCADE deletes chunks/embeddings)
2. Worker retrying the failed job
3. PGMQ message visibility timeout

**Potential Solutions:**
1. **Immediate:** Add queue cleanup on document deletion
   - Before deleting document, archive/delete any pending queue messages
   - Use `pgmq.archive()` or `pgmq.delete()` for the document's job
   
2. **Short-term:** Improve error handling
   - Check if document exists before processing
   - If document not found, delete message immediately (don't retry)
   
3. **Long-term:** Implement dead letter queue
   - Move permanently failed messages to separate queue
   - Prevents main queue corruption
   - Allows manual inspection/cleanup

**Files to modify:**
- `apps/backend/ingest/main.py` - Add document existence check
- `apps/web/app/api/documents/[id]/route.ts` - Clean queue on delete
- Database migration - Add dead letter queue table

---

## ✅ Recently Completed

All items have been processed and moved to their appropriate locations:

- **Actionable items** → Moved to BUILD_PLAN.md with proper phase assignments
- **Items needing decisions** → Moved to TO_PROCESS.md for evaluation
- **Already implemented** → Removed (Docling VLM, parallel processing)

## Recent Migrations (January 16, 2025)

### Moved to BUILD_PLAN.md
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements

### Moved to TO_PROCESS.md
- Frontend Display Issues (chunk limit, filename truncation)
- Infrastructure Cleanup (disk size reduction, Unstructured removal)
- Advanced RAG Patterns (agentic chunking, lazy processing, structured data)
- Operational Decisions (multi-worker scaling)

### Already Implemented (Removed from INBOX)
- Docling with VLM ✅ Deployed and working
- Parallel Page Processing ✅ Implemented in Docling processor

---

## How to Use This File

When new ideas or enhancements come up:

1. **Add them here first** - Quick capture without overthinking
2. **Run /cleanup workflow** - Periodically move items to BUILD_PLAN or TO_PROCESS
3. **Keep it clean** - INBOX should be empty or near-empty most of the time

---

*Last updated: January 16, 2025*
