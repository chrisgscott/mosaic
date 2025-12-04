# Mosaic

**A RAG-powered knowledge platform you clone and build on.**

Mosaic transforms documents into a searchable knowledge base with semantic search, chat, and knowledge graph features. Clone it, run the setup wizard, and start building your app on top of it.

---

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/chrisgscott/mosaic.git my-app
cd my-app
./setup.sh
```

The setup wizard walks you through:
- Connecting to your Supabase project
- Adding your API keys (OpenAI, Cohere)
- Creating your `.env` files
- Setting up the database

### 2. Install Dependencies

```bash
# Frontend
cd apps/web && npm install && cd ../..

# Backend
cd apps/backend/ingest
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ../../..
```

### 3. Run It

```bash
# Terminal 1: Frontend
./start-frontend.sh

# Terminal 2: Backend (document processing)
./start-backend.sh
```

Open http://localhost:3000, sign up, then make yourself admin:

```sql
-- Run in Supabase SQL Editor
UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
```

---

## What You Get

### Already Built
| Feature | Description |
|---------|-------------|
| **Document Upload** | PDF, DOCX, TXT, MD with async processing |
| **Semantic Search** | Hybrid search (vector + BM25) with Cohere reranking |
| **Chat Interface** | Streaming RAG chat with tool use |
| **Knowledge Graph** | Entity/relationship extraction and visualization |
| **Settings UI** | Admin panel for all configuration |
| **User Auth** | Supabase auth with admin/user roles |
| **API Keys** | Multi-tenant API access for external apps |

### Tech Stack
- **Frontend**: Next.js 15, React, Tailwind, shadcn/ui
- **Backend**: Python (document processing worker)
- **Database**: Supabase (Postgres + pgvector + pgmq)
- **AI**: OpenAI (embeddings, chat), Cohere (reranking), Docling (document parsing)

---

## Building Your App

### The Pattern

Mosaic is designed to be cloned and extended. The admin features (document management, settings, graph viewer) are hidden from regular users. You build your app for regular users; admins also see the Mosaic admin panel.

```
Your Users See:           Admins Also See:
┌──────────────────┐      ┌──────────────────┐
│ Your App Pages   │      │ Your App Pages   │
│ /dashboard       │      │ /dashboard       │
│ /your-feature    │      │ /your-feature    │
│                  │      ├──────────────────┤
│                  │      │ Admin Panel      │
│                  │      │ /admin/documents │
│                  │      │ /admin/settings  │
│                  │      │ /admin/graph     │
└──────────────────┘      └──────────────────┘
```

### Add Your Pages

1. Create routes at `apps/web/app/(app)/your-feature/`
2. Update the sidebar in `components/app-sidebar.tsx`
3. Use the existing search API, chat components, and auth

### Use the Search API

```typescript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "your search query",
    match_count: 10,
  }),
});

const { results } = await response.json();
// results: [{ chunk_id, content, similarity, document_name, ... }]
```

### External Integration

For external apps (n8n, bots, mobile apps), create an API key in `/admin/api-keys` and use it:

```bash
curl -X POST https://your-app.com/api/search \
  -H "X-API-Key: msk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "your search"}'
```

---

## Project Structure

```
mosaic/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/(app)/          # App routes (add yours here)
│   │   │   ├── admin/          # Admin panel (hidden from users)
│   │   │   └── your-feature/   # Your app pages
│   │   ├── components/         # React components
│   │   └── lib/                # Utilities, API clients
│   │
│   └── backend/
│       └── ingest/             # Python document processor
│           ├── main.py         # Queue worker
│           ├── processors/     # Docling, embeddings, graph
│           └── chunkers/       # Document chunking strategies
│
├── supabase/
│   └── migrations/             # Database schema
│
├── docs/                       # Documentation
├── setup.sh                    # Interactive setup wizard
└── start-*.sh                  # Run scripts
```

---

## Configuration

### Environment Variables

After running `./setup.sh`, your `.env` files are created. Key variables:

**Frontend** (`apps/web/.env`):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `OPENAI_API_KEY` - For embeddings and chat
- `COHERE_API_KEY` - For search reranking

**Backend** (`apps/backend/ingest/.env`):
- `DATABASE_URL` - Postgres connection for pgmq
- `OPENAI_API_KEY` - For document processing
- `ENABLE_GRAPH_EXTRACTION` - Toggle knowledge graph (default: true)

### Admin Settings

Most settings are configurable in the admin UI at `/admin/settings`:
- **Search**: Reranking, graph search, HyDE, multi-query
- **LLM**: Model selection, temperature
- **Processing**: Chunk size, workers, graph extraction

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/app/api/search/route.ts` | Search API endpoint |
| `apps/web/app/api/chat/route.ts` | Chat API with streaming |
| `apps/web/components/app-sidebar.tsx` | Navigation (add your links) |
| `apps/web/lib/api-auth.ts` | API key authentication |
| `apps/backend/ingest/main.py` | Document processing worker |
| `supabase/migrations/00000000_initial_schema.sql` | Complete DB schema |

---

## Common Tasks

### Add a New Page

```bash
mkdir -p apps/web/app/\(app\)/my-feature
```

```tsx
// apps/web/app/(app)/my-feature/page.tsx
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function MyFeaturePage() {
  return (
    <>
      <header className="flex h-16 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <h1>My Feature</h1>
      </header>
      <div className="p-4">
        {/* Your content */}
      </div>
    </>
  );
}
```

### Query the Knowledge Base

```typescript
// From a server component or API route
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data } = await supabase.rpc("search_chunks_hybrid", {
  query_text: "your query",
  query_embedding: embedding, // Generate with OpenAI
  match_count: 10,
});
```

### Process Documents Programmatically

Documents are processed via a queue. To add a document:

```typescript
// Upload to storage
await supabase.storage.from("documents").upload(path, file);

// Create record
const { data: doc } = await supabase.from("documents").insert({
  file_name: "doc.pdf",
  file_path: path,
  user_id: userId,
}).select().single();

// Enqueue for processing
await supabase.rpc("pgmq_send", {
  queue_name: "document_processing",
  msg: { document_id: doc.id, file_path: path },
});
```

---

## Troubleshooting

### Documents stuck in "processing"
- Check the backend terminal for errors
- Verify `OPENAI_API_KEY` is valid
- Check Supabase Storage bucket exists and has policies

### Search returns no results
- Verify documents have status "ready" in the database
- Check the `chunks` and `embeddings` tables have data
- Lower `match_threshold` (default 0.3)

### Can't see admin panel
- Run: `UPDATE profiles SET is_admin = true WHERE email = 'you@email.com';`
- Sign out and back in

---

## Documentation

- **[Building on Mosaic](./BUILDING_ON_MOSAIC.md)** - Detailed guide for building apps
- **[Getting Started](./docs/guides/getting_started.md)** - Full setup walkthrough
- **[Architecture](./docs/architecture/)** - System design docs

---

## License

MIT
