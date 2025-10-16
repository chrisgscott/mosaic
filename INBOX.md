# INBOX

## 💡 Enhancements & Ideas

### HyDE Query Enhancement Tuning
**Priority:** Medium  
**Impact:** Improved search accuracy and reduced hallucination impact

**Context:**
HyDE (Hypothetical Document Embeddings) currently generates hypothetical answers to improve semantic search. However, it can sometimes hallucinate incorrect context (e.g., interpreting "SDA" as "Seventh-day Adventist" instead of "Strategic Design Approaches"). While the system self-corrects through Multi-Query generation, Graph Search, and Reranking, we can improve HyDE's contribution.

**Observed Behavior:**
- HyDE occasionally generates incorrect hypothetical documents
- Multi-Query + Graph Search + Reranking compensate effectively
- Final results are still accurate (reranking buries bad HyDE results)
- Overall search time: ~14s for complex queries

**Proposed Improvements:**

1. **Lower HyDE Weight in RRF Scoring**
   - Reduce HyDE's influence in Reciprocal Rank Fusion
   - Give more weight to Multi-Query and Graph Search results
   - Prevents bad HyDE guesses from skewing initial rankings

2. **Add HyDE Validation**
   - Compare HyDE result against original query embedding
   - If similarity is below threshold (e.g., 0.6), discard HyDE result
   - Only use HyDE when it's semantically aligned with the query
   - Prevents hallucinated content from entering the search pipeline

3. **Make HyDE Optional by Query Type**
   - Use HyDE for broad conceptual queries
   - Skip HyDE for specific factual queries (names, dates, etc.)
   - Add query classification to determine when HyDE helps

**Benefits:**
- Reduced risk of hallucination affecting results
- Faster search when HyDE is skipped
- More predictable search behavior
- Better resource utilization

**Files to Modify:**
- `apps/web/app/api/search/route.ts` - Add HyDE validation and weight tuning
- Search configuration - Add HyDE weight parameter
- Query classifier - Determine when to use HyDE

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

*Last cleaned: October 16, 2025*
