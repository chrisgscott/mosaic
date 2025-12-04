# Getting Started with Mosaic

This guide will help you get all Mosaic services up and running for local development.

## Prerequisites

### Required Software
- **Node.js** 18+ and npm
- **Python** 3.12+
- **Supabase** account and project
- **Git**

### Required API Keys
- **Supabase** project URL and service role key
- **OpenAI** API key (for embeddings, LLM features, and document processing)
- **Cohere** API key (for reranking - free tier available)

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/chrisgscott/mosaic.git
cd mosaic

# Install frontend dependencies
cd apps/web
npm install
cd ../..

# Install backend dependencies
cd apps/backend/ingest
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../../..
```

### 2. Configure Environment Variables

#### Frontend (`apps/web/.env.local`)

Create `apps/web/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Cohere (optional)
COHERE_API_KEY=your-cohere-api-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Backend (`apps/backend/ingest/.env`)

Create `apps/backend/ingest/.env` (copy from `.env.example`):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# OpenAI (required for document processing and embeddings)
OPENAI_API_KEY=your-openai-api-key

# Docling Configuration
USE_DOCLING=true
USE_API_VLM=true
DOCLING_MAX_WORKERS=15

# Processing Configuration
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
LOG_LEVEL=INFO

# Graph RAG (optional)
ENABLE_GRAPH_EXTRACTION=true
```

### 3. Set Up Supabase Database

#### Option A: Fresh Project (Recommended)

For new Supabase projects, use the consolidated setup script:

```bash
cd supabase

# Set your Supabase credentials
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the setup script
./setup_new_project.sh
```

This applies the complete Mosaic schema in one step.

#### Option B: Using Supabase CLI

Alternatively, use the Supabase CLI:

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### After Setup

1. **Create Storage Bucket**: Go to Supabase Dashboard > Storage > New bucket > Name: `documents`
2. **Set Storage Policies**: See the setup script output for policy SQL

### 4. Create Admin User

After signing up through the app, manually set your user as admin in Supabase:

```sql
-- In Supabase SQL Editor
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

## Running the Services

### Start All Services (Recommended)

Open **three terminal windows** and run each service:

#### Terminal 1: Frontend (Next.js)
```bash
cd apps/web
npm run dev
```
- Frontend will be available at: http://localhost:3000
- Hot reload enabled for development

#### Terminal 2: Backend Document Processor (Python)
```bash
cd apps/backend/ingest
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```
- Polls the queue for document processing jobs
- Logs all processing activity to console

#### Terminal 3: Supabase Local (Optional)
```bash
supabase start
```
- Runs Supabase locally with Docker
- Useful for offline development
- Not required if using hosted Supabase

## Verify Everything Works

### 1. Check Frontend
- Navigate to http://localhost:3000
- Sign in with your account
- You should see the Dashboard

### 2. Check Admin Access
- Click on "Admin" in the sidebar
- You should see: Documents, Search, Chat, Knowledge Graph, Settings
- If you don't see the Admin section, verify your `is_admin` flag in the database

### 3. Test Document Upload
1. Go to Admin → Documents
2. Click "Upload Document"
3. Upload a PDF or text file
4. Watch the backend terminal for processing logs
5. Document should appear in the list when processing completes

### 4. Test Search
1. Go to Admin → Search
2. Enter a query related to your uploaded documents
3. Should return relevant chunks with similarity scores

### 5. Test Chat
1. Go to Admin → Chat
2. Ask a question about your documents
3. Should receive AI-generated response based on your content

## Common Issues

### Frontend won't start
- **Error**: `Module not found`
  - **Fix**: Run `npm install` in `apps/web`
- **Error**: `NEXT_PUBLIC_SUPABASE_URL is not defined`
  - **Fix**: Create `.env.local` with correct variables

### Backend won't start
- **Error**: `ModuleNotFoundError`
  - **Fix**: Activate venv and run `pip install -r requirements.txt`
- **Error**: `Connection refused` to Supabase
  - **Fix**: Check `DATABASE_URL` and `SUPABASE_URL` in `.env`

### Documents not processing
- **Error**: Document stuck in "processing" status
  - **Fix**: Check backend terminal for errors
  - **Fix**: Verify `OPENAI_API_KEY` is valid (used by Docling for VLM processing)
  - **Fix**: Check Supabase Storage permissions

### Admin section not visible
- **Error**: Can't see Admin menu in sidebar
  - **Fix**: Run SQL to set `is_admin = true` for your user
  - **Fix**: Sign out and sign back in to refresh session

### Search returns no results
- **Error**: "No results found"
  - **Fix**: Verify documents have been processed (check `chunks` table)
  - **Fix**: Check `OPENAI_API_KEY` is configured for embeddings
  - **Fix**: Verify pgvector extension is enabled in Supabase

## Development Workflow

### Making Changes

1. **Frontend changes**: Hot reload automatically updates the browser
2. **Backend changes**: Restart the Python process (Ctrl+C, then `python main.py`)
3. **Database changes**: Create a new migration in `supabase/migrations/`

### Testing

```bash
# Frontend tests
cd apps/web
npm test

# Backend tests
cd apps/backend/ingest
pytest
```

### Committing Changes

```bash
# Check status
git status

# Add changes
git add .

# Commit with descriptive message
git commit -m "Description of changes"

# Push to your branch
git push origin your-branch-name
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                     (localhost:3000)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Frontend                           │
│                   (apps/web)                                 │
│  - React components                                          │
│  - Server actions                                            │
│  - API routes                                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Platform                          │
│  - PostgreSQL + pgvector                                     │
│  - Authentication                                            │
│  - Storage (R2)                                              │
│  - Realtime                                                  │
│  - pgmq (message queue)                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Python Document Processor                       │
│              (apps/backend/ingest)                           │
│  - Polls pgmq queue                                          │
│  - Downloads from Storage                                    │
│  - Extracts text (Docling VLM)                               │
│  - Chunks documents                                          │
│  - Generates embeddings (OpenAI)                             │
│  - Stores in database                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### Admin Tools
- **Documents**: Upload, view, and manage documents
- **Search**: Semantic search with hybrid retrieval (BM25 + vector)
- **Chat**: RAG-powered conversational interface
- **Knowledge Graph**: Entity extraction and relationship mapping
- **Settings**: Configure prompts and system behavior

### RAG Pipeline
1. **Document Upload** → Supabase Storage
2. **Queue Job** → pgmq message queue
3. **Process** → Python worker extracts, chunks, embeds
4. **Store** → Chunks + embeddings in PostgreSQL
5. **Search** → Hybrid search (semantic + keyword)
6. **Rerank** → Cohere reranking for relevance
7. **Generate** → LLM generates response with citations

## Next Steps

- Read [SYNTHESIS.md](./SYNTHESIS.md) for the complete vision
- Review [ACTION_PLAN.md](./ACTION_PLAN.md) for the roadmap
- Check [LIVING_ENTITIES_SUMMARY.md](./LIVING_ENTITIES_SUMMARY.md) for Living Entities architecture
- Explore [docs/](./docs/) for detailed documentation

## Getting Help

- **Issues**: Check existing issues or create a new one
- **Documentation**: See `/docs` folder for detailed guides
- **Code**: Review inline comments and type definitions

## Production Deployment

### Frontend (Vercel)
```bash
# Deploy to Vercel
vercel --prod
```

### Backend (Render.com)
See [apps/backend/ingest/RENDER_SETUP.md](./apps/backend/ingest/RENDER_SETUP.md) for deployment instructions.

### Database (Supabase)
Your Supabase project is already in production. Just ensure:
- All migrations are applied
- Environment variables are set
- RLS policies are configured

---

**Happy coding! 🚀**
