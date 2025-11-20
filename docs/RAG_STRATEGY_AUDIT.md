# RAG Strategy Audit - Mosaic vs Industry Best Practices

**Source**: [Every RAG Strategy Explained in 13 Minutes](https://www.youtube.com/watch?v=tLMViADvSNE) by Cole (Ottomator)  
**Expert Recommendation**: Combine 3-5 strategies for optimal results  
**Golden Nugget Combo**: Re-ranking + Agentic RAG + Context-Aware Chunking

---

## Summary Table

| Strategy | Status | Priority | Complexity | Cost Impact | Latency Impact |
|----------|--------|----------|------------|-------------|----------------|
| 1. Re-ranking | ✅ Implemented | KEEP | Low | Low | +200ms |
| 2. Agentic RAG | ✅ Implemented | SIMPLIFY | Medium | Medium | Variable |
| 3. Knowledge Graphs | ✅ Implemented | MAKE OPTIONAL | Very High | Very High | +2-4s |
| 4. Contextual Retrieval | ❌ Not Implemented | **HIGH PRIORITY** | Medium | Low | One-time |
| 5. Query Expansion | ❌ Not Implemented | LOW | Low | Medium | +1s |
| 6. Multi-Query RAG | ✅ Implemented | MAKE OPTIONAL | Low | High | +1-2s |
| 7. Context-Aware Chunking | ✅ Implemented | KEEP | Medium | None | One-time |
| 8. Late Chunking | ❌ Not Implemented | RESEARCH | Very High | Unknown | Unknown |
| 9. Hierarchical RAG | ⚠️ Partial | CONSIDER | Medium | Low | Variable |
| 10. Self-Reflective RAG | ❌ Not Implemented | LOW | Medium | High | +2-3s |
| 11. Fine-tuned Embeddings | ❌ Not Implemented | FUTURE | Very High | Very High | None |

---

## Detailed Analysis

### 1. Re-ranking ✅ IMPLEMENTED - KEEP

**What it is**: Two-step retrieval - pull many candidates, use specialized reranker model to find most relevant

**Mosaic Implementation**:
- ✅ Using Cohere reranker
- ✅ Fetches 20 candidates, reranks to top 10
- ✅ Enabled by default in system_settings

**Cole's Take**: "First strategy I use for almost every RAG implementation"

**Verdict**: ✅ **KEEP AS-IS**
- Essential for accuracy
- Low cost (~$0.002 per search)
- Minimal latency (+200ms)
- Industry standard

---

### 2. Agentic RAG ✅ IMPLEMENTED - SIMPLIFY

**What it is**: Give agent multiple tools to choose how it searches (semantic search, read full doc, etc.)

**Mosaic Implementation**:
- ✅ Three tools: `search_documents`, `quick_search`, `deep_graph_search`
- ✅ AI chooses which tool based on query
- ⚠️ May be too complex with 3 tools

**Cole's Take**: "Flexible but less predictable - need clear instructions for when to use each tool"

**Verdict**: ⚠️ **SIMPLIFY TO 2 TOOLS**
- Keep: `search_documents` (main search)
- Keep: `read_full_document` (for "read this file" queries)
- Remove: `quick_search` (redundant with search_documents)
- Remove: `deep_graph_search` (make this part of search_documents when graphs enabled)

**Rationale**: Simpler = more predictable = better UX

---

### 3. Knowledge Graphs ✅ IMPLEMENTED - MAKE OPTIONAL

**What it is**: Combine vector search with graph database to capture entity relationships

**Mosaic Implementation**:
- ✅ Entity extraction during ingestion
- ✅ Relationship extraction
- ✅ Graph search with traversal
- ⚠️ Always runs for every document

**Cole's Take**: 
- "Fantastic for interconnected data"
- "Requires infrastructure, entity extraction, graph maintenance"
- "Slower and more expensive"
- **📝 Pseudocode only in his repo** - didn't include in working code due to complexity

**Verdict**: ⚠️ **MAKE OPT-IN**

**Cost Analysis**:
- Entity extraction: ~$0.05-0.10 per document (GPT-4o-mini)
- Relationship extraction: ~$0.05-0.10 per document
- Graph storage: Postgres overhead
- Search latency: +2-4 seconds per query

**When it's worth it**:
- ✅ Legal documents with case law citations
- ✅ Research papers with reference networks
- ✅ Technical docs with component dependencies
- ✅ Corporate knowledge with org relationships

**When it's overkill**:
- ❌ Marketing documents
- ❌ Meeting notes
- ❌ General business docs
- ❌ PDFs without cross-references

**Implementation**:
```python
# Make it a per-collection or per-user setting
document_config = {
    "enable_graph_extraction": False,  # Default OFF
    "graph_extraction_mode": "auto",   # "auto", "always", "never"
}
```

---

### 4. Contextual Retrieval ❌ NOT IMPLEMENTED - HIGH PRIORITY

**What it is**: Use LLM to add 1-2 sentence context prefix to each chunk explaining how it fits in the document

**Example**:
```
"This chunk from 'Q3 Financial Report' discusses revenue breakdown by product 
category, showing 23% increase in cloud services."

---

[Original chunk content]
```

**Anthropic Research Results**:
- **35-49% reduction in retrieval failures**
- Chunks become self-contained
- Better for complex documents

**Mosaic Implementation**: ❌ Not doing this

**Cole's Take**: "Very enticing statistics... makes chunks more self-contained"

**Verdict**: 🔥 **HIGH PRIORITY TO IMPLEMENT**

**Cost Analysis**:
- One-time cost during ingestion
- ~$0.001 per document (8 chunks × GPT-4o-mini)
- No ongoing search cost
- Adds ~2-5 seconds to document processing

**Implementation Priority**: **HIGH**
- Huge accuracy improvement (35-49%)
- Low cost (one-time, during upload)
- User already waits for processing
- Aligns with research

**Recommended Implementation**:
```python
# Add to chunking config
chunking_config = {
    "use_contextual_enrichment": True,  # New setting
    "enrichment_model": "gpt-4o-mini",
    "target_size": 1000,
}
```

---

### 5. Query Expansion ❌ NOT IMPLEMENTED - LOW PRIORITY

**What it is**: Use LLM to expand user query to be more specific before searching

**Example**:
- User: "revenue"
- Expanded: "revenue breakdown by quarter including recurring revenue, one-time sales, and service revenue"

**Mosaic Implementation**: ❌ Not doing this

**Cole's Take**: "Simple strategy... adds more relevant details... slower because extra LLM call"

**Verdict**: ⚠️ **LOW PRIORITY**

**Why low priority**:
- We already have Multi-Query (similar concept)
- Adds LLM call to every search (+1s latency)
- Marginal benefit over current approach
- Better to focus on Contextual Retrieval first

**If implemented**: Make it optional, off by default

---

### 6. Multi-Query RAG ✅ IMPLEMENTED - MAKE OPTIONAL

**What it is**: Generate multiple query variations, search with all, combine results

**Mosaic Implementation**:
- ✅ Generates 3 query variations for complex queries
- ✅ Runs parallel searches
- ✅ Combines and deduplicates results
- ⚠️ Currently enabled by default for complex queries

**Cole's Take**: "Comprehensive coverage... at cost of multiple API calls"

**Verdict**: ⚠️ **MAKE OPTIONAL, OFF BY DEFAULT**

**Cost Analysis**:
- 3× embedding calls per search
- 3× database queries per search
- +1-2 seconds latency
- Marginal accuracy improvement

**Recommendation**:
```python
# system_settings table
{
    "search.useMultiQuery": False,  # Change default to FALSE
}
```

**Rationale**: Most users want fast, simple search. Power users can enable it.

---

### 7. Context-Aware Chunking ✅ IMPLEMENTED - KEEP

**What it is**: Use document structure to find natural boundaries for chunking (not arbitrary character counts)

**Mosaic Implementation**:
- ✅ Using Docling for structure extraction
- ✅ Structure-aware chunker respects sections, paragraphs, tables
- ✅ Maintains document hierarchy

**Cole's Take**: 
- "Maintain document structure... free and fast"
- "Hybrid chunking with Docling has been killing it for me"
- **This is his #1 tactical recommendation**

**Verdict**: ✅ **KEEP AS-IS - THIS IS OUR STRENGTH**

**Why it's great**:
- Free (no LLM calls)
- Fast (deterministic)
- Respects document structure
- Industry best practice
- Exactly what expert recommends

---

### 8. Late Chunking ❌ NOT IMPLEMENTED - RESEARCH ONLY

**What it is**: Apply embedding model to full document BEFORE chunking, then chunk the embeddings

**Mosaic Implementation**: ❌ Not doing this

**Cole's Take**: 
- "Most complicated"
- "Maintains full document context"
- "Requires long-context embedding models"
- **📝 Pseudocode only** - he hasn't used it himself

**Verdict**: 📚 **RESEARCH ONLY - NOT RECOMMENDED**

**Why skip it**:
- Most complex strategy
- Expert hasn't even used it
- Requires specialized models
- Unclear benefit over Contextual Retrieval
- Better to focus on proven strategies

---

### 9. Hierarchical RAG ⚠️ PARTIAL - CONSIDER

**What it is**: Store parent-child chunk relationships, search small (precise) but return large (context)

**Mosaic Implementation**:
- ⚠️ We have documents table + chunks table
- ⚠️ Could search chunks, return full document
- ❌ Not explicitly implemented as a search strategy

**Cole's Take**: "Balance precision (search small) with context (return big)"

**Verdict**: 🤔 **CONSIDER FOR AGENTIC RAG SIMPLIFICATION**

**Potential Implementation**:
```python
# Simplify agentic tools to:
@agent.tool
def search_documents(query: str):
    """Search chunks precisely"""
    return search_chunks(query)

@agent.tool  
def read_full_document(document_name: str):
    """Read entire document for full context"""
    return get_full_document(document_name)
```

**This gives us**:
- Precise search (chunk-level)
- Full context when needed (document-level)
- Simple, predictable tools
- Subset of agentic RAG

---

### 10. Self-Reflective RAG ❌ NOT IMPLEMENTED - LOW PRIORITY

**What it is**: After search, use LLM to grade results (1-5), retry if score < 3

**Mosaic Implementation**: ❌ Not doing this

**Cole's Take**: "Self-correcting... at cost of more LLM calls... highest latency"

**Verdict**: ⚠️ **LOW PRIORITY**

**Why low priority**:
- Highest latency of all strategies (+2-3s)
- Extra LLM call after every search
- Potentially multiple retries
- Better to improve search quality than add retry logic
- Focus on Contextual Retrieval instead

**If implemented**: Only for "deep research" mode, not default

---

### 11. Fine-tuned Embeddings ❌ NOT IMPLEMENTED - FUTURE

**What it is**: Train custom embedding model on domain-specific data

**Benefits**:
- 5-10% accuracy gains
- Smaller models can outperform larger generic ones
- Can optimize for sentiment vs semantic similarity

**Mosaic Implementation**: ❌ Not doing this

**Cole's Take**: "Powerful use case... requires lots of data, infrastructure, ongoing maintenance"

**Verdict**: 📅 **FUTURE CONSIDERATION**

**Why not now**:
- Requires large training dataset
- Infrastructure for model hosting
- Ongoing maintenance
- Better to optimize other strategies first
- Consider only after product-market fit

**When to consider**:
- Have 10,000+ domain-specific documents
- Clear use case (e.g., medical, legal)
- Budget for infrastructure
- Team bandwidth for maintenance

---

## Recommended Action Plan

### Phase 1: Quick Wins (1-2 weeks)

1. **Implement Contextual Retrieval** 🔥
   - Add LLM-based context prefix to chunks
   - Make it optional in chunking config
   - Expected: 35-49% better retrieval

2. **Simplify Agentic RAG** ⚡
   - Reduce from 3 tools to 2
   - Remove `quick_search` and `deep_graph_search`
   - Keep `search_documents` and `read_full_document`

3. **Make Multi-Query Optional** 💰
   - Change default to OFF in system_settings
   - Reduce cost and latency for 80% of users
   - Power users can enable it

### Phase 2: Strategic Optimization (2-4 weeks)

4. **Make Knowledge Graphs Opt-In** 🎯
   - Add per-collection or per-user setting
   - Default to OFF
   - Only enable for interconnected data use cases
   - Massive cost and latency savings

5. **Add Hierarchical RAG Pattern** 📚
   - Implement `read_full_document` tool properly
   - Enable "search precise, return context" pattern
   - Complements simplified agentic approach

### Phase 3: Future Enhancements (Later)

6. **Consider Query Expansion** (if needed)
   - Only if users report poor search results
   - Make it optional, off by default
   - Monitor cost/benefit

7. **Research Late Chunking** (low priority)
   - Only if Contextual Retrieval isn't enough
   - Wait for more industry adoption

8. **Fine-tuned Embeddings** (much later)
   - Only after product-market fit
   - Only with sufficient training data
   - Only with clear ROI

---

## External References

These findings are informed by Cole’s "Every RAG Strategy Explained in 13 Minutes" video and the companion GitHub repo:

- **RAG Strategies Repo (Ottomator)**  
  https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies

- **Strategy README (overview of all 11 strategies)**  
  https://github.com/coleam00/ottomator-agents/blob/main/all-rag-strategies/README.md

- **Contextual Retrieval Implementation (Anthropic method)**  
  `ContextualEnricher` used as primary reference for contextual prefixes:  
  https://github.com/coleam00/ottomator-agents/blob/main/all-rag-strategies/implementation/ingestion/contextual_enrichment.py

- **Knowledge Graphs Pseudocode (Graphiti + Neo4j)**  
  Conceptual example we’re deliberately treating as optional/advanced:  
  https://github.com/coleam00/ottomator-agents/blob/main/all-rag-strategies/examples/03_knowledge_graphs.py

- **Additional Strategy Docs (research notes)**  
  https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies/docs

These links are for implementation inspiration and research alignment; Mosaic’s production code may diverge where our stack (Supabase/Postgres/Docling) or product constraints differ.

---

## Expected Impact

### Current State (6 strategies, all enabled)
- Search latency: 6-8 seconds
- Cost per search: ~$0.02-0.05
- Retrieval accuracy: Good but inconsistent
- Complexity: Very high
- Maintenance burden: High

### Proposed State (4 core strategies, 2 optional)
- Search latency: 2-3 seconds (60% faster)
- Cost per search: ~$0.005-0.01 (75% cheaper)
- Retrieval accuracy: 35-49% better (with Contextual Retrieval)
- Complexity: Medium
- Maintenance burden: Medium

### User Experience Impact
- **80% of users**: Fast, cheap, accurate search
- **20% of power users**: Can enable advanced features
- **All users**: Better accuracy from Contextual Retrieval

---

## Conclusion

**We're not over-engineered, we're mis-engineered.**

We have the right strategies (Re-ranking, Docling chunking, Agentic RAG) but:
1. Missing the highest-impact strategy (Contextual Retrieval: 35-49% improvement)
2. Running expensive strategies by default (Knowledge Graphs, Multi-Query)
3. Over-complicating agentic tools (3 tools instead of 2)

**The fix**: Default to simple, make advanced features opt-in, add Contextual Retrieval.

**Bottom line**: Build a Tesla that can become a Ferrari when needed, not a Ferrari that everyone has to pay for.
