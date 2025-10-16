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

### Corpus-Level Entity Management vs Document-Level Review
**Priority:** High (aligns with Phase 5.4 in BUILD_PLAN)  
**Impact:** Better user control over knowledge graph quality without workflow interruption

**Context:**
Currently, entities are automatically extracted and created during document processing. There's no way for users to review, edit, merge, or delete entities after they're created. This can lead to:
- Low-quality entities polluting the graph
- Duplicate entities with slight name variations
- Abstract concepts being treated as entities
- No way to fix mistakes or improve over time

**Two Approaches Considered:**

**Option A: Document-Level Review (Per-Document Approval)**
- Pause after extraction, show proposed entities
- User approves/rejects before creation
- Pros: Quality gate before creation
- Cons: Interrupts workflow, can't see cross-document duplicates, review fatigue

**Option B: Corpus-Level Management (Post-Processing Curation)** ⭐ RECOMMENDED
- Let automation run without interruption
- Provide `/graph` management page for entire corpus
- User curates entities when convenient, in batches
- Can see patterns, duplicates, and relationships across all documents

**Why Corpus-Level is Better:**
- ✅ No workflow interruption - documents process automatically
- ✅ See the big picture - all entities across corpus in one view
- ✅ Spot duplicates - "Strategic Design Approaches" vs "Strategic Design Approach"
- ✅ Batch operations - merge, delete, edit multiple entities at once
- ✅ Continuous improvement - refine graph over time
- ✅ Scales better - works for 10 or 10,000 documents

**Proposed Implementation (Phase 1 - Quick Win):**

1. **Basic Entity List Page (`/graph`)**
   - View all entities with search/filter
   - Filter by type, document, confidence score
   - Sort by most referenced, newest, confidence
   - Show entity details: name, type, doc count, chunk count
   - Basic delete functionality

2. **Smart Quality Indicators**
   - 🟢 High confidence (>0.85) + Multiple docs
   - 🟡 Medium confidence (0.7-0.85) or Single doc
   - 🔴 Low confidence (<0.7) or Suspicious pattern
   - ⚠️ Potential duplicate detected (similar names/embeddings)

3. **Entity Details Panel**
   - Full description and aliases
   - Documents and chunks where it appears
   - Relationships (incoming/outgoing)
   - Edit name, type, description
   - View context from source chunks

4. **Merge Workflow** (Phase 2)
   - Automatic duplicate detection
   - Select multiple entities → merge into one
   - Choose primary name, combine aliases
   - Synthesize descriptions
   - Union document_ids and chunk_ids
   - Update all relationships

5. **Bulk Operations** (Phase 2)
   - Select multiple entities → delete
   - Filter by confidence → bulk delete low-quality
   - Search pattern → review and clean up

**This aligns with BUILD_PLAN Phase 5.4** which already outlines Graph Management UI. Should prioritize this over document-level review.

**API Endpoints Needed:**
- `GET /api/graph/entities` - List with filters
- `GET /api/graph/entities/:id` - Get details
- `PATCH /api/graph/entities/:id` - Update entity
- `DELETE /api/graph/entities/:id` - Delete entity (uses smart cascade)
- `POST /api/graph/entities/merge` - Merge multiple entities
- Similar endpoints for relationships

**Estimated Effort:**
- Phase 1 (Basic list + delete): 2-3 hours
- Phase 2 (Edit + merge): 1-2 days
- Phase 3 (Relationships): 1-2 days

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
