#!/bin/bash

# Mosaic - Stop All Services
# This script stops all running Mosaic services

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Stopping Mosaic Services...        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to kill process by PID file
kill_by_pidfile() {
    local pidfile=$1
    local service_name=$2
    
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}⏹️  Stopping $service_name (PID: $PID)...${NC}"
            kill $PID 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if ps -p $PID > /dev/null 2>&1; then
                kill -9 $PID 2>/dev/null || true
            fi
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name not running (stale PID file)${NC}"
        fi
        rm "$pidfile"
    fi
}

# Stop services started in background (from PID files)
if [ -d "logs" ]; then
    kill_by_pidfile "logs/frontend.pid" "Frontend"
    kill_by_pidfile "logs/backend.pid" "Backend"
fi

# Kill any remaining Node.js dev servers on port 3000
echo -e "${BLUE}🔍 Checking for processes on port 3000...${NC}"
FRONTEND_PIDS=$(lsof -ti:3000 2>/dev/null || true)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo -e "${YELLOW}⏹️  Stopping processes on port 3000...${NC}"
    echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Port 3000 cleared${NC}"
else
    echo -e "${GREEN}✅ No processes on port 3000${NC}"
fi

# Kill Python processes running main.py
echo -e "${BLUE}🔍 Checking for Python backend processes...${NC}"
BACKEND_PIDS=$(pgrep -f "python.*main.py" 2>/dev/null || true)
if [ ! -z "$BACKEND_PIDS" ]; then
    echo -e "${YELLOW}⏹️  Stopping Python backend processes...${NC}"
    echo "$BACKEND_PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still running
    BACKEND_PIDS=$(pgrep -f "python.*main.py" 2>/dev/null || true)
    if [ ! -z "$BACKEND_PIDS" ]; then
        echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Python backend stopped${NC}"
else
    echo -e "${GREEN}✅ No Python backend processes running${NC}"
fi

# Kill any npm processes in apps/web
echo -e "${BLUE}🔍 Checking for npm processes...${NC}"
NPM_PIDS=$(pgrep -f "npm.*run.*dev" 2>/dev/null || true)
if [ ! -z "$NPM_PIDS" ]; then
    echo -e "${YELLOW}⏹️  Stopping npm processes...${NC}"
    echo "$NPM_PIDS" | xargs kill 2>/dev/null || true
    echo -e "${GREEN}✅ npm processes stopped${NC}"
else
    echo -e "${GREEN}✅ No npm processes running${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        All Services Stopped            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Use ./start-all.sh to start services again${NC}"
echo ""
