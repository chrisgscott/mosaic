# Quick Setup Guide

## Step 1: Apply Database Migration

Run the chunks table migration in Supabase:

```bash
# Using Supabase CLI (if installed)
supabase db push

# Or manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of supabase/migrations/20241015_create_chunks_table.sql
# 3. Run the query
```

## Step 2: Get Your Credentials

You'll need these from your Supabase project:

1. **Supabase URL**: `https://[your-project].supabase.co`
   - Found in: Settings → API → Project URL

2. **Service Role Key**: `eyJ...` (long JWT token)
   - Found in: Settings → API → Service Role Key
   - ⚠️ Keep this secret! It has admin access

3. **Database URL**: `postgresql://postgres:[password]@db.[your-project].supabase.co:5432/postgres`
   - Found in: Settings → Database → Connection String → URI
   - Select "Use connection pooling" and copy the URI
   - Replace `[password]` with your database password

## Step 3: Test Locally (Optional but Recommended)

### Option A: Quick Test (No Queue Required)

Test extraction and chunking without the full pipeline:

```bash
cd apps/backend/ingest

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Test with any document
python test_processor.py ~/Downloads/sample.pdf
```

This will:
- Extract text from your document
- Show you the extracted content
- Chunk it into 512-token pieces
- Display statistics and sample chunks

No database or queue setup needed!

### Option B: Full Integration Test

Test the complete worker with queue:

```bash
# After installing dependencies (from Option A)

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Make sure migration is applied first!

# Run the worker
python main.py
```

You should see:
```
INFO - Starting document processing worker
INFO - Connected to database
```

Upload a document in your app and watch the logs!

## Step 4: Deploy to Render.com

### Option A: Using Render Dashboard

1. Go to https://dashboard.render.com
2. Click "New +" → "Background Worker"
3. Connect your GitHub repo
4. Configure:
   - **Name**: `mosaic-document-processor`
   - **Root Directory**: `apps/backend/ingest`
   - **Environment**: `Python 3`
   - **Python Version**: `3.11`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
   - **Plan**: Starter ($7/mo) or higher

5. Add Environment Variables:
   ```
   SUPABASE_URL=https://[your-project].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   DATABASE_URL=postgresql://...
   POLL_INTERVAL=5
   BATCH_SIZE=1
   MAX_RETRIES=3
   ```

6. Click "Create Background Worker"

### Option B: Using render.yaml (Infrastructure as Code)

1. Push your code to GitHub
2. In Render dashboard, click "New +" → "Blueprint"
3. Connect your repo
4. Render will detect `render.yaml` and set everything up
5. Just add the secret environment variables in the dashboard

## Step 5: Verify It's Working

1. Upload a document in your app
2. Check Render logs - you should see:
   ```
   INFO - Received job 123
   INFO - Processing document abc-123: user_id/filename.pdf
   INFO - Downloading file from storage
   INFO - Extracting text with Unstructured
   INFO - Extracted 5000 characters
   INFO - Chunking text
   INFO - Created 10 chunks
   INFO - Storing chunks in database
   INFO - Successfully processed document abc-123
   ```

3. Check your database - you should see rows in the `chunks` table

## Troubleshooting

### "Failed to connect to database"
- Check your `DATABASE_URL` is correct
- Make sure you're using the connection pooling URL
- Verify your database password

### "Error downloading file from storage"
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify the file exists in Supabase Storage
- Check storage bucket permissions

### "No text extracted from document"
- Check the file type is supported
- Try with a simple .txt file first
- Check Render logs for specific errors

### Worker not processing jobs
- Verify the pgmq queue exists (check Edge Function logs)
- Make sure queue name matches: `document_processing`
- Check worker is running (Render dashboard → Logs)

## Next Steps

Once working:
- [ ] Monitor costs and performance in Render dashboard
- [ ] Add Docling as Tier 2 fallback (for complex PDFs)
- [ ] Implement embeddings generation (Phase 4)
- [ ] Add search functionality
