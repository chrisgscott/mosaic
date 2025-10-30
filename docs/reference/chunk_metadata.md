# Chunk Metadata Reference

## Overview
Each chunk in the `chunks` table includes a `metadata` JSONB field containing rich information for citations, deep linking, and enhanced retrieval.

## Metadata Fields

### **Basic Information**
```json
{
  "element_count": 3,           // Number of original document elements in this chunk
  "element_types": [            // Types of elements (Title, NarrativeText, Table, etc.)
    "Title",
    "NarrativeText"
  ]
}
```

### **Page Information** (for citations)
```json
{
  "page_numbers": [5, 6]        // Pages this chunk spans (sorted)
}
```
**Use case:** Display "Found on pages 5-6" in citations

---

### **Table Data** (when chunk contains tables)
```json
{
  "contains_table": true,       // Flag for table-aware processing
  "table_html": "<table>...</table>"  // Structured HTML representation
}
```
**Use case:** 
- Render tables properly in UI
- Enable table-specific search/filtering
- Preserve table structure for LLM context

---

### **PDF Deep Linking** (coordinates)
```json
{
  "coordinates": [{
    "page": 5,
    "x": 72.0,                  // X position on page (points)
    "y": 612.0                  // Y position on page (points)
  }]
}
```
**Use case:** 
- Generate PDF deep links: `file.pdf#page=5&view=FitH,612`
- Highlight exact position in PDF viewer
- Navigate directly to source location

---

### **File Metadata** (source attribution)
```json
{
  "source_filename": "report.pdf",
  "source_directory": "/uploads/user123/",
  "file_last_modified": "2025-10-15T10:30:00Z"
}
```
**Use case:**
- Source attribution in citations
- Track document freshness
- File provenance tracking

---

### **Links** (from HTML/web documents)
```json
{
  "links": [
    "https://example.com/reference",
    "https://docs.example.com/api"
  ]
}
```
**Use case:**
- Extract referenced URLs
- Build knowledge graph of linked resources
- Provide "Learn more" links in responses

---

## Example Complete Metadata

```json
{
  "element_count": 4,
  "element_types": ["Title", "NarrativeText", "Table"],
  "page_numbers": [12, 13],
  "contains_table": true,
  "table_html": "<table><tr><th>Product</th><th>Revenue</th></tr>...</table>",
  "coordinates": [{
    "page": 12,
    "x": 72.0,
    "y": 500.0
  }],
  "source_filename": "Q4-2024-Report.pdf",
  "file_last_modified": "2025-01-15T14:30:00Z"
}
```

---

## Future Use Cases

### **Phase 4: Embeddings**
- Use `element_types` to weight different content types
- Separate embedding strategies for tables vs text

### **Phase 5: Knowledge Graph**
- Extract entities from chunks with `page_numbers` for provenance
- Use `links` to build external knowledge connections

### **Phase 6: Citations & UI**
```typescript
// Generate citation from metadata
function generateCitation(chunk: Chunk): string {
  const pages = chunk.metadata.page_numbers;
  const filename = chunk.metadata.source_filename;
  
  if (pages && pages.length > 0) {
    const pageRange = pages.length > 1 
      ? `pages ${pages[0]}-${pages[pages.length - 1]}`
      : `page ${pages[0]}`;
    return `${filename}, ${pageRange}`;
  }
  return filename;
}

// Generate PDF deep link
function generatePDFLink(chunk: Chunk, documentId: string): string {
  const coords = chunk.metadata.coordinates?.[0];
  if (coords) {
    return `/documents/${documentId}/view#page=${coords.page}&view=FitH,${coords.y}`;
  }
  return `/documents/${documentId}`;
}
```

### **Phase 7: Advanced Search**
- Filter by `element_types`: "Show me only chunks with tables"
- Filter by `page_numbers`: "Search only pages 10-20"
- Filter by `contains_table`: Table-specific queries

---

## Storage Considerations

**JSONB Benefits:**
- ✅ Flexible schema (add fields without migration)
- ✅ Indexable (can create GIN indexes on specific fields)
- ✅ Queryable (use JSON operators in SQL)
- ✅ Compact (binary storage)

**Example Queries:**
```sql
-- Find chunks with tables
SELECT * FROM chunks WHERE metadata->>'contains_table' = 'true';

-- Find chunks on specific page
SELECT * FROM chunks WHERE metadata->'page_numbers' @> '[5]';

-- Find chunks with links
SELECT * FROM chunks WHERE metadata ? 'links';
```

---

*Last updated: 2025-10-15*
