# Render.com Deployment Guide

Complete guide to deploying the Mosaic document processor worker to Render.com with automatic deployments.

---

## 📋 Prerequisites

- [ ] GitHub repository with this code pushed
- [ ] Render.com account (free tier works for testing)
- [ ] Supabase project with connection pooler URL
- [ ] Environment variables ready (see below)

---

## 🚀 Deployment Steps

### **Step 1: Push to GitHub**

Make sure your code is pushed to GitHub:

```bash
cd /Users/chrisgscott/projects/mosaic
git add .
git commit -m "Add document processing worker"
git push origin main
```

### **Step 2: Create New Service in Render**

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Background Worker"**
3. Connect your GitHub repository
4. Select the `mosaic` repository

### **Step 3: Configure the Service**

**Basic Settings:**
- **Name**: `mosaic-document-processor`
- **Region**: Oregon (or closest to your Supabase region)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `apps/backend/ingest`
- **Runtime**: Python 3

**Build & Start Commands:**
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python main.py`

**Plan:**
- Start with **Starter ($7/mo)** for testing
- Upgrade to **Standard ($25/mo)** for production

### **Step 4: Configure Auto-Deploy**

Render will automatically detect the `render.yaml` file and use these settings:
- ✅ **Auto-Deploy**: Enabled
- ✅ **Deploy on Push**: Any push to `main` branch
- ✅ **Root Directory**: Only deploys when `apps/backend/ingest/` changes

**How it works:**
- Push changes to `apps/backend/ingest/` → Auto-deploys ✅
- Push changes to `apps/web/` → Does NOT deploy ❌
- Push changes to other directories → Does NOT deploy ❌

### **Step 5: Add Environment Variables**

In the Render dashboard, go to **Environment** tab and add:

#### **Required Variables:**

```bash
# Supabase Connection (CRITICAL: Use Transaction Pooler)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Worker Configuration
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
PYTHON_VERSION=3.11
```

#### **Important Notes:**

⚠️ **DATABASE_URL Must Use Transaction Pooler (Port 6543)**
- ✅ Correct: `pooler.supabase.com:6543`
- ❌ Wrong: `db.supabase.com:5432` (direct connection)

The worker needs pooled connections because:
- Long-running process
- Multiple concurrent connections
- Better resource management

#### **Where to Find These Values:**

**Supabase Dashboard** → **Project Settings** → **API**:
- `SUPABASE_URL`: Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (secret!)

**Supabase Dashboard** → **Project Settings** → **Database**:
- `DATABASE_URL`: Connection pooling → Transaction → Connection string
- Make sure it's port **6543** (not 5432)

### **Step 6: Deploy**

1. Click **"Create Background Worker"**
2. Render will:
   - Clone your repository
   - Install dependencies from `requirements.txt`
   - Start the worker with `python main.py`
3. Watch the logs for successful startup

---

## 📊 Monitoring

### **View Logs**

In Render dashboard → Your service → **Logs** tab

You should see:
```
INFO - Starting document processing worker
INFO - Connected to database
INFO - Polling queue every 5 seconds...
```

### **Health Checks**

The worker logs activity every poll cycle:
- `INFO - Polling queue...` (every 5 seconds)
- `INFO - Received job X` (when processing)
- `INFO - Successfully processed document` (on completion)

### **Common Issues**

**"Connection refused" or "Connection timeout"**
- ✅ Check `DATABASE_URL` uses port 6543 (pooler)
- ✅ Verify Supabase project is active
- ✅ Check service role key is correct

**"No module named 'unstructured'"**
- ✅ Verify `requirements.txt` is in root directory
- ✅ Check build logs for installation errors
- ✅ May need to increase build timeout

**Worker starts but doesn't process**
- ✅ Check queue has messages: `SELECT * FROM pgmq.read('document_processing', 10, 1);`
- ✅ Verify documents table has "uploaded" status documents
- ✅ Check worker logs for errors

---

## 🔄 Auto-Deploy Workflow

### **How It Works**

1. You make changes to `apps/backend/ingest/main.py`
2. Commit and push to GitHub:
   ```bash
   git add apps/backend/ingest/
   git commit -m "Update worker logic"
   git push origin main
   ```
3. Render detects the push
4. Checks if `apps/backend/ingest/` changed → YES
5. Automatically triggers new deployment
6. Worker restarts with new code

### **Deploy Triggers**

**Will Deploy:**
- ✅ Changes to `apps/backend/ingest/*.py`
- ✅ Changes to `apps/backend/ingest/requirements.txt`
- ✅ Changes to `apps/backend/ingest/processors/*.py`
- ✅ Changes to `apps/backend/ingest/render.yaml`

**Will NOT Deploy:**
- ❌ Changes to `apps/web/`
- ❌ Changes to `apps/backend/retrieve/`
- ❌ Changes to root-level files (unless in ingest/)

### **Manual Deploy**

If you need to force a deploy:
1. Go to Render dashboard
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🔧 Updating Configuration

### **Change Environment Variables**

1. Render dashboard → Your service → **Environment** tab
2. Update the variable
3. Click **"Save Changes"**
4. Service will automatically restart

### **Change Worker Settings**

Edit `render.yaml` and push:
```yaml
services:
  - type: worker
    plan: standard  # Upgrade to standard plan
    envVars:
      - key: POLL_INTERVAL
        value: 3  # Poll every 3 seconds instead of 5
```

---

## 💰 Cost Estimates

**Starter Plan ($7/mo):**
- 0.5 GB RAM
- Shared CPU
- Good for: Testing, low volume

**Standard Plan ($25/mo):**
- 2 GB RAM
- 1 CPU
- Good for: Production, moderate volume

**Pro Plan ($85/mo):**
- 4 GB RAM
- 2 CPU
- Good for: High volume, fast processing

---

## 🎯 Next Steps

After deployment:

1. ✅ Upload a test document via web app
2. ✅ Watch Render logs for processing
3. ✅ Verify chunks appear in database
4. ✅ Check document status changes to "ready"

If everything works:
- 🎉 Your worker is production-ready!
- 📈 Monitor usage and upgrade plan if needed
- 🔄 Auto-deploys will keep it updated

---

## 📚 Resources

- [Render Background Workers Docs](https://render.com/docs/background-workers)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Render Auto-Deploy](https://render.com/docs/deploys)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

---

*Last updated: 2025-10-15*
