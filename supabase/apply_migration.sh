#!/bin/bash
# Script to apply Supabase migrations manually
# Usage: ./apply_migration.sh <migration_file>

set -e

# Load environment variables from backend
if [ -f ../apps/backend/ingest/.env ]; then
    export $(cat ../apps/backend/ingest/.env | grep -v '^#' | xargs)
fi

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
    echo "Usage: ./apply_migration.sh <migration_file>"
    echo "Example: ./apply_migration.sh migrations/20250116_phase4_embeddings_setup.sql"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Applying migration: $MIGRATION_FILE"
echo "Database: $DATABASE_URL"
echo ""

# Apply migration using psql
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration applied successfully!"
