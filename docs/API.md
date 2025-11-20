# Mosaic API Documentation

**Version:** 1.0  
**Last Updated:** 2025-01-20

Mosaic is a knowledge retrieval system that provides semantic search over your document collections. This API allows external tools to search and retrieve relevant information from the knowledge base.

---

## Table of Contents

- [Authentication](#authentication)
- [Base URL](#base-url)
- [Endpoints](#endpoints)
  - [Search](#post-apisearch)
- [Request Parameters](#request-parameters)
- [Response Format](#response-format)
- [Feature Flags](#feature-flags)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Best Practices](#best-practices)

---

## Authentication

Mosaic supports two authentication methods:

### 1. API Key (Recommended for External Tools)

Include your API key in the `X-API-Key` header:

```bash
curl -X POST https://your-mosaic-instance.com/api/search \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"query": "your search query"}'
```

**Benefits:**
- Bypasses Row-Level Security (searches all documents)
- Suitable for server-to-server communication
- No session management required

### 2. Cookie-based Session (Web UI)

Used automatically by the Mosaic web interface. Not recommended for external integrations.

---

## Base URL

```
Production: https://your-mosaic-instance.com
Development: http://localhost:3000
```

---

## Endpoints

### POST /api/search

Search the knowledge base using semantic search with optional enhancements.

**URL:** `/api/search`  
**Method:** `POST`  
**Auth Required:** Yes (API Key or Session)

#### Request Body

```json
{
  "query": "string (required)",
  "match_count": "number (optional, default: 10)",
  "match_threshold": "number (optional, default: 0.5)",
  "session_id": "string (optional)",
  "skip_hyde": "boolean (optional, default: false)",
  "skip_multi_query": "boolean (optional, default: false)",
  "skip_graph_search": "boolean (optional, default: false)",
  "skip_reranking": "boolean (optional, default: false)",
  "force_graph_search": "boolean (optional, default: false)",
  "extended_graph_traversal": "boolean (optional, default: false)",
  "graph_hops": "number (optional, default: 1)"
}
```

#### Response

```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "content": "string",
      "similarity": "number (0-1)",
      "rerank_score": "number (0-1)",
      "document_id": "uuid",
      "document_name": "string",
      "chunk_index": "number",
      "metadata": {}
    }
  ],
  "query": "string",
  "count": "number",
  "processing_time_ms": "number"
}
```

---

## Request Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | The search query text. Natural language queries work best. |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `match_count` | number | 10 | Maximum number of results to return |
| `match_threshold` | number | 0.5 | Minimum similarity score (0-1). Lower = more results |
| `session_id` | string | null | Filter results to specific chat session documents |

### Feature Control Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skip_hyde` | boolean | false | Skip HyDE (Hypothetical Document Embeddings) generation |
| `skip_multi_query` | boolean | false | Skip multi-query expansion |
| `skip_graph_search` | boolean | false | Skip knowledge graph enhancement |
| `skip_reranking` | boolean | false | Skip Cohere reranking |
| `force_graph_search` | boolean | false | Force graph search even if not auto-detected |
| `extended_graph_traversal` | boolean | false | Use deeper graph traversal (3+ hops) |
| `graph_hops` | number | 1 | Number of relationship hops for graph search |

---

## Response Format

### Success Response (200 OK)

```json
{
  "results": [
    {
      "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
      "content": "Strategic airlift is a national asymmetric advantage...",
      "similarity": 0.87,
      "rerank_score": 0.92,
      "document_id": "123e4567-e89b-12d3-a456-426614174000",
      "document_name": "TRANSCOM_Statement.pdf",
      "chunk_index": 5,
      "metadata": {
        "page": 3,
        "section": "Strategic Capabilities"
      }
    }
  ],
  "query": "What are TRANSCOM strategic airlift requirements?",
  "count": 5,
  "processing_time_ms": 1996
}
```

### Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `chunk_id` | uuid | Unique identifier for this chunk |
| `content` | string | The text content of the chunk |
| `similarity` | number | Semantic similarity score (0-1) from vector search |
| `rerank_score` | number | Relevance score (0-1) from Cohere reranking (if enabled) |
| `document_id` | uuid | ID of the source document |
| `document_name` | string | Name of the source document |
| `chunk_index` | number | Position of chunk within document |
| `metadata` | object | Additional metadata (page numbers, sections, etc.) |

**Note:** Use `rerank_score` when available (more accurate). Fall back to `similarity` if reranking is disabled.

---

## Feature Flags

### HyDE (Hypothetical Document Embeddings)

**What it does:** Generates a hypothetical answer to your query, then searches for documents similar to that answer.

**When to use:**
- ✅ Complex questions requiring deep understanding
- ✅ Queries with 5+ words
- ✅ Questions starting with "how", "why", "what", "explain"

**When to skip:**
- ❌ Simple keyword lookups
- ❌ Speed is critical (adds ~1-2 seconds)
- ❌ Short queries (< 5 words)

**Cost:** 1 additional LLM call per search

---

### Multi-Query Expansion

**What it does:** Generates 3 variations of your query and searches with all of them, combining results.

**When to use:**
- ✅ Complex or ambiguous queries
- ✅ When you want comprehensive coverage
- ✅ Research-oriented searches

**When to skip:**
- ❌ Simple, specific queries
- ❌ Speed is critical (adds ~2-3 seconds)
- ❌ Cost-sensitive applications

**Cost:** 1 LLM call + 3x embedding calls + 3x searches

---

### Reranking

**What it does:** Uses Cohere's rerank model to re-score results for better relevance.

**When to use:**
- ✅ Almost always (highly recommended)
- ✅ When accuracy matters more than speed
- ✅ Complex queries with many potential matches

**When to skip:**
- ❌ Speed is absolutely critical (adds ~200-300ms)
- ❌ Very simple keyword matches
- ❌ Cost-sensitive applications

**Cost:** 1 Cohere API call per search

---

### Graph Search

**What it does:** Enhances results using knowledge graph relationships (entities and connections).

**When to use:**
- ✅ Queries about relationships ("who reports to", "what's related to")
- ✅ When exploring connected concepts
- ✅ Research requiring context

**When to skip:**
- ❌ Simple document retrieval
- ❌ No knowledge graph data available
- ❌ Speed is critical

**Cost:** Additional database queries for graph traversal

---

## Examples

### Example 1: Simple, Fast Search

**Use case:** Quick lookup, speed matters

```bash
curl -X POST http://localhost:3000/api/search \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "strategic airlift requirements",
    "match_count": 5,
    "skip_hyde": true,
    "skip_multi_query": true,
    "skip_graph_search": true
  }'
```

**Performance:** ~2 seconds  
**Cost:** Low (embeddings + reranking only)

---

### Example 2: High-Quality Research

**Use case:** Comprehensive research, quality matters

```bash
curl -X POST http://localhost:3000/api/search \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does TRANSCOM coordinate strategic airlift operations?",
    "match_count": 10,
    "skip_hyde": false,
    "skip_multi_query": false,
    "skip_graph_search": false,
    "skip_reranking": false
  }'
```

**Performance:** ~8 seconds  
**Cost:** High (all features enabled)

---

### Example 3: Balanced Approach (Recommended)

**Use case:** Good quality, reasonable speed

```bash
curl -X POST http://localhost:3000/api/search \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "TRANSCOM mission assurance requirements",
    "match_count": 10,
    "skip_hyde": true,
    "skip_multi_query": true,
    "skip_graph_search": true,
    "skip_reranking": false
  }'
```

**Performance:** ~2-3 seconds  
**Cost:** Medium (reranking only)

---

### Example 4: JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3000/api/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.MOSAIC_API_KEY,
  },
  body: JSON.stringify({
    query: 'What are the key requirements?',
    match_count: 5,
    skip_hyde: true,
    skip_multi_query: true,
  }),
});

const data = await response.json();

// Use rerank_score if available, otherwise similarity
data.results.forEach(result => {
  const score = result.rerank_score || result.similarity;
  console.log(`Score: ${score.toFixed(3)} - ${result.document_name}`);
  console.log(`Content: ${result.content.substring(0, 100)}...`);
});
```

---

### Example 5: Python

```python
import requests
import os

response = requests.post(
    'http://localhost:3000/api/search',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': os.environ['MOSAIC_API_KEY'],
    },
    json={
        'query': 'strategic airlift requirements',
        'match_count': 5,
        'skip_hyde': True,
        'skip_multi_query': True,
    }
)

data = response.json()

for result in data['results']:
    score = result.get('rerank_score', result.get('similarity'))
    print(f"Score: {score:.3f} - {result['document_name']}")
    print(f"Content: {result['content'][:100]}...")
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### Common Error Codes

| Status | Error | Description | Solution |
|--------|-------|-------------|----------|
| 401 | Unauthorized | Missing or invalid API key | Check `X-API-Key` header |
| 400 | Bad Request | Invalid parameters | Verify request body format |
| 500 | Internal Server Error | Server-side error | Check server logs, retry |

### Example Error Response

```json
{
  "error": "Unauthorized",
  "details": "Invalid API key"
}
```

---

## Rate Limits

**Current limits:**
- No hard rate limits implemented
- Cohere reranking: ~9 calls/minute (internal rate limiting)
- Recommended: Max 10 concurrent requests per API key

**Best practices:**
- Implement exponential backoff for retries
- Cache results when possible
- Batch similar queries together

---

## Best Practices

### 1. Choose the Right Feature Set

**For most use cases (recommended):**
```json
{
  "skip_hyde": true,
  "skip_multi_query": true,
  "skip_graph_search": true,
  "skip_reranking": false
}
```
- Fast (~2 seconds)
- High quality (reranking enabled)
- Cost-effective

---

### 2. Interpreting Scores

**Rerank scores (when available):**
- `> 0.9` - Excellent match, highly relevant
- `0.7 - 0.9` - Good match, relevant
- `0.5 - 0.7` - Moderate match, possibly relevant
- `< 0.5` - Weak match, may not be relevant

**Similarity scores (fallback):**
- `> 0.8` - Strong semantic similarity
- `0.6 - 0.8` - Moderate similarity
- `< 0.6` - Weak similarity

**Always prefer `rerank_score` over `similarity` when available.**

---

### 3. Query Optimization

**Good queries:**
- ✅ "What are TRANSCOM strategic airlift requirements?"
- ✅ "Mission assurance risk management processes"
- ✅ "C-17 fleet readiness and availability"

**Poor queries:**
- ❌ "requirements" (too vague)
- ❌ "what is it" (no context)
- ❌ Single keywords (use phrases)

**Tips:**
- Use natural language questions
- Include specific terms and concepts
- Be specific but not overly narrow
- 5-15 words is usually optimal

---

### 4. Result Handling

```javascript
// Example: Filtering by quality threshold
const highQualityResults = data.results.filter(r => 
  (r.rerank_score || r.similarity) > 0.7
);

// Example: Grouping by document
const byDocument = data.results.reduce((acc, result) => {
  if (!acc[result.document_name]) {
    acc[result.document_name] = [];
  }
  acc[result.document_name].push(result);
  return acc;
}, {});

// Example: Extracting evidence
const evidence = data.results
  .slice(0, 3)
  .map(r => ({
    source: r.document_name,
    content: r.content.substring(0, 200),
    score: r.rerank_score || r.similarity
  }));
```

---

### 5. Performance Optimization

**Fast searches (< 2 seconds):**
```json
{
  "skip_hyde": true,
  "skip_multi_query": true,
  "skip_graph_search": true,
  "skip_reranking": false,
  "match_count": 5
}
```

**Comprehensive searches (8-10 seconds):**
```json
{
  "skip_hyde": false,
  "skip_multi_query": false,
  "skip_graph_search": false,
  "skip_reranking": false,
  "match_count": 20
}
```

**Trade-off matrix:**

| Feature | Speed Impact | Quality Impact | Cost Impact |
|---------|--------------|----------------|-------------|
| HyDE | +1-2s | +10-15% | +1 LLM call |
| Multi-Query | +2-3s | +15-20% | +1 LLM + 3x embeddings |
| Graph Search | +0.5-1s | +5-10% | +DB queries |
| Reranking | +0.2-0.3s | +20-30% | +1 Cohere call |

---

### 6. Error Handling Example

```javascript
async function searchMosaic(query, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.MOSAIC_API_KEY,
        },
        body: JSON.stringify({
          query,
          match_count: 10,
          skip_hyde: true,
          skip_multi_query: true,
          ...options,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }
      
      return await response.json();
      
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      
      // Exponential backoff
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
  
  throw new Error(`Search failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## Architecture Principles

### Mosaic's Responsibility
- ✅ Search documents semantically
- ✅ Return chunks with relevance scores
- ✅ Provide accurate, relevant results

### Your Tool's Responsibility
- ✅ Determine what queries to send
- ✅ Interpret relevance scores
- ✅ Apply business logic (thresholds, rules)
- ✅ Calculate final scores/decisions
- ✅ Generate recommendations

**Mosaic is a librarian, not a decision-maker.** It provides data; your tool provides intelligence.

---

## Support

**Documentation:** `/docs/API.md`  
**Issues:** GitHub Issues  
**Questions:** Contact your Mosaic administrator

---

## Changelog

### v1.0 (2025-01-20)
- Initial API documentation
- Added API key authentication
- Added feature control parameters
- Added comprehensive examples
