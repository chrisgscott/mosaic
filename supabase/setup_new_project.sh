#!/bin/bash

# =============================================================================
# Mosaic - New Project Setup Script
# =============================================================================
# This script sets up a fresh Supabase project with the Mosaic schema.
# 
# Usage:
#   ./setup_new_project.sh
#
# Prerequisites:
#   1. Create a new Supabase project at https://supabase.com
#   2. Get your project URL and service role key from Settings > API
#   3. Set up your .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Mosaic - New Project Setup"
echo "=========================================="
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    # Try to load from .env file in parent directories
    if [ -f "../apps/web/.env" ]; then
        source "../apps/web/.env"
    elif [ -f "../apps/web/.env.local" ]; then
        source "../apps/web/.env.local"
    fi
fi

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}Error: SUPABASE_URL not set${NC}"
    echo "Please set SUPABASE_URL environment variable or add it to apps/web/.env"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    echo "Please set SUPABASE_SERVICE_ROLE_KEY environment variable or add it to apps/web/.env"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/\.supabase\.co//')

echo -e "${GREEN}✓${NC} Found Supabase project: $PROJECT_REF"
echo ""

# Check if this is a fresh project or existing
echo "Checking database status..."
TABLES_EXIST=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/to_regclass" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"relation": "public.documents"}' 2>/dev/null || echo "null")

if [ "$TABLES_EXIST" != "null" ] && [ "$TABLES_EXIST" != "" ]; then
    echo -e "${YELLOW}Warning: Database already has tables.${NC}"
    echo "This script is for fresh projects only."
    echo ""
    read -p "Continue anyway? This may cause errors. (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "Applying initial schema..."
echo ""

# Apply the consolidated migration
./apply_migration.sh migrations/00000000_initial_schema.sql

echo ""
echo -e "${GREEN}=========================================="
echo "  Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Create the 'documents' storage bucket:"
echo "   - Go to Supabase Dashboard > Storage"
echo "   - Click 'New bucket'"
echo "   - Name: 'documents', Private: Yes"
echo ""
echo "2. Set up storage policies (run in SQL Editor):"
echo "   CREATE POLICY \"Users can upload\" ON storage.objects"
echo "     FOR INSERT WITH CHECK (bucket_id = 'documents');"
echo "   CREATE POLICY \"Users can view own\" ON storage.objects"
echo "     FOR SELECT USING (bucket_id = 'documents');"
echo "   CREATE POLICY \"Users can delete own\" ON storage.objects"
echo "     FOR DELETE USING (bucket_id = 'documents');"
echo ""
echo "3. Create your admin user:"
echo "   - Sign up through the app"
echo "   - Run in SQL Editor:"
echo "     UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';"
echo ""
echo "4. Configure your .env files:"
echo "   - apps/web/.env (copy from .env.example)"
echo "   - apps/backend/ingest/.env (copy from .env.example)"
echo ""
echo -e "${GREEN}Happy building! 🚀${NC}"
echo ""
