#!/bin/bash

# Simple semantic search test script
# This uses the Next.js API which handles auth internally

echo "🔍 Testing Semantic Search API"
echo "================================"
echo ""

# Check if server is running
echo "1. Checking if Next.js server is running..."
HEALTH_CHECK=$(curl -s http://localhost:3000/api/search 2>&1)

if echo "$HEALTH_CHECK" | grep -q "login"; then
    echo "❌ Server requires authentication"
    echo ""
    echo "To test the search API, you need to:"
    echo "1. Open http://localhost:3000 in your browser"
    echo "2. Login to your account"
    echo "3. Open DevTools (F12) → Application → Cookies"
    echo "4. Find the cookie starting with 'sb-localhost-auth-token'"
    echo "5. Copy the value"
    echo ""
    echo "Then run:"
    echo "  export AUTH_TOKEN='your-token-here'"
    echo "  curl -X POST http://localhost:3000/api/search \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H 'Cookie: sb-localhost-auth-token=\$AUTH_TOKEN' \\"
    echo "    -d '{\"query\": \"training\", \"match_threshold\": 0.7, \"match_count\": 5}'"
    exit 1
fi

if echo "$HEALTH_CHECK" | grep -q "ready"; then
    echo "✅ API is ready"
else
    echo "❌ Server not responding correctly"
    echo "Response: $HEALTH_CHECK"
    exit 1
fi

echo ""
echo "2. To perform a search, you need an auth token from your browser."
echo ""
echo "Quick steps:"
echo "  1. Login at http://localhost:3000"
echo "  2. Get token from browser cookies (DevTools → Application → Cookies)"
echo "  3. Set: export AUTH_TOKEN='your-token'"
echo "  4. Run the curl command above"
echo ""

# Check if AUTH_TOKEN is set
if [ -n "$AUTH_TOKEN" ]; then
    echo "3. AUTH_TOKEN found! Testing search..."
    echo ""
    
    SEARCH_RESULT=$(curl -s -X POST http://localhost:3000/api/search \
      -H "Content-Type: application/json" \
      -H "Cookie: sb-localhost-auth-token=$AUTH_TOKEN" \
      -d '{
        "query": "training",
        "match_threshold": 0.7,
        "match_count": 5
      }')
    
    echo "Search Results:"
    echo "$SEARCH_RESULT" | jq '.' 2>/dev/null || echo "$SEARCH_RESULT"
else
    echo "3. AUTH_TOKEN not set. Follow steps above to test search."
fi
