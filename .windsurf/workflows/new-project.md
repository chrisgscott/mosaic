---
description: Set up a new Mosaic-based project with Supabase and all configuration
---

# New Mosaic Project Setup

Use this workflow when cloning Mosaic to start a new project. The AI will handle database setup via MCP and guide you through configuration.

## Prerequisites

Before starting, you need:
1. A new Supabase project (create at https://supabase.com)
2. Your API keys ready:
   - OpenAI API key (https://platform.openai.com/api-keys)
   - Cohere API key (https://dashboard.cohere.com/api-keys)

## Step 1: Collect Project Information

Ask the user for:
- **Project name** (for .env comments and reference)
- **Supabase project ID** (the `xxxxx` part of `xxxxx.supabase.co`)

## Step 2: Get Supabase Credentials

Ask the user to provide (from Supabase Dashboard > Settings > API):
- Supabase URL (e.g., `https://xxxxx.supabase.co`)
- Anon/Publishable key (starts with `eyJ...`)
- Service role key (starts with `eyJ...`)
- Database password (from Settings > Database)

## Step 3: Apply Database Schema

// turbo
Use MCP to apply the initial schema:

```
mcp10_apply_migration(
  project_id: "<supabase_project_id>",
  name: "initial_schema",
  query: <contents of supabase/migrations/00000000_initial_schema.sql>
)
```

If there are errors about existing objects, the project may already have a schema. Ask the user if they want to continue.

## Step 4: Create Storage Bucket

Guide the user to create the storage bucket manually (MCP doesn't support storage operations):

1. Go to Supabase Dashboard > Storage
2. Click "New bucket"
3. Name: `documents`
4. Public: No (unchecked)
5. Click "Create bucket"

Then add storage policies in SQL Editor:

```sql
-- Allow authenticated uploads
CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

-- Allow users to view files  
CREATE POLICY "Allow view" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

-- Allow users to delete files
CREATE POLICY "Allow delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');
```

## Step 5: Get API Keys

Ask the user for:
- **OpenAI API key** (required)
- **Cohere API key** (required for reranking)
- **Tavily API key** (optional, for web search)
- **Google API key** (optional, for Gemini models)

## Step 6: Create .env Files

Create `apps/web/.env`:

```env
# <Project Name> - Frontend Configuration

# Supabase
SUPABASE_DB_PASSWORD=<db_password>
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# OpenAI
OPENAI_API_KEY=<openai_key>

# Cohere
COHERE_API_KEY=<cohere_key>

# Optional
TAVILY_API_KEY=<tavily_key>
```

Create `apps/backend/ingest/.env`:

```env
# <Project Name> - Backend Configuration

# Supabase
SUPABASE_URL=<supabase_url>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
DATABASE_URL=postgresql://postgres.<project_ref>:<db_password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# OpenAI
OPENAI_API_KEY=<openai_key>

# Docling
USE_DOCLING=true
USE_API_VLM=true
DOCLING_MAX_WORKERS=15

# Processing
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
LOG_LEVEL=INFO

# Graph RAG
ENABLE_GRAPH_EXTRACTION=true
ENTITY_SIMILARITY_THRESHOLD=0.85

# Optional
GOOGLE_API_KEY=<google_key>
```

## Step 7: Install Dependencies

// turbo
```bash
cd apps/web && npm install
```

// turbo
```bash
cd apps/backend/ingest && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

## Step 8: Final Steps

Tell the user:

1. **Start the app:**
   ```bash
   ./start-frontend.sh  # Terminal 1
   ./start-backend.sh   # Terminal 2
   ```

2. **Create admin account:**
   - Sign up at http://localhost:3000
   - Run in Supabase SQL Editor:
     ```sql
     UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
     ```

3. **Verify everything works:**
   - Upload a test document
   - Try a search query
   - Check the knowledge graph

## Step 9: Clean Up Mosaic Core Files (Optional)

Ask the user if they want to remove Mosaic development docs that aren't needed for their app:

// turbo
```bash
./scripts/clean-for-new-project.sh
```

This removes:
- `docs/archive/` - Old planning docs
- `docs/reference/` - RAG research
- `docs/architecture/` - Core architecture
- `LEARNINGS/` - Development notes
- `tests/` - Mosaic core tests
- `apps/backend/ingest/examples/` - Chunking examples

Note: Git history is already reset by setup.sh, so each project starts with a fresh repo.

## Done!

The project is ready. Remind the user:
- README.md has quick reference for common tasks
- BUILDING_ON_MOSAIC.md has detailed API documentation
- Add new pages at `apps/web/app/(app)/your-feature/`
