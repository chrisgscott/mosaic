# Items Requiring Further Decisions

This document contains items from INBOX that need additional decisions or research before they can be added to BUILD_PLAN.

---

## 🐛 Frontend Display Issues

### 1. Chunk Display Limit Issue

**Problem:** The document details page shows "Chunks (1000)" even when documents have more chunks (e.g., 1972 chunks). The query includes `.limit(10000)` but appears to be capped at 1000.

**Investigation Needed:**
- Verify Supabase query is actually using the limit parameter
- Check if there's a separate Supabase configuration limiting results
- Investigate Next.js caching behavior
- Consider if there's a PostgREST limit configuration

**Workaround Options:**
- Paginate the chunks table (load 100 at a time)
- Show accurate count without loading all chunks
- Use a separate count query: `select count(*) from chunks where document_id = ?`

**Priority:** Low - The chunks are all stored correctly in the database. This is purely a display issue that doesn't affect functionality.

**Decision Needed:** Choose pagination strategy or investigate Supabase limit configuration.

---

### 2. Upload Modal Filename Truncation Not Working

**Problem:** Long filenames in the upload modal overflow their container instead of truncating with ellipsis, despite having the correct CSS classes applied.

**Investigation Needed:**
- Check if there's a conflicting CSS rule from shadcn/ui Dialog component
- Inspect computed styles in browser to see what's overriding truncation
- Test if the issue is specific to the Dialog component's rendering
- Verify that the text element has an actual width constraint from its parent

**Priority:** Low - Cosmetic issue only. Filenames are still readable and the tooltip shows the full name on hover.

**Decision Needed:** Allocate time for CSS debugging or accept current behavior.

---

## 🧹 Infrastructure Cleanup & Optimization

### 1. Reduce Render Persistent Disk Size

**Current State:** Using persistent disk for `/tmp` storage on Render ingestion worker.

**Opportunity:** With Docling, we create significantly fewer temp files than with Unstructured.

**Action Items:**
1. Monitor actual `/tmp` usage during document processing
2. Test with various document sizes (small, medium, large PDFs)
3. Calculate maximum concurrent `/tmp` usage
4. Reduce disk size to minimum needed + buffer
5. Potential savings: $0.25/GB/month

**Priority:** Medium - Cost optimization opportunity once Docling is proven stable.

**Decision Needed:** Allocate time to monitor and test disk usage patterns.

---

### 2. Remove Unstructured Processor & Dependencies

**Current State:** Both Unstructured and Docling processors exist in codebase. Unstructured is no longer used but code remains.

**Benefits of Removal:**
- Smaller Docker image
- Faster builds
- Simpler codebase
- Reduced maintenance burden
- Lower memory requirements

**Prerequisites:**
- ✅ Docling proven stable in production
- ✅ Process at least 50-100 documents successfully
- ✅ No critical bugs or edge cases discovered
- ✅ Performance meets requirements

**Timeline:** 
- **Wait period**: 1-2 weeks of production usage
- **Cleanup effort**: ~1-2 hours
- **Testing**: Verify builds and deployments work

**Priority:** Medium - Wait for Docling stability confirmation before removing Unstructured as fallback.

**Decision Needed:** Set date to evaluate Docling stability and proceed with cleanup.

---

## 🤖 Advanced RAG Patterns (Evaluation Needed)

### 1. Agentic/LLM-Based Chunking

**Concept:** Let an LLM decide chunk boundaries based on semantic meaning rather than fixed sizes.

**Trade-offs:**
- **Pros:** More semantically coherent chunks, better preservation of meaning
- **Cons:** Expensive (LLM call per chunk decision), time-consuming, ROI unclear

**Decision Needed:** Evaluate ROI before implementing. Consider for high-value documents only, or as optional "premium" processing mode.

---

### 2. Lazy Processing Pattern

**Concept:** Move expensive operations from ingestion → retrieval to only process what's actually used.

**What to Move to Retrieval:**
- Embeddings generation - Only embed chunks that get retrieved
- Entity extraction - Only extract entities from accessed chunks
- Summarization - Generate summaries on-demand

**Benefits:**
- Faster ingestion
- Cost savings (only process what's used)
- Better ROI
- Scales better

**Trade-offs:**
- First retrieval is slower (cold start)
- Need caching strategy
- More complex retrieval logic

**Decision Needed:** Evaluate if lazy processing fits Mosaic's use case. Consider hybrid approach (eager for popular docs, lazy for others).

---

### 3. Structured Data & Spreadsheet Chunking

**Concept:** Specialized chunking strategy for spreadsheets, CSV files, and other structured/tabular data.

**Approaches:**
1. **Narrative Generation:** Transform structured data into natural language narratives
2. **Long-Table Format:** Convert wide tables into long-format with descriptive keys
3. **Hybrid:** Store original + generate narratives + long-table format

**Trade-offs:**
- **Narrative Generation:** Expensive (LLM calls), slower, may introduce interpretation
- **Long-Table Format:** Storage explosion, complexity, transformation overhead

**Research Needed:**
1. ROI Analysis - Cost vs. benefit for your use cases
2. Volume Assessment - How many spreadsheets will you process?
3. Query Patterns - What types of questions will users ask?
4. Accuracy Testing - How well do narratives preserve meaning?

**Decision Needed:** Evaluate if structured data processing is needed for Mosaic's use case. Consider starting simple (store as-is) and adding complexity only if users demand it.

---

## 📊 Operational Decisions

### 1. Multi-Worker Scaling Strategy

**Current State:** Single worker processing documents sequentially.

**Options:**
1. **Multiple Workers** (Simple) - Deploy 2-3 identical workers, pgmq handles coordination
2. **Multi-threaded Single Worker** (Complex) - ThreadPoolExecutor for concurrent processing
3. **Parallel Page Processing** (Already Implemented) - Docling handles this internally

**Decision Needed:** 
- Monitor queue depth and processing times
- Decide when to scale horizontally (add workers)
- Set thresholds for auto-scaling decisions

**Priority:** Low - Current single worker handles load well. Revisit when processing >10 docs/day consistently.

---

