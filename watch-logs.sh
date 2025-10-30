#!/bin/bash

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Mosaic Log Monitoring Commands     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Terminal 1 - Backend Processing Logs:${NC}"
echo -e "  ${YELLOW}cd apps/backend/ingest && tail -f ../../../logs/backend.log${NC}"
echo ""
echo -e "${GREEN}Terminal 2 - Frontend Logs:${NC}"
echo -e "  ${YELLOW}cd apps/web && tail -f ../../logs/frontend.log${NC}"
echo ""
echo -e "${GREEN}Terminal 3 - Database Activity (pgmq queue):${NC}"
echo -e "  ${YELLOW}watch -n 2 'psql \$DATABASE_URL -c \"SELECT * FROM pgmq.q_document_processing ORDER BY enqueued_at DESC LIMIT 5;\"'${NC}"
echo ""
echo -e "${GREEN}Terminal 4 - Recent Documents:${NC}"
echo -e "  ${YELLOW}watch -n 2 'psql \$DATABASE_URL -c \"SELECT id, file_name, status, created_at FROM documents ORDER BY created_at DESC LIMIT 5;\"'${NC}"
echo ""
echo -e "${GREEN}Terminal 5 - Recent Chunks:${NC}"
echo -e "  ${YELLOW}watch -n 2 'psql \$DATABASE_URL -c \"SELECT document_id, COUNT(*) as chunk_count, MAX(created_at) as latest FROM chunks GROUP BY document_id ORDER BY latest DESC LIMIT 5;\"'${NC}"
echo ""
