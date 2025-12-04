# Table RAG Optimization

## Overview

Tables in documents present unique challenges for RAG systems:
1. **Retrieval**: Table content doesn't embed well semantically
2. **Chunking**: Tables split across chunks lose context
3. **Answering**: LLMs struggle to parse raw markdown tables

This document describes the optimizations implemented to address these challenges.

## Problem Statement

When a user asks "How many packages are in the packing list?", the system needs to:
1. **Find** the relevant table chunk (retrieval)
2. **Keep** the table intact (chunking)
3. **Read** the table data correctly (answering)

Without optimization, generic queries often fail because:
- Semantic similarity between "packages" and table data is low
- Tables split across chunks lose row/column relationships
- LLMs may not recognize table structure in markdown

## Solution Architecture

### 1. Atomic Table Chunking

Tables are never split across chunks. The `StructureAwareChunker` detects markdown tables and keeps them as single units.

**Implementation**: `apps/backend/ingest/chunkers/structure_aware_chunker.py`

```python
# Tables are stored as tuples: ("table", content, row_count)
# When chunking, tables are kept atomic even if they exceed max_size
if is_table:
    # Flush current content, add table as its own unit
    current_chunk_paras.append(formatted_table)
```

**Metadata added**:
- `has_table: true` - Chunk contains a table
- `table_count: N` - Number of tables in chunk
- `has_table_summary: true` - Table has LLM-generated summary

### 2. Table-to-Text Summarization

Each table gets a natural language summary prepended to improve retrieval.

**Implementation**: `apps/backend/ingest/chunkers/table_summarizer.py`

**Before**:
```markdown
| № места | Брутто | Нетто |
|---------|--------|-------|
| 1       | 104    | 63    |
...
```

**After**:
```markdown
**Table Summary:** Packing list #3 (dated 22.01.07) for shipment of ultrafine 
copper powder: 16 packages with gross weights ranging from 99.5 kg to 104.5 kg, 
each with a net weight of 63 kg. Total gross weight is 1644.5 kg.

| № места | Брутто | Нетто |
|---------|--------|-------|
| 1       | 104    | 63    |
...
```

**Why this works**:
- Summary embeds well for semantic search ("16 packages", "packing list")
- Original table preserved for LLM to read exact values
- Pattern: "table-to-text for retrieval, original table for answering"

**Summary prompt guidance**:
- Start with document type/name (e.g., "Packing list #3")
- Include key entities (companies, products)
- Include aggregates (totals, counts, ranges)
- Include dates and identifiers

### 3. Retrieval Threshold Tuning

Lowered `match_threshold` from 0.5 to 0.3 to allow more candidates through initial retrieval.

**Implementation**: `apps/web/app/api/search/route.ts`

```typescript
match_threshold = 0.3,  // Lowered from 0.5 - reranker handles quality filtering
```

**Rationale**:
- Generic queries ("packing list") have lower semantic similarity than specific ones
- The Cohere reranker filters out low-quality results
- Better to have false positives (filtered by reranker) than false negatives (missed documents)

### 4. Tool Output Formatting

Search results are formatted as readable text with clear source markers.

**Implementation**: `apps/web/lib/ai/tools-fixed.ts`

```typescript
function formatResultsForLLM(results: SearchResult[]): string {
  return results.map((r, i) => {
    const hasTable = r.metadata?.has_table ? " (contains table data)" : "";
    return `--- SOURCE ${i + 1}${hasTable} ---\nDocument: ${r.document_name}\n\n${r.content}\n`;
  }).join("\n");
}
```

### 5. Chat Prompt Updates

Updated system prompt to encourage using retrieved content.

**Key additions**:
- "If search results contain relevant information, USE IT to answer"
- "Look carefully at tables, table summaries, and all text in the results"
- "Tables often contain key data like counts, totals, weights, dates"

## Cost Analysis

| Component | Cost per Table |
|-----------|---------------|
| Table summarization | ~$0.001 (gpt-4o-mini) |
| Additional embedding | ~$0.0001 |
| **Total** | ~$0.001 per table |

## Configuration

### Enable/Disable Table Summarization

```python
# In StructureAwareChunker initialization
chunker = StructureAwareChunker(
    summarize_tables=True,  # Default: True
    table_summary_model="gpt-4o-mini"  # Default model
)
```

### Adjust Match Threshold

```typescript
// In search API call
const { data } = await callSearchAPI({
  query,
  match_threshold: 0.3,  // Lower = more permissive
});
```

## Testing

### Verify Table Chunking
```sql
SELECT chunk_index, metadata->>'has_table', metadata->>'has_table_summary'
FROM chunks WHERE document_id = 'YOUR_DOC_ID';
```

### Verify Table Summary
```sql
SELECT LEFT(content, 500) FROM chunks 
WHERE document_id = 'YOUR_DOC_ID' AND metadata->>'has_table' = 'true';
```

### Test Queries
- Generic: "How many packages are in the packing list?"
- Specific: "What is the gross weight of package #7?"
- Aggregate: "What is the total net weight?"

## Future Improvements

1. **Table metadata boosting**: Boost chunks with `has_table: true` for table-related queries
2. **Structured extraction**: Extract tables to separate database for SQL-like queries
3. **Multi-table reasoning**: Handle queries spanning multiple tables
4. **Table type detection**: Different summarization strategies for different table types
