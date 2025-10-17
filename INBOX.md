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

**Option D: Lazy Synthesis on Retrieval (BEST)** ⭐ RECOMMENDED
- Store all raw extractions in `document_entities` (no synthesis during ingestion)
- When entity is accessed/retrieved, synthesize on-demand from all mentions
- Cache synthesized result for performance
- Only pay synthesis cost for entities that are actually used
- Aligns perfectly with two-level graph architecture

**Why Option D is Superior:**
- ✅ **Zero ingestion overhead** - No synthesis during document processing
- ✅ **Pay only for what's used** - Only synthesize entities that users access
- ✅ **Always fresh** - Synthesis happens with latest data
- ✅ **Scales better** - Most entities never accessed, so never synthesized
- ✅ **Enables experimentation** - Can change synthesis strategy without reprocessing
- ✅ **Natural fit** - Synthesis happens during document_entities → global entity resolution

**Implementation with Two-Level Architecture:**
```python
# During ingestion: Just store raw extraction
document_entity = {
    "document_id": doc_id,
    "chunk_id": chunk_id,
    "name": "Strategic Planning",
    "description": "A methodology involving stakeholder alignment...",
    "extracted_at": now()
}
# No synthesis, no merging - just store

# During retrieval/resolution: Synthesize on demand
async def get_or_create_global_entity(entity_name):
    # Check cache first
    cached = await cache.get(f"entity:{entity_name}")
    if cached:
        return cached
    
    # Get all document_entities for this entity
    raw_extractions = await get_document_entities(entity_name)
    
    # Synthesize description from all mentions
    synthesized_description = await synthesize_descriptions([
        e.description for e in raw_extractions
    ])
    
    # Create/update global entity
    global_entity = {
        "name": entity_name,
        "description": synthesized_description,
        "document_ids": [e.document_id for e in raw_extractions],
        "source_count": len(raw_extractions)
    }
    
    # Cache result
    await cache.set(f"entity:{entity_name}", global_entity, ttl=3600)
    
    return global_entity
```

**Cost Analysis:**
- 1000 documents with 50 entities each = 50,000 raw extractions
- But only 500 unique entities accessed by users
- Synthesis cost: 500 × $0.0001 = $0.05 (vs $5.00 for synthesizing all 50,000)
- **100x cost reduction** by synthesizing only what's accessed

**Files to Modify:**
- `apps/backend/ingest/processors/graph_extractor.py` - Keep simple (just store raw)
- Add entity resolution service that synthesizes on retrieval
- Implement caching layer for synthesized entities

**Recommended Approach:** Option D (Lazy Synthesis on Retrieval) - best performance, cost, and scalability. Implement as part of two-level graph architecture.

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

### Two-Level Graph Architecture (Document + Global Entities)
**Priority:** High (Critical for enterprise requirements)  
**Impact:** Enables cross-source intelligence, audit trails, multi-source validation, temporal tracking

**Context:**
Mosaic is an **enterprise-grade intelligence platform foundation** designed for multi-billion dollar companies with requirements for:
- Cross-source entity resolution (documents + structured data + news feeds)
- Multi-source validation and confidence scoring
- Complete audit trails and data lineage
- Temporal tracking of entity evolution
- Multi-tenant organization isolation
- Compliance-ready provenance tracking

**Current Architecture (Single-Level):**
```sql
entities (
  id, name, type, description,
  document_ids[], chunk_ids[],  -- Track which docs mention this
  embedding
)
```

**Limitations:**
- ❌ Can't see raw extraction per document/source
- ❌ No immutable audit trail (entities are updated in place)
- ❌ Can't track which source contributed what information
- ❌ Difficult to re-run deduplication with different strategies
- ❌ Can't calculate confidence from source diversity
- ❌ No temporal tracking of entity evolution

**Proposed Architecture (R2R-Style Two-Level):**

**Level 1: Document Entities (Raw Extractions)**
```sql
document_entities (
  id, user_id, organization_id,
  document_id, chunk_id,
  source_type,  -- 'document', 'structured_data', 'news_feed'
  name, type, description, aliases,
  confidence,
  extracted_at,
  extraction_metadata JSONB
)
```

**Level 2: Global Entities (Deduplicated)**
```sql
entities (
  id, user_id, organization_id,
  name, canonical_name, type, description, aliases,
  
  -- Multi-source tracking
  document_ids[], chunk_ids[],
  data_source_ids[], news_article_ids[],
  source_count, source_types[],
  
  -- Aggregated confidence
  confidence,
  first_seen, last_updated,
  
  embedding,
  created_at, updated_at
)

entity_sources (  -- Provenance link table
  entity_id, document_entity_id,
  contribution_type,  -- 'name', 'description', 'alias'
  contributed_at
)
```

**Benefits for Enterprise Mosaic:**

1. **Cross-Source Intelligence (Tier 0)**
   - Track which sources contributed to each entity
   - "Strategic Planning appears in 3 PDFs, 2 databases, 5 news articles"
   - Calculate confidence from source diversity
   - 360-degree entity views from all data sources

2. **Multi-Source Validation**
   - Confidence scoring based on cross-source confirmation
   - Higher confidence when entity appears in multiple source types
   - Risk correlation across document/data/news sources

3. **Audit Trails & Compliance**
   - Immutable extraction records (document_entities never deleted)
   - Complete provenance via entity_sources link table
   - Can answer: "Where did this information come from?"
   - Regulatory compliance for data lineage

4. **Temporal Tracking**
   - See how entity descriptions evolved over time
   - Track when each source contributed information
   - Query: "Show me how understanding of X changed over 6 months"

5. **Flexible Entity Resolution**
   - Re-run deduplication with different thresholds
   - Experiment with merging strategies without losing raw data
   - A/B test entity resolution algorithms

6. **Organization Isolation**
   - Both levels scoped to organization_id
   - Multi-tenant RLS policies at document and global levels
   - Enterprise-grade data isolation

**Implementation Strategy:**

**Phase 1: Add Document-Level Tables**
- Create `document_entities` table
- Create `entity_sources` link table
- Add indexes for performance
- Implement RLS policies

**Phase 2: Modify Entity Extractor**
- Store raw extraction in `document_entities` first
- Then merge into global `entities`
- Track provenance in `entity_sources`
- Preserve existing deduplication logic

**Phase 3: Entity Resolution Service**
- Background job to merge document → global entities
- Configurable similarity thresholds
- Confidence scoring from source diversity
- Description synthesis from multiple sources

**Phase 4: Extend to Multi-Source**
- Add `source_type` field ('document', 'data', 'news')
- Track data_source_ids and news_article_ids
- Cross-source entity resolution
- Multi-source confidence scoring

**Query Patterns:**

```sql
-- Users query global entities (deduplicated, fast)
SELECT * FROM entities WHERE organization_id = $1 AND embedding <=> $2 < 0.3;

-- Audit trail uses document entities (provenance)
SELECT de.*, d.file_name, c.content
FROM document_entities de
JOIN entity_sources es ON es.document_entity_id = de.id
JOIN documents d ON d.id = de.document_id
WHERE es.entity_id = $1 ORDER BY de.extracted_at;

-- Multi-source validation (confidence calculation)
SELECT e.name, 
  COUNT(DISTINCT de.document_id) as doc_count,
  COUNT(DISTINCT de.source_type) as source_type_count,
  AVG(de.confidence) as avg_confidence
FROM entities e
JOIN entity_sources es ON es.entity_id = e.id
JOIN document_entities de ON de.id = es.document_entity_id
WHERE e.id = $1 GROUP BY e.id;
```

**Storage Overhead vs. Capabilities:**
- Yes, duplicate data (same entity stored N times in document_entities)
- But: Essential for enterprise requirements (audit, compliance, provenance)
- Trade-off: More storage for critical capabilities
- Aligns with Mosaic's enterprise-grade positioning

**This aligns with:**
- Mosaic's Four-Tier Intelligence Architecture (Tier 0: Cross-Source Knowledge Graph)
- Universal Citation System (10 citation types with provenance)
- Multi-tenant security requirements
- Enterprise compliance and audit needs

**Same pattern should apply to relationships:**
- `document_relationships` (raw extractions)
- `relationships` (global, deduplicated)
- `relationship_sources` (provenance)

**Estimated Effort:**
- Phase 1 (Tables + RLS): 1 day
- Phase 2 (Extractor changes): 1-2 days
- Phase 3 (Resolution service): 2-3 days
- Phase 4 (Multi-source extension): 2-3 days
- Total: ~1-2 weeks for complete implementation

**Decision:** This is the right architecture for Mosaic's enterprise requirements. The storage overhead is justified by the critical capabilities it enables.

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
