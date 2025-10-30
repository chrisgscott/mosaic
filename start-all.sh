#!/bin/bash

# Mosaic - Start All Services
# This script starts the frontend and backend services in separate terminal tabs/windows

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Starting Mosaic Services...        ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if .env files exist
if [ ! -f "apps/web/.env.local" ] && [ ! -f "apps/web/.env" ]; then
    echo -e "${RED}❌ Missing apps/web/.env or apps/web/.env.local${NC}"
    echo -e "${YELLOW}   Copy apps/web/.env.example to apps/web/.env and configure${NC}"
    exit 1
fi

if [ ! -f "apps/backend/ingest/.env" ]; then
    echo -e "${RED}❌ Missing apps/backend/ingest/.env${NC}"
    echo -e "${YELLOW}   Copy apps/backend/ingest/.env.example to apps/backend/ingest/.env and configure${NC}"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Detect OS for terminal handling
OS="$(uname -s)"

case "${OS}" in
    Darwin*)    # macOS
        echo -e "${GREEN}🍎 Detected macOS${NC}"
        echo ""
        
        # Start frontend in new terminal tab
        echo -e "${BLUE}📱 Starting Frontend (Next.js)...${NC}"
        osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/apps/web\" && npm run dev"' > /dev/null 2>&1
        
        # Wait a moment
        sleep 2
        
        # Start backend in new terminal tab
        echo -e "${BLUE}⚙️  Starting Backend (Python)...${NC}"
        osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'/apps/backend/ingest\" && source venv/bin/activate && python main.py; exec bash"' > /dev/null 2>&1
        
        echo ""
        echo -e "${GREEN}✅ Services starting in new terminal tabs!${NC}"
        ;;
        
    Linux*)     # Linux
        echo -e "${GREEN}🐧 Detected Linux${NC}"
        echo ""
        
        # Check for available terminal emulator
        if command -v gnome-terminal &> /dev/null; then
            TERM_CMD="gnome-terminal"
        elif command -v xterm &> /dev/null; then
            TERM_CMD="xterm"
        elif command -v konsole &> /dev/null; then
            TERM_CMD="konsole"
        else
            echo -e "${RED}❌ No supported terminal emulator found${NC}"
            echo -e "${YELLOW}   Falling back to background processes with logs${NC}"
            TERM_CMD="background"
        fi
        
        if [ "$TERM_CMD" = "background" ]; then
            # Run in background with logs
            echo -e "${BLUE}📱 Starting Frontend (Next.js)...${NC}"
            cd apps/web && npm run dev > ../../logs/frontend.log 2>&1 &
            FRONTEND_PID=$!
            echo $FRONTEND_PID > ../../logs/frontend.pid
            cd ../..
            
            echo -e "${BLUE}⚙️  Starting Backend (Python)...${NC}"
            cd apps/backend/ingest && source venv/bin/activate && python main.py > ../../../logs/backend.log 2>&1 &
            BACKEND_PID=$!
            echo $BACKEND_PID > ../../../logs/backend.pid
            cd ../../..
            
            echo ""
            echo -e "${GREEN}✅ Services started in background!${NC}"
            echo -e "${YELLOW}   Frontend PID: $FRONTEND_PID (log: logs/frontend.log)${NC}"
            echo -e "${YELLOW}   Backend PID: $BACKEND_PID (log: logs/backend.log)${NC}"
        else
            # Start in new terminal windows
            echo -e "${BLUE}📱 Starting Frontend (Next.js)...${NC}"
            $TERM_CMD -- bash -c "cd $(pwd)/apps/web && npm run dev; exec bash" &
            
            sleep 2
            
            echo -e "${BLUE}⚙️  Starting Backend (Python)...${NC}"
            $TERM_CMD -- bash -c "cd $(pwd)/apps/backend/ingest && source venv/bin/activate && python main.py; exec bash" &
            
            echo ""
            echo -e "${GREEN}✅ Services starting in new terminal windows!${NC}"
        fi
        ;;
        
    MINGW*|MSYS*|CYGWIN*)    # Windows
        echo -e "${GREEN}🪟 Detected Windows${NC}"
        echo ""
        
        # Start frontend in new window
        echo -e "${BLUE}📱 Starting Frontend (Next.js)...${NC}"
        start cmd /k "cd apps/web && npm run dev"
        
        sleep 2
        
        # Start backend in new window
        echo -e "${BLUE}⚙️  Starting Backend (Python)...${NC}"
        start cmd /k "cd apps/backend/ingest && venv\Scripts\activate && python main.py"
        
        echo ""
        echo -e "${GREEN}✅ Services starting in new windows!${NC}"
        ;;
        
    *)
        echo -e "${RED}❌ Unsupported OS: ${OS}${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Services Status               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📱 Frontend:${NC}  http://localhost:3000"
echo -e "${GREEN}⚙️  Backend:${NC}   Processing documents from queue"
echo ""
echo -e "${YELLOW}💡 Tip: Use ./stop-all.sh to stop all services${NC}"
echo -e "${YELLOW}💡 Tip: Check logs/ directory for background process logs${NC}"
echo ""
