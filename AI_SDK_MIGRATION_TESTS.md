# AI SDK Migration Test Plan

## Overview
Migrating text generation from raw OpenAI SDK to Vercel AI SDK while keeping OpenAI SDK for embeddings.

## Files Being Modified
1. `/app/api/ai/generate-description/route.ts` - Entity/relationship description generation
2. `/app/(app)/graph/actions.ts` - Entity creation, description generation, relationship suggestions

---

## Test Suite

### 1. Entity Description Generation (API Route)

**Endpoint:** `POST /api/ai/generate-description`

#### Test 1.1: Generate Entity Description
```bash
# Prerequisites: Be logged in, have documents uploaded
# Location: Entity detail page → Edit mode

Steps:
1. Navigate to /graph
2. Click on any existing entity
3. Click "Edit" button
4. Click "Generate with AI" button next to Description field
5. Wait for generation

Expected Results:
✅ Loading spinner appears
✅ Description generates within 5-10 seconds
✅ Description appears in textarea
✅ Toast shows "Description generated successfully"
✅ Description is contextual (mentions content from your docs)
✅ No console errors

Test Data:
- Entity: "Design Thinking"
- Type: "methodology"
- Should find relevant chunks and generate description
```

#### Test 1.2: Generate Relationship Description
```bash
# Prerequisites: Be logged in, have entities with relationships

Steps:
1. Navigate to /graph
2. Click on any entity with relationships
3. Click "Edit" button
4. Scroll to relationships section
5. Click "Generate with AI" on a relationship description

Expected Results:
✅ Loading spinner appears
✅ Description generates within 5-10 seconds
✅ Description explains the relationship
✅ Toast shows "Description generated successfully"
✅ No console errors
```

#### Test 1.3: Generate Description with No Context
```bash
# Test fallback when no relevant chunks found

Steps:
1. Create a new entity with a very unique name
2. Name: "QuantumFluxCapacitor2025"
3. Type: "tool"
4. Click "Generate with AI"

Expected Results:
✅ Still generates a description (generic but accurate)
✅ No errors
✅ Description is sensible even without document context
```

---

### 2. Create New Entity with AI

**Location:** `/graph` → "Create Entity" button

#### Test 2.1: Generate Description for New Entity
```bash
Steps:
1. Navigate to /graph
2. Click "Create Entity" button
3. Enter name: "Agile Methodology"
4. Select type: "methodology"
5. Click "Generate with AI" button

Expected Results:
✅ Loading spinner appears
✅ Description generates from your documents
✅ Toast shows: "Description generated from X relevant chunks!" (if RAG found content)
✅ OR "Description generated!" (if no RAG content)
✅ Description field populates
✅ No console errors
```

#### Test 2.2: Generate Relationship Suggestions
```bash
Steps:
1. In Create Entity dialog
2. Enter name: "Scrum"
3. Select type: "framework"
4. Click "Generate with AI" for description
5. Click "Suggest with AI" for relationships

Expected Results:
✅ Loading spinner appears
✅ Suggestions appear within 10-15 seconds
✅ Shows 0-5 relationship suggestions
✅ Each suggestion has:
   - Target entity name
   - Relationship type
   - Confidence score (60%+)
   - Reasoning
✅ Can toggle suggestions on/off
✅ Toast shows success message
✅ No console errors
```

#### Test 2.3: Create Entity with RAG Sources
```bash
Steps:
1. Create entity for something in your documents
2. Name: "Tesla" (if you have docs mentioning Tesla)
3. Type: "organization"
4. Generate description
5. Click "Create Entity + X Relationships"

Expected Results:
✅ Entity created successfully
✅ Entity has chunk_ids populated (check in database)
✅ Entity has document_ids populated
✅ Entity has metadata.rag_sourced = true
✅ Toast shows success
✅ Page refreshes, entity appears in list
```

---

### 3. Extract Entities from Chunk

**Location:** Document page → Chunks table → View chunk → "Extract Entities"

#### Test 3.1: Extract Entities from Chunk
```bash
Steps:
1. Navigate to /documents
2. Click on any document
3. Scroll to chunks table
4. Click eye icon on any chunk
5. Click "Extract Entities" button

Expected Results:
✅ Loading spinner appears
✅ Extraction completes within 10-15 seconds
✅ Toast shows: "Created X entities (Y skipped - already exist)"
✅ OR "No significant entities found in this chunk"
✅ OR "All extracted entities already exist"
✅ Entities section updates immediately (if any created)
✅ No console errors
```

#### Test 3.2: Extract from Chunk with Existing Entities
```bash
Steps:
1. Find a chunk that mentions entities you already have
2. Click "Extract Entities"

Expected Results:
✅ Completes successfully
✅ Toast shows: "Created 0 entities (X skipped - already exist)"
✅ No duplicates created
✅ No errors
```

---

### 4. Model Selection & Settings

#### Test 4.1: Verify Model Usage
```bash
Steps:
1. Navigate to /settings/general
2. Check current "Standard Model" setting
3. Note the model (e.g., gpt-4o-mini)
4. Go back and generate a description
5. Check browser Network tab → Headers

Expected Results:
✅ Request uses the configured model
✅ No hardcoded model overrides
✅ Model from settings is respected
```

#### Test 4.2: Change Model and Test
```bash
Steps:
1. Go to /settings/general
2. Change "Standard Model" to different option
3. Save settings
4. Generate a new entity description
5. Verify it works

Expected Results:
✅ New model is used
✅ Generation still works
✅ No errors
```

---

### 5. Error Handling

#### Test 5.1: Network Error
```bash
Steps:
1. Open browser DevTools → Network tab
2. Set throttling to "Offline"
3. Try to generate a description
4. Re-enable network

Expected Results:
✅ Shows error toast: "Failed to generate description"
✅ Button returns to normal state (not stuck loading)
✅ Can retry after network restored
```

#### Test 5.2: Invalid Input
```bash
Steps:
1. Create entity dialog
2. Leave name empty
3. Click "Generate with AI"

Expected Results:
✅ Shows error: "Please enter entity name and type first"
✅ No API call made
✅ No console errors
```

---

### 6. Performance Tests

#### Test 6.1: Response Time
```bash
Steps:
1. Generate 5 entity descriptions in a row
2. Time each one

Expected Results:
✅ Each completes in 5-15 seconds
✅ No degradation over multiple calls
✅ No rate limiting errors
```

#### Test 6.2: Concurrent Requests
```bash
Steps:
1. Open 2 entity edit pages in different tabs
2. Click "Generate with AI" in both simultaneously

Expected Results:
✅ Both complete successfully
✅ No race conditions
✅ No errors
```

---

### 7. RAG Integration Tests

#### Test 7.1: Verify RAG Context Used
```bash
Steps:
1. Create entity for something specific in your docs
2. Generate description
3. Read the generated description

Expected Results:
✅ Description mentions specific details from your documents
✅ Not just generic description
✅ References concepts/terms from your content
```

#### Test 7.2: Verify Chunk Linking
```bash
Steps:
1. Create new entity with AI description
2. Note the toast message about chunks
3. After creation, view the entity
4. Check database or entity details

Expected Results:
✅ Entity has chunk_ids array populated
✅ Entity has document_ids array populated
✅ Can navigate to those chunks
✅ Chunks show this entity in "Associated Entities"
```

---

### 8. Console & Network Checks

#### Test 8.1: No Console Errors
```bash
Steps:
1. Open browser console
2. Run through all tests above
3. Monitor for errors

Expected Results:
✅ No errors in console
✅ No warnings about deprecated APIs
✅ No unhandled promise rejections
```

#### Test 8.2: Network Requests
```bash
Steps:
1. Open Network tab
2. Generate a description
3. Check the request/response

Expected Results:
✅ POST to correct endpoint
✅ Response status 200
✅ Response contains description
✅ Reasonable response time (<15s)
✅ No 500 errors
```

---

## Regression Tests

### Test 9.1: Chat Still Works
```bash
Steps:
1. Navigate to /chat
2. Ask a question
3. Verify streaming response

Expected Results:
✅ Chat works normally
✅ Streaming responses work
✅ No impact from migration
```

### Test 9.2: Search Still Works
```bash
Steps:
1. Use search functionality
2. Verify results appear

Expected Results:
✅ Search works normally
✅ No impact from migration
```

---

## Database Verification

### Test 10.1: Check Entity Structure
```sql
-- Run in Supabase SQL Editor
SELECT 
  name,
  type,
  description,
  chunk_ids,
  document_ids,
  metadata
FROM entities
WHERE metadata->>'rag_sourced' = 'true'
ORDER BY created_at DESC
LIMIT 5;
```

Expected Results:
✅ Entities have descriptions
✅ chunk_ids is array with IDs
✅ document_ids is array with IDs
✅ metadata has rag_sourced flag

---

## Sign-Off Checklist

Before marking migration complete:

- [ ] All entity description generation tests pass
- [ ] All relationship description generation tests pass
- [ ] Create entity with AI works
- [ ] Extract entities from chunks works
- [ ] Relationship suggestions work
- [ ] RAG context is used correctly
- [ ] Chunk linking works
- [ ] No console errors
- [ ] No network errors
- [ ] Performance is acceptable (<15s per generation)
- [ ] Error handling works
- [ ] Settings/model selection works
- [ ] Chat still works (regression)
- [ ] Search still works (regression)
- [ ] Database structure is correct

---

## Rollback Plan

If critical issues found:

1. Revert commits:
   ```bash
   git revert HEAD~1  # Revert last commit
   git push origin main
   ```

2. Or restore specific files:
   ```bash
   git checkout HEAD~1 -- apps/web/app/api/ai/generate-description/route.ts
   git checkout HEAD~1 -- apps/web/app/(app)/graph/actions.ts
   git commit -m "Rollback AI SDK migration"
   git push origin main
   ```

3. Redeploy previous version

---

## Notes

- Keep browser DevTools open during all tests
- Test with real documents in your database
- Test both with and without relevant context
- Verify embeddings still work (OpenAI SDK)
- Verify text generation uses AI SDK (new)
- Check that model selection from settings works
