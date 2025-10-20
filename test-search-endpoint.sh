#!/bin/bash

# Test the Mosaic search Edge Function
# Usage: ./test-search-endpoint.sh

ENDPOINT="https://cqtxfjcpgaudugkqjpdc.supabase.co/functions/v1/search"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHhmamNwZ2F1ZHVna3FqcGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDYyMzQsImV4cCI6MjA3NTQ4MjIzNH0.OSqWKKAzUCFo_XKJ_5To_0p0kITjVNJLmhQgvCkmx_U"
API_KEY="671138ec6e414f9065ae9c5171addfcd48c0fc8955a19f70a1c7a3a2214a969f"

# Get user ID from command line or use default
USER_ID="${1:-00000000-0000-0000-0000-000000000000}"
QUERY="${2:-test query}"

echo "Testing Mosaic Search Edge Function"
echo "===================================="
echo "Endpoint: $ENDPOINT"
echo "Query: $QUERY"
echo "User ID: $USER_ID"
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-api-key: $API_KEY" \
  -d "{\"query\": \"$QUERY\", \"user_id\": \"$USER_ID\"}" \
  --max-time 30 \
  -w "\n\nHTTP Status: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
echo "Done!"
