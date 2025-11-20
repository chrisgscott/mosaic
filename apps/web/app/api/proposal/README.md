# Proposal API Endpoints

These endpoints support the TRANSCOM proposal evaluation tool by leveraging Mosaic's semantic search and knowledge graph capabilities.

## Authentication

All endpoints support two authentication methods:

### 1. API Key (Recommended for External Integrations)
Include the `X-API-Key` header with your requests:

```bash
curl -X POST https://mosaic.render.com/api/proposal/coverage-check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{ ... }'
```

**Setup:** Set `MOSAIC_API_KEY` in your environment variables.

### 2. Cookie-based Auth (For Web UI)
Authenticate through the Mosaic web interface. Your session cookies will be used automatically.

## Endpoints

### 1. Coverage Check

**POST** `/api/proposal/coverage-check`

Analyzes semantic coverage of proposal text against PWS tasks using hybrid search.

**Request:**
```json
{
  "proposal_text": "string - The proposal text to analyze",
  "pws_tasks": [
    {
      "id": "string - Unique task identifier",
      "text": "string - Task description"
    }
  ],
  "session_id": "string (optional) - Filter to specific session documents"
}
```

**Response:**
```json
{
  "coverage": [
    {
      "task_id": "string",
      "coverage_score": 0.85,
      "matched_chunks": [
        {
          "text": "string - Relevant chunk content",
          "similarity": 0.92
        }
      ],
      "gaps": ["string - Identified coverage gaps"]
    }
  ],
  "overall_score": 0.78
}
```

**Example:**
```bash
curl -X POST https://mosaic.render.com/api/proposal/coverage-check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "proposal_text": "Our solution provides comprehensive logistics support...",
    "pws_tasks": [
      {
        "id": "task-1",
        "text": "Provide 24/7 logistics coordination"
      }
    ]
  }'
```

---

### 2. Terminology Validation

**POST** `/api/proposal/terminology`

Validates terminology usage and provides suggestions from the knowledge graph.

**Request:**
```json
{
  "terms": [
    {
      "term": "string - Term to validate",
      "context": "string (optional) - Context for the term"
    }
  ],
  "session_id": "string (optional) - Filter to specific session"
}
```

**Response:**
```json
{
  "results": [
    {
      "term": "string",
      "is_valid": true,
      "entity_match": {
        "name": "string",
        "type": "string",
        "summary": "string"
      },
      "suggestions": [
        {
          "term": "string - Suggested alternative",
          "reason": "string - Why this is suggested"
        }
      ],
      "related_concepts": ["string - Related entity names"]
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://mosaic.render.com/api/proposal/terminology \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "terms": [
      { "term": "TRANSCOM" },
      { "term": "logistics coordination" }
    ]
  }'
```

---

### 3. Context Retrieval

**POST** `/api/proposal/context`

Returns relevant chunks and graph entities/relationships for prompt enrichment.

**Request:**
```json
{
  "query": "string - Query to find context for",
  "max_chunks": 10,
  "max_entities": 5,
  "session_id": "string (optional) - Filter to specific session"
}
```

**Response:**
```json
{
  "chunks": [
    {
      "content": "string - Chunk text",
      "similarity": 0.89,
      "metadata": {
        "document_id": "string",
        "chunk_index": 0
      }
    }
  ],
  "entities": [
    {
      "name": "string",
      "entity_type": "string",
      "summary": "string"
    }
  ],
  "relationships": [
    {
      "source": "string - Source entity name",
      "target": "string - Target entity name",
      "type": "string - Relationship type"
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://mosaic.render.com/api/proposal/context \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "query": "What are the requirements for logistics support?",
    "max_chunks": 5,
    "max_entities": 3
  }'
```

---

### 4. Graph Suggestions

**POST** `/api/proposal/graph-suggest`

Traverses the knowledge graph to find related concepts and provide suggestions.

**Request:**
```json
{
  "entity_name": "string - Starting entity name",
  "max_depth": 2,
  "relationship_types": ["string (optional) - Filter by relationship types"],
  "session_id": "string (optional) - Filter to specific session"
}
```

**Response:**
```json
{
  "entity": {
    "name": "string",
    "type": "string",
    "summary": "string"
  },
  "related_entities": [
    {
      "entity": {
        "name": "string",
        "type": "string",
        "summary": "string"
      },
      "relationship": {
        "type": "string",
        "direction": "outgoing" | "incoming"
      },
      "depth": 1
    }
  ],
  "suggestions": [
    {
      "text": "string - Suggestion text",
      "reason": "string - Why this is suggested"
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://mosaic.render.com/api/proposal/graph-suggest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "entity_name": "TRANSCOM",
    "max_depth": 2
  }'
```

---

## Technical Details

### Performance
- All endpoints target <2s response time
- Parallel processing where possible
- Efficient database queries with proper indexing

### Error Handling
- 401: Unauthorized (missing/invalid auth)
- 400: Bad Request (invalid parameters)
- 404: Not Found (entity not found - graph-suggest only)
- 500: Internal Server Error

### Dependencies
- Supabase for database and auth
- OpenAI for embeddings (text-embedding-3-small)
- Existing `search_chunks_hybrid` RPC function
- Entities and relationships tables

### Session Filtering
All endpoints support optional `session_id` parameter to filter results to documents/entities within a specific session. This is useful for analyzing proposals against session-specific knowledge.

## Implementation Notes

- Uses existing Mosaic infrastructure (search, graph, entities)
- Follows patterns from `/api/search/route.ts`
- Comprehensive logging for debugging
- Type-safe with TypeScript
- CORS-enabled for cross-origin requests
