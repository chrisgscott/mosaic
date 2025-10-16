#!/bin/bash

# Direct search test - paste your full cookie value
# Usage: ./test-search-direct.sh "your-cookie-value"

if [ -z "$1" ]; then
    echo "Usage: ./test-search-direct.sh 'your-cookie-value'"
    echo ""
    echo "Get cookie value from browser:"
    echo "1. Open http://localhost:3000"
    echo "2. DevTools → Application → Cookies"
    echo "3. Copy the FULL VALUE of 'sb-localhost-auth-token'"
    echo "4. Run: ./test-search-direct.sh 'paste-value-here'"
    exit 1
fi

COOKIE_VALUE="$1"

echo "🔍 Testing Semantic Search"
echo "=========================="
echo ""

curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-localhost-auth-token=$COOKIE_VALUE" \
  -d '{
    "query": "training",
    "match_threshold": 0.7,
    "match_count": 5
  }' | jq '.'
