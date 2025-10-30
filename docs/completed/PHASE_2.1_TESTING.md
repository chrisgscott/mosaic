# Phase 2.1: Document Augmentation Testing Guide

**Date:** October 24, 2025  
**Status:** Implementation Complete, Ready for Testing  
**Branch:** `feature/document-augmentation`

---

## What Was Implemented

Document Augmentation (Question Generation) - a composable chunking enhancement that generates questions from chunks to improve query matching without hallucination.

### Key Components:

1. **Database Migration** (`20251024_add_chunk_augmentation.sql`)
   - Added `chunk_type` column ('ORIGINAL' or 'AUGMENTED_QUESTION')
   - Added `parent_chunk_id` to link questions back to source chunks
   - Added indexes for performance

2. **DocumentAugmentationChunker** (`document_augmentation_chunker.py`)
   - Wraps any base chunker (currently StructureAwareChunker)
   - Generates 5 questions per chunk using gpt-4o-mini
   - Stores questions as separate searchable chunks
   - Configurable via settings

3. **Search Function Updates** (`apps/web/app/api/search/route.ts`)
   - Added `processAugmentedResults()` function
   - Detects AUGMENTED_QUESTION results
   - Fetches and returns parent chunks
   - Deduplicates results

---

## How It Works

### During Ingestion:
```
Document: "TTI (Tactical Training Institute) provides military training..."

Generated Questions:
  1. "What does TTI stand for?"
  2. "What is the Tactical Training Institute?"
  3. "What services does TTI provide?"
  4. "Who does TTI serve?"
  5. "What type of training does TTI offer?"

Storage:
  - 1 ORIGINAL chunk (the document content)
  - 5 AUGMENTED_QUESTION chunks (each question links to parent)
```

### During Search:
```
User Query: "What does TTI stand for?"

Search Process:
  1. Query embedding matches generated question
  2. processAugmentedResults() detects AUGMENTED_QUESTION
  3. Fetches parent chunk (original document)
  4. Returns parent chunk with preserved rerank score

Result: Original document content (CORRECT, no hallucination!)
```

---

## Testing Steps

### 1. Apply Database Migration

```bash
cd /Users/chrisgscott/projects/mosaic
./supabase/apply_migration.sh 20251024_add_chunk_augmentation.sql
```

**Verify:**
```sql
-- Check columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chunks' 
AND column_name IN ('chunk_type', 'parent_chunk_id');

-- Check indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'chunks' 
AND indexname IN ('idx_chunks_type', 'idx_chunks_parent');
```

### 2. Configure Settings (Optional)

Document augmentation is **enabled by default**. To disable or adjust:

```sql
-- Disable document augmentation
INSERT INTO system_settings (category, key, value, description)
VALUES ('processing', 'enableDocumentAugmentation', false, 'Enable question generation for chunks')
ON CONFLICT (category, key) DO UPDATE SET value = false;

-- Adjust questions per chunk (default: 5)
INSERT INTO system_settings (category, key, value, description)
VALUES ('processing', 'questionsPerChunk', 3, 'Number of questions to generate per chunk')
ON CONFLICT (category, key) DO UPDATE SET value = 3;
```

### 3. Process a Test Document

Upload a document with clear factual content (good candidates):
- Documents with acronyms (e.g., "TTI", "SDA", "OODA")
- Documents with definitions
- Documents with specific facts

**Expected Behavior:**
- Worker logs should show: `Document augmentation enabled (5 questions per chunk)`
- Processing will take slightly longer (LLM calls for questions)
- Chunks table will have both ORIGINAL and AUGMENTED_QUESTION entries

**Check Results:**
```sql
-- Count chunk types
SELECT chunk_type, COUNT(*) 
FROM chunks 
WHERE document_id = 'YOUR_DOCUMENT_ID'
GROUP BY chunk_type;

-- View generated questions
SELECT content, parent_chunk_id
FROM chunks
WHERE document_id = 'YOUR_DOCUMENT_ID'
AND chunk_type = 'AUGMENTED_QUESTION'
LIMIT 10;

-- View parent chunk for a question
SELECT c1.content as question, c2.content as parent_content
FROM chunks c1
JOIN chunks c2 ON c1.parent_chunk_id = c2.id
WHERE c1.document_id = 'YOUR_DOCUMENT_ID'
AND c1.chunk_type = 'AUGMENTED_QUESTION'
LIMIT 5;
```

### 4. Test Search Matching

Try queries that should match generated questions:

**Good Test Queries:**
- "What does [ACRONYM] stand for?"
- "What is [TERM]?"
- "How does [CONCEPT] work?"
- "What are the benefits of [THING]?"

**Expected Behavior:**
- Search logs should show: `[Augmentation] Found N augmented question matches`
- Search logs should show: `[Augmentation] Replaced question "..." with parent chunk`
- Results should contain original chunk content, not the question
- Results should have `matched_via_question: true` flag

**Check Search Response:**
```javascript
// In browser console after search
console.log(searchResults.results.filter(r => r.matched_via_question));
```

### 5. Compare with HyDE

Test the same queries with and without document augmentation:

**With Augmentation (Current):**
- Should match exact questions
- Should return correct source content
- No hallucination risk

**With HyDE (Old Approach):**
- Might hallucinate facts
- Especially bad for acronyms
- Can return wrong documents

---

## Success Criteria

✅ **Database Migration Applied**
- Columns and indexes created successfully

✅ **Question Generation Working**
- Documents process successfully
- Questions are generated and stored
- Parent-child relationships are correct

✅ **Search Integration Working**
- Augmented questions are matched
- Parent chunks are returned
- Deduplication works correctly
- No errors in search logs

✅ **Quality Improvements**
- Better precision on factual queries
- Acronyms resolve correctly
- No hallucination in results

---

## Troubleshooting

### Issue: No questions being generated

**Check:**
1. Is document augmentation enabled in settings?
2. Are there errors in worker logs?
3. Is OPENAI_API_KEY set correctly?

**Solution:**
```bash
# Check worker logs
# Look for "Document augmentation enabled" or error messages
```

### Issue: Questions not matching in search

**Check:**
1. Are questions being embedded?
2. Are embeddings generated for AUGMENTED_QUESTION chunks?

**Solution:**
```sql
-- Check if questions have embeddings
SELECT COUNT(*) 
FROM chunks 
WHERE chunk_type = 'AUGMENTED_QUESTION' 
AND embedding IS NOT NULL;
```

### Issue: Parent chunks not being returned

**Check:**
1. Are parent_chunk_id values correct?
2. Is processAugmentedResults() being called?

**Solution:**
- Check search API logs for `[Augmentation]` messages
- Verify parent_chunk_id references exist

---

## Performance Considerations

**Cost:**
- ~$0.001 per chunk for question generation (gpt-4o-mini)
- For 100 chunks: ~$0.10 per document
- Negligible compared to other processing costs

**Speed:**
- Adds ~100-200ms per chunk (LLM call)
- For 100 chunks: ~10-20 seconds additional processing
- Parallelizable if needed

**Storage:**
- 5x more chunks (1 original + 5 questions)
- Questions are short (~50-100 chars each)
- Minimal storage impact

---

## Next Steps

After successful testing:

1. **Merge to main** if all tests pass
2. **Monitor search quality** for 1-2 weeks
3. **Compare metrics** with HyDE approach
4. **Consider Phase 2.2** (Proposition Chunking) if this works well

---

## Rollback Plan

If issues arise:

1. **Disable in settings:**
```sql
UPDATE system_settings 
SET value = false 
WHERE category = 'processing' 
AND key = 'enableDocumentAugmentation';
```

2. **Revert migration (if needed):**
```sql
ALTER TABLE chunks DROP COLUMN IF EXISTS chunk_type;
ALTER TABLE chunks DROP COLUMN IF EXISTS parent_chunk_id;
DROP INDEX IF EXISTS idx_chunks_type;
DROP INDEX IF EXISTS idx_chunks_parent;
```

3. **Revert code:**
```bash
git checkout main
```

---

## Documentation References

- **Implementation Plan:** `CHUNKING_IMPROVEMENTS_PLAN.md` Phase 2.1
- **Code:** 
  - `apps/backend/ingest/chunkers/document_augmentation_chunker.py`
  - `apps/web/app/api/search/route.ts` (processAugmentedResults)
  - `supabase/migrations/20251024_add_chunk_augmentation.sql`
