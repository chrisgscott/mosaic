# Test Worker Locally

## Quick Start

### 1. Get Your Credentials

You need two values from Supabase:

**Service Role Key:**
- Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/api
- Copy the `service_role` key (long JWT starting with `eyJ...`)

**Database URL:**
- Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/database
- Click "Connection String" → "URI"
- Select "Use connection pooling"
- Copy the full URL (starts with `postgresql://`)
- Replace `[YOUR-PASSWORD]` with your database password

### 2. Update .env File

Edit `/Users/chrisgscott/projects/mosaic/apps/backend/ingest/.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://cqtxfjcpgaudugkqjpdc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # <-- paste your key here
DATABASE_URL=postgresql://...     # <-- paste your URL here

# Processing Configuration
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
```

### 3. Run the Worker

```bash
cd /Users/chrisgscott/projects/mosaic/apps/backend/ingest
source venv/bin/activate
python main.py
```

You should see:
```
INFO - Starting document processing worker
INFO - Connected to database
```

### 4. Test with a Document Upload

1. Keep the worker running in this terminal
2. Open your web app in a browser
3. Upload a document
4. Watch the worker logs!

You should see:
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

### 5. Verify Results

Check your Supabase database:

```sql
-- See your chunks
SELECT 
    d.file_name,
    COUNT(c.id) as chunk_count,
    SUM(c.token_count) as total_tokens
FROM documents d
LEFT JOIN chunks c ON c.document_id = d.id
GROUP BY d.id, d.file_name
ORDER BY d.created_at DESC;
```

## Troubleshooting

### "Failed to connect to database"
- Check DATABASE_URL in .env
- Make sure you're using connection pooling URL
- Verify password is correct

### "No jobs in queue"
- Upload a document first
- Check Edge Function is running (look for cron job logs)
- Verify queue name is `document_processing`

### "Error downloading file"
- Check SUPABASE_SERVICE_ROLE_KEY is correct
- Verify file exists in storage
- Check storage bucket permissions

### Worker stops/crashes
- Check error logs
- Verify all dependencies installed
- Make sure .env file is complete

## What to Watch For

✅ **Good signs:**
- "Connected to database"
- "Received job"
- "Successfully processed document"
- Chunks appearing in database

❌ **Bad signs:**
- Connection errors
- "No module named..."
- Timeout errors
- No jobs being received

## Next Steps

Once local testing works:
1. ✅ Deploy to Render (already started)
2. ✅ Monitor Render logs
3. ✅ Test end-to-end with real uploads
4. ✅ Move to Phase 4: Embeddings & Search!
