# INBOX

## 💡 Enhancements & Ideas

### Entity & Relationship Description Synthesis
**Priority:** Medium  
**Impact:** Richer knowledge graph with accumulated knowledge across documents

**Current Behavior:**
When an entity or relationship is mentioned in multiple chunks/documents, we:
- ✅ Append document_ids and chunk_ids to arrays (correctly accumulating references)
- ❌ Keep the original description from first mention (losing new information)
- ❌ Don't merge aliases or update metadata

**Example Problem:**
```
First mention: "Strategic Planning is a methodology for long-term planning"
Second mention: "Strategic Planning involves stakeholder alignment and resource allocation"

Current result: Description stays "A methodology for long-term planning"
Desired result: Description becomes "A methodology for long-term planning that involves 
                 stakeholder alignment and resource allocation"
```

**Proposed Solution:**

1. **Smart Description Synthesis**
   - When updating existing entity/relationship, compare descriptions
   - If new description adds information, use LLM to synthesize them
   - Keep descriptions concise but comprehensive
   - Track synthesis in metadata (e.g., `synthesis_count`)

2. **Alias Merging**
   - Merge new aliases into existing alias array
   - Deduplicate and normalize

3. **Confidence Updates**
   - Increase extraction_confidence when entity seen multiple times
   - Track mention count in metadata

4. **Cost Consideration**
   - Synthesis requires LLM call (~$0.0001 per synthesis)
   - Only synthesize if descriptions are meaningfully different
   - Use fast, cheap model (GPT-4o-mini)

**Benefits:**
- Entities become richer over time as more documents are processed
- Knowledge graph accumulates understanding across corpus
- Better search results (more complete entity descriptions)
- More accurate relationship context

**Implementation Options:**

**Option A: Always Synthesize (Thorough)**
- Every duplicate mention triggers synthesis
- Most complete information
- Higher cost (~$0.01 per document with many entities)

**Option B: Conditional Synthesis (Balanced)**
- Only synthesize if new description is >50% different
- Use simple similarity check first
- Lower cost, still captures new information

**Option C: Periodic Batch Synthesis (Efficient)**
- Accumulate descriptions in array
- Synthesize periodically (e.g., after N mentions)
- Lowest cost, delayed enrichment

**Files to Modify:**
- `apps/backend/ingest/processors/graph_extractor.py` - Add synthesis logic to `store_entity()` and `store_relationship()`
- Consider adding `description_history` JSONB field to track evolution

**Recommended Approach:** Start with Option B (Conditional Synthesis) - good balance of quality and cost.

---

## 🐛 Bugs & Issues

*No items pending - INBOX is clean!*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 16, 2025)
- **HyDE Query Enhancement Tuning** → Phase 6 Enhancements (Medium Priority)
- **Graph Extractor Entity Quality Improvement** → Phase 6 Enhancements (Medium Priority)
- **PGMQ Queue State Corruption Fix** → Phase 6 Enhancements (High Priority)

### Previous Migrations (January 16, 2025)
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements
- Frontend Display Issues → TO_PROCESS.md
- Infrastructure Cleanup → TO_PROCESS.md
- Advanced RAG Patterns → TO_PROCESS.md
- Operational Decisions → TO_PROCESS.md

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
