#!/bin/bash

# Test script for Proposal API endpoints
# Run from project root: bash test-proposal-endpoints.sh

BASE_URL="http://localhost:3000"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxdHhmamNwZ2F1ZHVna3FqcGRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkwNjIzNCwiZXhwIjoyMDc1NDgyMjM0fQ.NV_ICCxXyrLjWsC3Od0lS21Ad9IOzMG8mLH2yvBRVPk"

echo "========================================="
echo "Testing Proposal API Endpoints"
echo "========================================="
echo ""

# Test 1: Coverage Check
echo "1. Testing /api/proposal/coverage-check"
echo "-----------------------------------------"
curl -X POST "${BASE_URL}/api/proposal/coverage-check" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "proposal_text": "We provide comprehensive logistics support with 24/7 coordination and real-time tracking capabilities.",
    "pws_tasks": [
      {
        "id": "task-1",
        "text": "Provide 24/7 logistics coordination"
      },
      {
        "id": "task-2",
        "text": "Implement real-time tracking system"
      }
    ]
  }' | jq '.'
echo ""
echo ""

# Test 2: Terminology
echo "2. Testing /api/proposal/terminology"
echo "-----------------------------------------"
curl -X POST "${BASE_URL}/api/proposal/terminology" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "terms": [
      { "term": "logistics" },
      { "term": "TRANSCOM" },
      { "term": "coordination" }
    ]
  }' | jq '.'
echo ""
echo ""

# Test 3: Context
echo "3. Testing /api/proposal/context"
echo "-----------------------------------------"
curl -X POST "${BASE_URL}/api/proposal/context" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "query": "What are the requirements for logistics support?",
    "max_chunks": 5,
    "max_entities": 3
  }' | jq '.'
echo ""
echo ""

# Test 4: Graph Suggest (this will fail if entity doesn't exist, which is expected)
echo "4. Testing /api/proposal/graph-suggest"
echo "-----------------------------------------"
curl -X POST "${BASE_URL}/api/proposal/graph-suggest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "entity_name": "logistics",
    "max_depth": 2
  }' | jq '.'
echo ""
echo ""

echo "========================================="
echo "Tests Complete"
echo "========================================="
