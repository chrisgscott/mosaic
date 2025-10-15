# Deploy to Render.com - Step by Step

## Quick Deploy (5 minutes)

### 1. Go to Render Dashboard
https://dashboard.render.com

### 2. Create New Background Worker

Click **"New +"** → **"Background Worker"**

### 3. Connect Repository

- **Repository**: Select your `mosaic` GitHub repo
- Click **"Connect"**

### 4. Configure Service

**Basic Settings:**
- **Name**: `mosaic-document-processor`
- **Region**: `Oregon (US West)` (or closest to your Supabase region: us-east-1)
- **Branch**: `main`
- **Root Directory**: `apps/backend/ingest`

**Build & Start:**
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python main.py`

**Instance Type:**
- **Plan**: `Starter` ($7/mo) - 512MB RAM
- (Upgrade to `Standard` $25/mo if you need more power)

### 5. Add Environment Variables

Click **"Environment"** tab and add these:

```
SUPABASE_URL=https://cqtxfjcpgaudugkqjpdc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>
DATABASE_URL=<get-from-supabase-dashboard>
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
```

**Where to get the secrets:**

1. **SUPABASE_SERVICE_ROLE_KEY**:
   - Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/api
   - Copy the `service_role` key (starts with `eyJ...`)

2. **DATABASE_URL**:
   - Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/database
   - Click "Connection String" → "URI"
   - Select "Use connection pooling"
   - Copy the full URL
   - Replace `[YOUR-PASSWORD]` with your database password

### 6. Deploy!

Click **"Create Background Worker"**

Render will:
1. Clone your repo
2. Install dependencies (~3-5 minutes)
3. Start the worker
4. Begin processing documents from the queue

### 7. Monitor Deployment

Watch the **"Logs"** tab to see:
```
INFO - Starting document processing worker
INFO - Connected to database
```

When you see that, it's working! 🎉

## Troubleshooting

### "Failed to connect to database"
- Check `DATABASE_URL` is correct
- Make sure you're using the connection pooling URL
- Verify database password

### "ModuleNotFoundError"
- Check `requirements.txt` is in `apps/backend/ingest/`
- Verify build command ran successfully
- Check build logs for errors

### "No module named 'unstructured'"
- Build may have timed out
- Try manual deploy or increase timeout
- Check Render build logs

### Worker not processing jobs
- Verify queue name is `document_processing`
- Check Edge Function is adding jobs to queue
- Look for errors in worker logs

## After Deployment

1. **Upload a document** in your web app
2. **Watch Render logs** - you should see processing activity
3. **Check Supabase** - verify chunks are being created
4. **Monitor costs** - Starter plan is $7/mo

## Updating the Worker

Push to `main` branch and Render will auto-deploy:

```bash
git add .
git commit -m "Update document processor"
git push
```

Render will rebuild and restart automatically.

## Cost Estimate

- **Starter**: $7/mo (512MB RAM, always on)
- **Standard**: $25/mo (2GB RAM, better performance)
- **Pro**: $85/mo (4GB RAM, for heavy workloads)

Start with Starter, upgrade if needed.
