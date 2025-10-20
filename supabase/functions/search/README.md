# Mosaic Search Edge Function

API endpoint for external tools (n8n, Make, Zapier) to access Mosaic's hybrid search capabilities.

## Endpoint

```
POST https://cqtxfjcpgaudugkqjpdc.supabase.co/functions/v1/search
```

## Authentication

Include both the Supabase anon key (for JWT verification) and the custom API key:

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHhmamNwZ2F1ZHVna3FqcGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDYyMzQsImV4cCI6MjA3NTQ4MjIzNH0.OSqWKKAzUCFo_XKJ_5To_0p0kITjVNJLmhQgvCkmx_U
x-api-key: 671138ec6e414f9065ae9c5171addfcd48c0fc8955a19f70a1c7a3a2214a969f
```

## Request Format

```json
{
  "query": "your search query",
  "user_id": "user-uuid",
  "match_threshold": 0.5,
  "match_count": 10,
  "graph_hops": 1
}
```

### Parameters

- **query** (required, string): The search query
- **user_id** (required, string): UUID of the user whose documents to search
- **match_threshold** (optional, number): Minimum similarity score (0-1). Default: 0.5
- **match_count** (optional, number): Maximum number of results to return. Default: 10
- **graph_hops** (optional, number): Number of graph hops for relationship queries. Default: 1

## Response Format

```json
{
  "ok": true,
  "results": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "chunk_index": 0,
      "content": "chunk text content",
      "similarity": 0.85,
      "bm25_score": 2.3,
      "rrf_score": 0.042,
      "rerank_score": 0.92,
      "document_name": "document.pdf",
      "document_file_type": "application/pdf"
    }
  ],
  "query": "original query",
  "count": 10,
  "processing_time_ms": 1234
}
```

## Features

The search endpoint automatically applies advanced RAG techniques based on query complexity:

### Simple Queries (< 5 words, no question words)
- Direct semantic embedding
- Hybrid search (semantic + BM25 with RRF)
- Optional reranking (Cohere)

### Complex Queries (≥ 5 words, question words, multi-part)
- **HyDE**: Generates hypothetical answer document for better retrieval
- **Multi-Query**: Creates 3 query variations for broader coverage
- Parallel embedding generation
- Parallel hybrid searches
- Result merging and deduplication
- Optional reranking (Cohere)

### System Settings

Search behavior is controlled by database settings in `system_settings` table:
- `search.useHyDE`: Enable/disable HyDE (default: true)
- `search.useMultiQuery`: Enable/disable Multi-Query (default: true)
- `search.useReranking`: Enable/disable Cohere reranking (default: true)
- `search.useGraphSearch`: Enable/disable graph-enhanced search (default: true)

## n8n Integration

### HTTP Request Node Setup

1. **Method**: POST
2. **URL**: `https://cqtxfjcpgaudugkqjpdc.supabase.co/functions/v1/search`
3. **Authentication**: None (use custom headers)
4. **Headers**:
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHhmamNwZ2F1ZHVna3FqcGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDYyMzQsImV4cCI6MjA3NTQ4MjIzNH0.OSqWKKAzUCFo_XKJ_5To_0p0kITjVNJLmhQgvCkmx_U`
   - `x-api-key`: `671138ec6e414f9065ae9c5171addfcd48c0fc8955a19f70a1c7a3a2214a969f`
5. **Body** (JSON):
```json
{
  "query": "{{$json.query}}",
  "user_id": "{{$json.user_id}}",
  "match_count": 10
}
```

### Example Workflow

```
Webhook Trigger
  ↓
Set Variables (query, user_id)
  ↓
HTTP Request (Mosaic Search)
  ↓
Process Results
  ↓
Return Response
```

## Error Responses

### 401 Unauthorized
```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "ok": false,
  "error": "Missing 'query' parameter"
}
```

### 500 Internal Server Error
```json
{
  "ok": false,
  "error": "Internal server error",
  "details": "error message"
}
```

## Deployment

The function is deployed to Supabase Edge Functions using the Supabase MCP server:

```bash
# Deploy via Supabase MCP
mcp12_deploy_edge_function(
  project_id="cqtxfjcpgaudugkqjpdc",
  name="search",
  files=[{"name": "index.ts", "content": "..."}]
)
```

## Environment Variables

Required secrets (set via Supabase CLI):
- `MOSAIC_N8N_SEARCH_KEY`: API key for authentication
- `OPENAI_API_KEY`: OpenAI API key for embeddings and LLM calls
- `COHERE_API_KEY`: Cohere API key for reranking (optional)
- `SUPABASE_URL`: Auto-injected by Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Auto-injected by Supabase

## Security Notes

- API key is validated on every request
- Service role key is used server-side (never exposed)
- User ID must be provided to scope search results
- CORS enabled for all origins (can be restricted if needed)
- Rate limiting not implemented (consider adding for production)

## Logs

View function logs in Supabase Dashboard:
https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/logs/edge-functions

Or via CLI:
```bash
supabase functions logs search --project-ref cqtxfjcpgaudugkqjpdc
```

## Future: MCP Server

For a more robust integration with multiple tools and resources, see the MCP Server proposal in `INBOX.md`. The MCP server will:
- Expose multiple tools (search, graph queries, document management)
- Provide automatic schema discovery
- Support both HTTP and stdio transports
- Enable native integration with Claude Desktop, Cline, and other MCP clients
