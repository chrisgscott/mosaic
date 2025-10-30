# Project Structure Guide

## Overview
This is a monorepo containing a full-stack RAG application with AI agents, combining NextJS frontend, Python backend, R2R for RAG, CrewAI for agents, and Supabase for database/auth.

**Project Name:** `mosaic-r2r`  
**R2R Schema:** `mosaic-r2r` (in Supabase Postgres)

## 📚 Documentation

### Core Documentation
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** (this file) - Complete project structure and architecture
- **[SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)** - Step-by-step Supabase authentication setup with R2R
- **[README.md](./README.md)** - Quick start guide and overview
- **[BUILD_PLAN.md](./BUILD_PLAN.md)** - Phased implementation plan

### Multifloor Architecture (Phase 7)
- **[docs/MULTIFLOOR_ARCHITECTURE.md](./docs/MULTIFLOOR_ARCHITECTURE.md)** - Complete multifloor traversal design
- **[COGNITIVE_CARTOGRAPHY.md](./COGNITIVE_CARTOGRAPHY.md)** - Vision document and goals
- **[docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** - Database schema for floors and bridges (TBD)
- **[docs/TRAIL_API.md](./docs/TRAIL_API.md)** - Trail execution API reference (TBD)
- **[docs/CUSTOM_FLOORS.md](./docs/CUSTOM_FLOORS.md)** - Custom floor creation guide (TBD)
- **[docs/TEMPORAL_QUERIES.md](./docs/TEMPORAL_QUERIES.md)** - Temporal query patterns (TBD)

## 🚀 Quick Start

```bash
# Start R2R with Supabase integration
./start.sh

# Stop all services
./stop.sh

# View R2R logs
docker logs -f docker-r2r-1
```

---

## Directory Map

### 📄 Root Files

```
mosaic-r2r/
├── .gitignore                    # Protects secrets (env files, API keys)
├── README.md                     # Project overview and quick start
├── PROJECT_STRUCTURE.md          # This file - complete architecture guide
├── SUPABASE_AUTH_SETUP.md        # Supabase authentication setup guide
├── start.sh                      # Start R2R services
├── stop.sh                       # Stop R2R services
├── llms_r2r.txt                  # R2R documentation reference
└── .git/                         # Single git repository (no submodules)
```

**Important Notes:**
- All `.env` files are gitignored for security
- `.env.example` files are tracked as templates
- `R2R/` is included as regular files (not a git submodule)

---

### 📁 `apps/` - Application Layer
Contains all runnable applications in the monorepo.

#### 📁 `apps/api/` - Python Backend API
**Purpose:** Houses the Python FastAPI/Flask server that orchestrates all backend logic.

**Install here:**
```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install crewai crewai-tools r2r fastapi uvicorn python-dotenv
pip freeze > requirements.txt
```

**What runs here:** FastAPI server that exposes REST endpoints for your frontend to consume.

##### 📁 `apps/api/agents/` - CrewAI Crews
**Purpose:** Houses all CrewAI agent crews. Each crew gets its own subdirectory.

**Structure per crew:**
```
agents/
├── research_crew/
│   ├── config/
│   │   ├── agents.yaml      # Agent definitions (roles, goals, backstories)
│   │   └── tasks.yaml       # Task definitions (descriptions, expected outputs)
│   ├── tools/
│   │   └── custom_tools.py  # Custom tools for this crew
│   ├── crew.py              # Crew orchestration code
│   └── __init__.py
```

**What happens here:** CrewAI crews execute multi-agent workflows. They can call R2R for RAG capabilities via the `rag/` module.

##### 📁 `apps/api/rag/` - R2R Integration Layer
**Purpose:** Wrapper/client code for interacting with the R2R service.

**Example files:**
```
rag/
├── client.py          # R2R client wrapper
├── utils.py           # Helper functions for RAG operations
└── __init__.py
```

**What happens here:** Your Python code imports from here to interact with R2R (running on localhost:7272). Handles document ingestion, search, RAG queries, etc.

**Example usage:**
```python
from rag.client import get_r2r_client

client = get_r2r_client()
results = client.search("query")
```

##### 📁 `apps/api/routes/` - API Route Handlers
**Purpose:** FastAPI/Flask route definitions that expose endpoints to the frontend.

**Example files:**
```
routes/
├── test.py            # GET /test/health - Health check
├── rag.py             # POST /rag/search - RAG queries (auth protected)
├── agents.py          # POST /agents/research - Trigger CrewAI crews
├── documents.py       # POST /documents/ingest - Upload docs to R2R
└── __init__.py
```

**What happens here:** Your NextJS frontend calls these endpoints. These routes orchestrate calls to CrewAI crews and R2R.

##### 📄 `apps/api/auth.py` - Authentication Layer
**Purpose:** Supabase JWT validation and user extraction for protecting API routes.

**Key Functions:**
- `get_current_user()` - FastAPI dependency that validates JWT and extracts user info
- `User` class - User model with id, email, and metadata

**Usage in routes:**
```python
from auth import get_current_user, User
from fastapi import Depends

@router.get("/rag/me")
async def get_user_info(current_user: User = Depends(get_current_user)):
    return {"user": {"id": current_user.id, "email": current_user.email}}
```

**Environment Variables Required:**
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

##### 📄 `apps/api/.env` - Environment Configuration
**Purpose:** Stores environment variables for the Python API (gitignored).

**Required Variables:**
```bash
# R2R Configuration
R2R_URL=http://localhost:7272

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM API Keys (for CrewAI agents)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Important:** No spaces after `=` in env vars!

---

#### 📁 `apps/web/` - NextJS Frontend
**Purpose:** User-facing web application built with NextJS.

**Install here:**
```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app
npm install ai @ai-sdk/openai @supabase/supabase-js
```

**What runs here:** 
- NextJS app (frontend UI)
- **Vercel AI SDK** - For streaming AI responses
- **AI Elements** (shadcn.io/ai) - Beautiful AI chat UI components
- **Supabase Auth** - User authentication

**Tech Stack:**
- **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) - Streaming and state management
- **AI Elements** - Purpose-built React components for AI chat (`<Message>`, `<Response>`, `<Tool>`)
- **shadcn/ui** - Base UI components
- **Supabase** - Authentication and user management

**Architecture Pattern:**
```
1. User types message in AI Elements UI
2. useChat() sends to NextJS API route
3. NextJS route calls Python API for R2R search (gets chunks)
4. NextJS route uses streamText() with chunks as context
5. AI Elements components render streaming response
```

**Complete Example:**
```typescript
// apps/web/app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;
  
  // 1. Get document chunks from Python API (R2R search)
  const searchRes = await fetch('http://localhost:8000/rag/search', {
    method: 'POST',
    headers: { 
      'Authorization': req.headers.get('authorization'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: lastMessage })
  });
  const { chunks } = await searchRes.json();
  
  // 2. Stream response with Vercel AI SDK
  const result = streamText({
    model: openai('gpt-4'),
    messages,
    system: `Context from user's documents:\n${chunks.map(c => c.text).join('\n\n')}`
  });
  
  return result.toDataStreamResponse();
}
```

```typescript
// apps/web/components/chat.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { Message, MessageContent } from '@/components/ai/message';
import { Response } from '@/components/ai/response';
import { Conversation, ConversationContent } from '@/components/ai/conversation';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <Conversation>
      <ConversationContent>
        {messages.map((message) => (
          <Message from={message.role} key={message.id}>
            <MessageContent>
              <Response>{message.content}</Response>
            </MessageContent>
          </Message>
        ))}
      </ConversationContent>
      
      <form onSubmit={handleSubmit}>
        <input 
          value={input} 
          onChange={handleInputChange}
          placeholder="Ask about your documents..."
        />
      </form>
    </Conversation>
  );
}
```

**Structure:**
```
web/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts        # Vercel AI SDK streaming endpoint
│   ├── page.tsx                # Home page with chat
│   └── layout.tsx
├── components/
│   ├── ai/                     # AI Elements components (shadcn.io/ai)
│   │   ├── message.tsx         # <Message> component
│   │   ├── response.tsx        # <Response> component
│   │   ├── conversation.tsx    # <Conversation> component
│   │   └── tool.tsx            # <Tool> component (for CrewAI tools)
│   ├── ui/                     # shadcn/ui base components
│   └── chat.tsx                # Main chat interface
├── lib/
│   └── supabase.ts             # Supabase client
├── package.json
└── next.config.ts
```

**Key Benefits:**
- ✅ **R2R** handles document retrieval (vector search, embeddings)
- ✅ **Vercel AI SDK** handles streaming and state management
- ✅ **AI Elements** provides beautiful, customizable UI components
- ✅ **Full control** - All components live in your codebase
- ✅ **Type-safe** - Full TypeScript support throughout

---

### 📁 `packages/` - Shared Code
Reusable code shared across multiple apps.

#### 📁 `packages/shared-types/` - TypeScript Types
**Purpose:** Shared TypeScript interfaces/types used by both frontend and backend (if using tRPC or similar).

**Example:**
```typescript
// packages/shared-types/src/index.ts
export interface RAGQuery {
  query: string;
  limit?: number;
}

export interface CrewResult {
  output: string;
  tasks: Task[];
}
```

**Used by:** 
- `apps/web` imports these for type safety
- Can generate from Python models if using tools like `pydantic-to-typescript`

#### 📁 `packages/python-utils/` - Shared Python Utilities
**Purpose:** Reusable Python utilities shared across different parts of the Python backend.

**Example:**
```python
# packages/python-utils/auth.py
def verify_token(token: str) -> bool:
    # Shared auth logic
    pass
```

**Used by:** Both `apps/api` and any Python scripts can import from here.

---

### 📁 `R2R/` - R2R Infrastructure
**Purpose:** The R2R repository (cloned from GitHub). Contains Docker configs to run R2R as a service.

**What is R2R?** A production-ready RAG (Retrieval-Augmented Generation) engine that runs as a separate service.

**Current Setup:**
- ✅ Using **Supabase Postgres** (not local Docker Postgres)
- ✅ Using **Session pooler** for connections
- ✅ Custom config at `R2R/docker/user_configs/r2r-supabase.toml`
- ✅ Supabase authentication enabled

**How it runs:** 
```bash
# From project root
./start.sh

# Or manually:
cd R2R/docker
docker compose -f compose.full.yaml --env-file env/r2r-full.env up -d
```

**Important Files:**
- `R2R/docker/env/r2r-full.env` - Environment variables (gitignored - contains secrets)
- `R2R/docker/env/r2r-full.env.example` - Template for env file
- `R2R/docker/user_configs/r2r-supabase.toml` - Custom R2R configuration

**Database Schema:**
R2R creates its own schema in Supabase Postgres:
- Schema: `mosaic-r2r`
- Contains: documents, chunks, collections, users, etc.
- Isolated from your app's `public` schema

**Access:** 
- R2R API: `http://localhost:7272`
- Health check: `http://localhost:7272/v3/health`
- Your Python backend (`apps/api/rag/`) connects via HTTP

**Do NOT install anything here** - This is included as regular files in your repo. Just run it via Docker.

---

### 📁 `supabase/` - Supabase Configuration (Hosted)
**Purpose:** Configuration and migration tracking for your hosted Supabase project.

**Note:** You're using Supabase Cloud (hosted), not self-hosted. This directory contains:
- Migration files for version control
- Local schema snapshots
- Edge function code (deployed to Supabase Cloud)

#### 📁 `supabase/migrations/` - Database Migrations
**Purpose:** SQL migration files tracked in version control. These are applied to your hosted Supabase instance.

**Example:**
```sql
-- supabase/migrations/20240101000000_initial_schema.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**How to use with hosted Supabase:**
```bash
# Link to your hosted project
npx supabase link --project-ref your-project-ref

# Pull existing schema from hosted instance
npx supabase db pull

# Create a new migration
npx supabase migration new add_users_table

# Push migrations to hosted Supabase
npx supabase db push
```

#### 📁 `supabase/functions/` - Supabase Edge Functions
**Purpose:** Edge functions that deploy to your hosted Supabase project.

**Example use cases:**
- Webhooks
- Scheduled tasks
- Auth hooks
- API endpoints that need to be close to Supabase

**Example:**
```typescript
// supabase/functions/process-document/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Process document upload, trigger R2R ingestion
  return new Response('OK')
})
```

**Deploy to hosted Supabase:**
```bash
npx supabase functions deploy process-document
```

---

## Data Flow Examples

### Example 1: User asks a question with RAG

```
1. User types in chat (apps/web/components/chat.tsx)
   ↓
2. Frontend calls Vercel AI SDK endpoint (apps/web/app/api/chat/route.ts)
   ↓
3. API route calls Python backend (apps/api/routes/rag.py)
   ↓
4. Python backend calls R2R client (apps/api/rag/client.py)
   ↓
5. R2R client queries R2R service (localhost:7272)
   ↓
6. R2R returns relevant documents
   ↓
7. Python backend returns context to NextJS API route
   ↓
8. Vercel AI SDK streams response with context to user
```

### Example 2: User triggers a CrewAI research task

```
1. User clicks "Research Topic" button (apps/web)
   ↓
2. Frontend POST to /api/agents/research (apps/api/routes/agents.py)
   ↓
3. Route handler triggers research_crew (apps/api/agents/research_crew/crew.py)
   ↓
4. Crew agents use R2R for context (via apps/api/rag/client.py)
   ↓
5. Crew completes tasks and returns result
   ↓
6. Result sent back to frontend
   ↓
7. Frontend displays research output
```

### Example 3: User uploads a document

```
1. User uploads PDF (apps/web)
   ↓
2. Frontend POST to /api/documents/ingest (apps/api/routes/documents.py)
   ↓
3. Python backend calls R2R ingest (apps/api/rag/client.py)
   ↓
4. R2R processes and indexes document
   ↓
5. Metadata saved to Supabase (optional)
   ↓
6. Success response to frontend
```

---

## Installation Summary

### 1. R2R (Infrastructure)
```bash
cd R2R/docker
# Edit env/r2r-full.env with API keys
docker compose -f compose.full.yaml --env-file env/r2r-full.env --profile postgres up -d
```

### 2. Python Backend
```bash
cd apps/api
python -m venv venv
source venv/bin/activate
pip install crewai crewai-tools r2r fastapi uvicorn python-dotenv supabase
pip freeze > requirements.txt
```

### 3. NextJS Frontend
```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --app
npm install ai @ai-sdk/openai @supabase/supabase-js
```

### 4. Supabase (Hosted - Link to Cloud Project)
```bash
# From project root
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db pull  # Pull existing schema
```

---

## Key Technologies by Location

| Technology | Location | Purpose |
|------------|----------|---------|
| **R2R** | `R2R/` (Docker) | RAG engine (document indexing, semantic search) |
| **CrewAI** | `apps/api/agents/` | Multi-agent orchestration |
| **FastAPI** | `apps/api/main.py` | Python REST API server |
| **Vercel AI SDK** | `apps/web/app/api/` | AI streaming, chat UI |
| **NextJS** | `apps/web/` | Frontend framework |
| **Supabase** | `apps/web/` (client) + `supabase/` (config) | Database, auth, edge functions |
| **R2R Python SDK** | `apps/api/rag/` | Client for R2R service |

---

## Running Everything Locally

```bash
# Terminal 1: Start R2R (from project root)
./start.sh
# Or manually: cd R2R/docker && docker compose -f compose.full.yaml --env-file env/r2r-full.env up

# Terminal 2: Start Python API (when ready)
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 3: Start NextJS (when ready)
cd apps/web
npm run dev
```

**Access:**
- Frontend: http://localhost:3000 (when created)
- Python API: http://localhost:8000 (when created)
- R2R API: http://localhost:7272
- R2R Health: http://localhost:7272/v3/health
- Supabase Studio: https://supabase.com/dashboard/project/lrjgstozjsirqfflympo

**Stop Services:**
```bash
./stop.sh  # Stops R2R
```

---

## Current Configuration

### R2R + Supabase Integration

**Database Setup:**
- **Provider:** Supabase Postgres (hosted)
- **Connection:** Session pooler (`aws-1-us-east-1.pooler.supabase.com:6543`)
- **Schema:** `mosaic-r2r` (isolated from app's `public` schema)
- **SSL:** Required
- **Statement Cache:** Disabled (`statement_cache_size = 0`) for pooler compatibility

**Key Configuration Files:**

1. **`R2R/docker/env/r2r-full.env`** (gitignored)
   ```bash
   R2R_CONFIG_PATH=/app/user_configs/r2r-supabase.toml
   R2R_PROJECT_NAME=mosaic-r2r
   SUPABASE_URL=https://lrjgstozjsirqfflympo.supabase.co
   SUPABASE_KEY=<service-role-key>
   SUPABASE_JWT_SECRET=<jwt-secret>
   ```

2. **`R2R/docker/user_configs/r2r-supabase.toml`**
   - Custom R2R configuration
   - Supabase auth provider enabled
   - Database connection settings
   - LLM model configurations
   - Agent tools and settings

**Why Session Pooler Works:**
- `statement_cache_size = 0` disables prepared statement caching
- `ssl_mode = "require"` for secure connections
- Pooler handles connection management for R2R

**Supabase Project:**
- Project ID: `lrjgstozjsirqfflympo`
- Region: `us-east-1`
- Database: Postgres 17.6

---

## Authentication Architecture

This project uses a **Python API auth layer** with Supabase JWT validation, providing complete control over authentication and user isolation.

**📖 See [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) for complete setup instructions.**

### Architecture Overview:

```
Frontend (NextJS)
  ↓ Supabase JWT in Authorization header
Python API (FastAPI)
  ↓ Validates JWT, extracts user_id
  ↓ Adds user_id to all R2R operations
R2R Service (No Auth)
  ↓ Stores documents with user_id metadata
  ↓ Returns all matching results
Python API
  ↓ Filters results by user_id
  ↓ Returns only user's documents
Frontend
```

### Key Components:

1. **Supabase Auth** - User authentication and JWT generation
2. **Python API Auth Layer** (`apps/api/auth.py`) - JWT validation and user extraction
3. **R2R Service** - Runs without authentication (internal service only)
4. **User Isolation** - Enforced in Python API via user_id metadata

### Benefits:

- ✅ **Full Control** - Own your auth logic, not dependent on R2R
- ✅ **Future-Proof** - R2R updates won't break authentication
- ✅ **Flexible** - Easy to add custom auth rules or switch providers
- ✅ **Debuggable** - Clear separation of concerns
- ✅ **Secure** - R2R not exposed to internet, only Python API

### Implementation:

**Protected Route Example:**
```python
from auth import get_current_user, User
from fastapi import Depends

@router.post("/rag/search")
async def search(
    query: str,
    current_user: User = Depends(get_current_user)
):
    # current_user.id automatically available
    results = await search_with_user_filter(query, current_user.id)
    return results
```

**User Info Endpoint:**
```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:8000/rag/me
# Returns: {"status":"success","user":{"id":"...","email":"..."}}

---

## Questions?

- **Where does Vercel AI SDK go?** → `apps/web` (NextJS app)
- **Where does CrewAI get installed?** → `apps/api` (Python backend)
- **Where does R2R run?** → `R2R/docker` (as a Docker service)
- **Where do I write my agents?** → `apps/api/agents/[crew_name]/`
- **Where do I write my API routes?** → `apps/api/routes/`
- **Where do I write my frontend?** → `apps/web/app/`
- **How do I set up authentication?** → See [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)
