#!/bin/bash
# Test script for Graph RAG extraction
# Usage: ./test-graph-extract.sh <document_id>

set -e

DOCUMENT_ID=$1

if [ -z "$DOCUMENT_ID" ]; then
    echo "Usage: ./test-graph-extract.sh <document_id>"
    echo ""
    echo "To find a document ID, run:"
    echo "  psql \$DATABASE_URL -c \"SELECT id, file_name FROM documents WHERE status='ready' LIMIT 5;\""
    exit 1
fi

echo "🔍 Testing Graph RAG extraction for document: $DOCUMENT_ID"
echo ""

# Get auth token (assumes you're logged in to localhost:3000)
# In production, you'd get this from your auth system
echo "📝 Make sure you're logged in at http://localhost:3000"
echo ""
echo "Run this curl command with your session token:"
echo ""
echo "curl -X POST http://localhost:3000/api/graph/extract \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: YOUR_SESSION_COOKIE' \\"
echo "  -d '{\"documentId\": \"$DOCUMENT_ID\"}'"
echo ""
echo "Or test directly in browser console:"
echo ""
echo "fetch('/api/graph/extract', {"
echo "  method: 'POST',"
echo "  headers: { 'Content-Type': 'application/json' },"
echo "  body: JSON.stringify({ documentId: '$DOCUMENT_ID' })"
echo "}).then(r => r.json()).then(console.log)"
