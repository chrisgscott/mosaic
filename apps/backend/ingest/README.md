# Document Processing Service

Background worker service that processes documents from the Supabase pgmq queue.

## Features

- ✅ Polls pgmq queue for document processing jobs
- ✅ Downloads files from Supabase Storage
- ✅ Extracts text using Unstructured.io (Tier 1)
- ✅ Chunks text into 512-token pieces with overlap
- ✅ Stores chunks in Postgres database
- ✅ Updates document status in real-time

## Architecture

```
Upload → Supabase Storage → pgmq Queue
                                ↓
                        This Worker Service
                        - Poll queue
                        - Download file
                        - Extract text (Unstructured)
                        - Chunk text
                        - Store chunks
                                ↓
                        Update document status
                                ↓
                        Real-time UI update
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (has admin access)
- `DATABASE_URL`: Direct Postgres connection string

### 3. Create Chunks Table

Run the migration in `supabase/migrations/` to create the chunks table.

### 4. Run Locally

```bash
python main.py
```

The worker will start polling the queue and processing documents.

## Deployment to Render.com

### 1. Create New Background Worker

1. Go to Render dashboard
2. Click "New +" → "Background Worker"
3. Connect your GitHub repo
4. Configure:
   - **Name**: `mosaic-document-processor`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r apps/backend/ingest/requirements.txt`
   - **Start Command**: `python apps/backend/ingest/main.py`

### 2. Add Environment Variables

Add all variables from `.env.example` in Render's environment variables section.

### 3. Deploy

Render will automatically deploy on push to main branch.

## Configuration

### Environment Variables

- `POLL_INTERVAL`: Seconds to wait between queue polls (default: 5)
- `BATCH_SIZE`: Number of jobs to process at once (default: 1)
- `MAX_RETRIES`: Max retry attempts for failed jobs (default: 3)

### Chunking Settings

Edit `processors/chunker.py`:
- `chunk_size`: Target chunk size in tokens (default: 512)
- `chunk_overlap`: Overlap between chunks (default: 50)

### Unstructured Strategy

Edit `processors/unstructured_processor.py`:
- `strategy="auto"`: Automatic detection
- `strategy="fast"`: Faster, less accurate
- `strategy="hi_res"`: Slower, better layout detection (recommended for complex PDFs)

## Monitoring

The worker logs all activity:
- Job received
- Processing steps
- Errors and retries
- Completion status

View logs in Render dashboard or run locally to see output.

## Future Enhancements

- [ ] Add Docling as Tier 2 fallback for complex PDFs
- [ ] Add GPT-4V as Tier 3 fallback for images/diagrams
- [ ] Implement retry logic with exponential backoff
- [ ] Add metrics and monitoring (Prometheus/Grafana)
- [ ] Support batch processing for efficiency
- [ ] Add document quality scoring
