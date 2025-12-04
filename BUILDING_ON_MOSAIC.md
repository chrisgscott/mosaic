# Building Applications on Mosaic

This guide explains how to build frontend applications on the Mosaic platform. It's written for both developers and AI coding assistants.

---

## Two Ways to Build

### Option 1: Build Inside Mosaic (Recommended)

The `apps/web` Next.js app is designed for extension. It already has:
- **Auth**: Login, signup, password reset, email confirmation
- **User roles**: `is_admin` flag in `profiles` table
- **Route separation**: Admin pages under `/admin/*` are hidden from regular users
- **Components**: shadcn/ui, chat components, sidebar navigation
- **API routes**: Search, chat, documents - all ready to use

**Regular users only see what you build for them.** The admin section (`/admin/*`) is:
- Hidden from the sidebar for non-admin users
- Protected by `requireAdmin()` which redirects non-admins to `/`

**To add your app:**
1. Add routes at the root level: `app/(app)/your-feature/`
2. Update the sidebar in `components/app-sidebar.tsx`
3. Your users see your app; admins also see the Mosaic admin panel

### Option 2: Separate App (External Integration)

If you need complete separation (different auth, white-label, different tech stack), build a standalone app that calls Mosaic's API endpoints. See the [API integration patterns](#common-integration-patterns) below.

---

## What Mosaic Provides

Mosaic is a **document-to-knowledge pipeline** with a REST API. You upload documents, Mosaic processes them into searchable chunks with embeddings, and you query via API.

**Core capabilities:**
- Semantic search over document content
- Hybrid search (semantic + keyword with RRF fusion)
- Cohere reranking for result quality
- Optional knowledge graph for relationship queries

---

## Quick Start: Search API

The primary integration point is `POST /api/search`.

### Authentication

Two options:

```bash
# Option 1: API Key (recommended for backends)
curl -X POST https://your-mosaic-instance.com/api/search \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"query": "your search query"}'

# Option 2: Cookie auth (for browser-based apps)
# Handled automatically via Supabase session
```

Set your API key in environment: `MOSAIC_API_KEY=your-key`

### Basic Search Request

```typescript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.MOSAIC_API_KEY, // or use cookie auth
  },
  body: JSON.stringify({
    query: "What are the purity levels?",
    match_count: 10,
  }),
});

const data = await response.json();
// data.results: SearchResult[]
// data.count: number
// data.processing_time_ms: number
```

### Search Response Format

```typescript
interface SearchResult {
  chunk_id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;           // The actual text content
  similarity: number;        // Semantic similarity (0-1)
  rerank_score?: number;     // Cohere rerank score (0-1)
  metadata?: {
    has_table?: boolean;     // Chunk contains table data
    // ... other metadata
  };
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
  processing_time_ms: number;
}
```

### Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Natural language search query |
| `match_count` | number | 10 | Max results to return |
| `match_threshold` | number | 0.3 | Min similarity score (0-1) |
| `session_id` | string | null | Filter to session-specific documents |
| `skip_reranking` | boolean | false | Skip Cohere reranking (faster) |
| `skip_graph_search` | boolean | false | Skip knowledge graph |
| `force_graph_search` | boolean | false | Force graph search |
| `graph_hops` | number | 1 | Relationship traversal depth |

---

## Building a Chat Interface

For conversational RAG, use the chat API pattern:

### Option 1: Use Mosaic's Chat API

Mosaic includes a full chat implementation at `POST /api/chat` that:
- Manages conversation history
- Uses AI to decide when to search
- Streams responses
- Saves messages to database

```typescript
// Client-side with Vercel AI SDK
import { useChat } from 'ai/react';

function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: {
      chatId: sessionId,
      model: 'standard',  // or 'detailed', 'quick'
    },
  });

  return (
    <form onSubmit={handleSubmit}>
      <input value={input} onChange={handleInputChange} />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Option 2: Build Your Own Chat with Search API

If you want full control, call the search API directly:

```typescript
async function handleUserMessage(userMessage: string, conversationHistory: Message[]) {
  // 1. Search for relevant context
  const searchResponse = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: userMessage,
      match_count: 5,
    }),
  });
  const { results } = await searchResponse.json();

  // 2. Build context from search results
  const context = results
    .map((r, i) => `[${i + 1}] ${r.document_name}:\n${r.content}`)
    .join('\n\n');

  // 3. Generate response with your LLM
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Answer based on the following context:\n\n${context}`,
      },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}
```

---

## Database Schema (Read-Only Access)

If your app needs direct database access, here are the key tables:

### `documents`
```sql
id              uuid PRIMARY KEY
file_name       text
status          text  -- 'uploaded' | 'processing' | 'ready' | 'error'
user_id         uuid
session_id      text  -- Optional: for session-scoped uploads
created_at      timestamptz
```

### `chunks`
```sql
id              uuid PRIMARY KEY
document_id     uuid REFERENCES documents(id)
content         text
chunk_index     integer
metadata        jsonb  -- { has_table: boolean, ... }
```

### `embeddings`
```sql
id              uuid PRIMARY KEY
chunk_id        uuid REFERENCES chunks(id)
embedding       vector(1536)  -- OpenAI text-embedding-3-small
```

**Note:** Row-Level Security (RLS) is enabled. Use API key auth to bypass RLS, or query with user context.

---

## Common Integration Patterns

### Pattern 1: Simple Search Widget

```typescript
// React component for search
function SearchWidget() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, match_count: 5 }),
    });
    const data = await res.json();
    setResults(data.results);
  };

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={handleSearch}>Search</button>
      {results.map(r => (
        <div key={r.chunk_id}>
          <strong>{r.document_name}</strong>
          <p>{r.content.substring(0, 200)}...</p>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 2: Document Q&A Bot

```typescript
// Backend API route
export async function POST(req: Request) {
  const { question } = await req.json();

  // Search Mosaic
  const searchRes = await fetch(`${MOSAIC_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.MOSAIC_API_KEY,
    },
    body: JSON.stringify({ query: question, match_count: 5 }),
  });
  const { results } = await searchRes.json();

  if (results.length === 0) {
    return Response.json({ answer: "I couldn't find relevant information." });
  }

  // Generate answer
  const context = results.map(r => r.content).join('\n\n---\n\n');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Answer based on:\n\n${context}` },
      { role: 'user', content: question },
    ],
  });

  return Response.json({
    answer: completion.choices[0].message.content,
    sources: results.map(r => ({
      document: r.document_name,
      chunk: r.chunk_index,
    })),
  });
}
```

### Pattern 3: n8n / Automation Integration

```json
{
  "nodes": [
    {
      "name": "Search Mosaic",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://your-mosaic.com/api/search",
        "headers": {
          "X-API-Key": "={{$env.MOSAIC_API_KEY}}",
          "Content-Type": "application/json"
        },
        "body": {
          "query": "={{$json.question}}",
          "match_count": 5
        }
      }
    }
  ]
}
```

---

## Performance Characteristics

| Operation | Typical Latency | Cost |
|-----------|-----------------|------|
| Search (with reranking) | 500-800ms | ~$0.001 |
| Search (skip reranking) | 200-400ms | ~$0.0001 |
| Chat response | 3-8s | ~$0.01-0.05 |

**Tips:**
- Use `skip_reranking: true` for speed-critical paths
- Use `match_count: 5` instead of 10 for faster responses
- Cache frequent queries if appropriate

---

## Environment Variables

### If Building Inside Mosaic (Option 1)

No additional env vars needed - you inherit the existing configuration.

### If Building a Separate App (Option 2)

```bash
# Required for API access
MOSAIC_API_KEY=your-api-key
MOSAIC_URL=https://your-mosaic-instance.com

# If using Mosaic's Supabase directly
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # For bypassing RLS
```

---

## What NOT to Do

1. **Don't call the embedding API directly** - Use `/api/search`, it handles embeddings internally
2. **Don't query the `embeddings` table directly** - Use the `search_chunks_hybrid` RPC via the API
3. **Don't assume graph search is enabled** - It's off by default, check settings
4. **Don't hardcode document IDs** - They're UUIDs that change per upload

---

## Getting Help

- **API Health Check:** `GET /api/search` returns status
- **Logs:** Check Mosaic server logs for `[Search]` prefixed messages
- **Settings:** Admin can configure search behavior in `system_settings` table

---

## Summary

**If building inside Mosaic (recommended):**
1. Add your routes under `app/(app)/your-feature/`
2. Update the sidebar navigation in `components/app-sidebar.tsx`
3. Use the existing auth, components, and API routes
4. Regular users see only your app; admins also see the Mosaic admin panel

**If building a separate app:**
1. Use the Search API (`POST /api/search`) as your primary integration point
2. Authenticate with API key header
3. Build context from search results for your LLM
4. Handle sources - results include document names and chunk indices

The search API is stable and handles all the complexity of embeddings, hybrid search, and reranking internally.
