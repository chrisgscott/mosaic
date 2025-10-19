# Items Requiring Further Decisions

This document contains items from INBOX that need additional decisions or research before they can be added to BUILD_PLAN.

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

## 🤖 Advanced RAG Patterns (Evaluation Needed)

### 1. Lazy Processing Pattern

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

### 3. Structured Data & Spreadsheet Intelligence

**Current State:**
- ✅ CSV/XLSX files are processed by Docling
- ✅ Tables extracted and converted to markdown
- ✅ Basic chunking preserves table structure
- ❌ No semantic understanding of data
- ❌ No statistical analysis or narratives
- ❌ Queries like "What was average revenue?" don't work well

**The Problem:**
Traditional RAG struggles with structured data because:
- Tables chunked row-by-row lose context
- Column headers separated from data lose meaning
- Semantic search on raw CSV data performs poorly
- Users can't ask analytical questions about the data

**Proposed Solution: Lightweight CSV Intelligence**

**Phase 1: Document-Level Narratives Only** (2-3 days, ~$0.05/CSV)
- [ ] Detect CSV/XLSX uploads
- [ ] Generate single document-level summary:
  - What the data represents
  - Key columns and their purposes
  - Data quality observations (missing values, outliers)
  - Notable patterns or characteristics
  - Potential use cases
- [ ] Embed summary alongside table chunks
- [ ] Cost: ~$0.05 per CSV (one LLM call)
- [ ] Skip: Column narratives, trends, anomalies (too expensive)
- [ ] Skip: Long-table format (storage explosion)

**Phase 2: Optional Deep Analysis** (User-triggered, 1-2 days)
- [ ] Add "Analyze Data" button for CSVs
- [ ] User can trigger expensive analysis on-demand:
  - Statistical analysis
  - Trend detection
  - Anomaly identification
  - Column-specific narratives
- [ ] Show cost estimate before processing
- [ ] Cost: ~$0.20-0.50 per CSV (multiple LLM calls)

**Phase 3: Query-Time Analysis** (Future, 2-3 days)
- [ ] When user asks analytical question:
  - Detect it's about structured data
  - Fetch raw CSV data
  - Run analysis on-the-fly
  - Return answer with data context
- [ ] Cost: Pay only when users ask questions
- [ ] More flexible than pre-generating everything

**Implementation Approach:**

```python
# Lightweight approach
def process_csv(file_path, document_id):
    # 1. Load CSV
    df = pd.read_csv(file_path)
    
    # 2. Generate single summary
    summary = generate_csv_summary(df)  # One LLM call
    
    # 3. Create summary chunk
    create_chunk(summary, metadata={'type': 'csv_summary'})
    
    # 4. Store original table as markdown (current approach)
    table_markdown = df.to_markdown()
    create_chunks(table_markdown)
    
    return {'summary_generated': True, 'cost': 0.05}
```

**Cost Analysis:**

**Current Approach (Free):**
- Just store table as markdown
- No semantic understanding
- Poor for analytical queries

**Phase 1 (Cheap):**
- $0.05 per CSV
- At 100 CSVs/month: **$5/month**
- Significant improvement for discovery
- Users can find relevant CSVs via summaries

**Full "Long Table + Narrative" (Expensive):**
- $0.50+ per CSV
- At 100 CSVs/month: **$50/month**
- Overkill for most use cases
- Complex to maintain

**Decision Criteria:**

**Implement Phase 1 if:**
- ✅ Users upload >10 CSVs/month
- ✅ Users search for "data about X" and can't find CSVs
- ✅ Current table handling isn't discoverable enough

**Implement Phase 2 if:**
- ✅ Users ask analytical questions ("What's the average?")
- ✅ Users need trend analysis or anomaly detection
- ✅ Willing to pay $0.20-0.50 per analysis

**Don't implement if:**
- ❌ Users rarely upload CSVs (<5/month)
- ❌ Users don't ask analytical questions
- ❌ Current table handling is sufficient

**Recommended Action:**

1. **Monitor CSV usage** for 1-2 months:
   - Track: How many CSVs uploaded?
   - Track: How often are they searched?
   - Track: What questions do users ask?

2. **Start with Phase 1** if usage justifies it:
   - Low cost ($5/month for 100 CSVs)
   - Clear value (better discovery)
   - Simple to implement (2-3 days)

3. **Add Phase 2** only if users demand it:
   - User-triggered (they control cost)
   - Show value before implementing
   - Validate with user feedback

**Alternative: Query-Time Processing**

Instead of pre-processing all CSVs, process on-demand:
- User asks: "What was Q3 revenue in this spreadsheet?"
- System fetches raw CSV data
- Runs analysis on-the-fly
- Returns answer with context
- Cost: Only pay when users ask questions
- More flexible, less upfront cost

**Priority:** Low (Wait for user demand signal)

**Estimated Effort:**
- Phase 1: 2-3 days
- Phase 2: 1-2 days
- Phase 3: 2-3 days

**Reference:** Full implementation details in `docs/structured-data-approch.md`

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

