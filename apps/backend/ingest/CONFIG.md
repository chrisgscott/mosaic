# Configuration for Mosaic Document Processor

## ✅ Database Migration Applied!

The `chunks` table has been successfully created in your Supabase database with:
- ✅ All columns (id, document_id, user_id, content, chunk_index, token_count, metadata, created_at)
- ✅ RLS policies for user isolation
- ✅ Service role policy for background worker
- ✅ Indexes for efficient querying
- ✅ Foreign key to documents table

## 🔑 Your Supabase Configuration

### Project Details
- **Project Name**: Mosaic
- **Project ID**: cqtxfjcpgaudugkqjpdc
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Supabase URL**: https://cqtxfjcpgaudugkqjpdc.supabase.co
- **Database Host**: db.cqtxfjcpgaudugkqjpdc.supabase.co

### Environment Variables Needed

Create a `.env` file in this directory with:

```bash
# Supabase Configuration
SUPABASE_URL=https://cqtxfjcpgaudugkqjpdc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>

# Database Connection (for pgmq)
DATABASE_URL=<get-from-supabase-dashboard>

# Processing Configuration
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
```

### Where to Get Missing Values

1. **Service Role Key**:
   - Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/api
   - Copy the "service_role" key (starts with `eyJ...`)
   - ⚠️ Keep this secret! It has admin access

2. **Database URL**:
   - Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/settings/database
   - Click "Connection String" → "URI"
   - Select "Use connection pooling"
   - Copy the full URL (starts with `postgresql://...`)
   - Replace `[YOUR-PASSWORD]` with your database password

## 🧪 Test Locally

```bash
# Install dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Quick test (no .env needed)
python test_processor.py sample.txt

# Full worker test (needs .env)
python main.py
```

## 🚀 Deploy to Render.com

Once you have the environment variables, you're ready to deploy!

See `SETUP.md` for Render deployment instructions.

## 📊 Verify Setup

Check that everything is working:

```bash
# Check chunks table exists
# Go to: https://supabase.com/dashboard/project/cqtxfjcpgaudugkqjpdc/editor

# You should see:
# - documents table (10 rows)
# - chunks table (0 rows - will populate when processing starts)
```

## Next Steps

1. ✅ Migration applied
2. ⏭️ Get Service Role Key from dashboard
3. ⏭️ Get Database URL from dashboard
4. ⏭️ Create `.env` file with values above
5. ⏭️ Test locally with `python main.py`
6. ⏭️ Deploy to Render.com
