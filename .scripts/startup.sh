#!/bin/bash

# Tea Timer App - Startup Script
# Starts both the frontend (Vite) and backend (Express) servers

set -e

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/tea-app"
BACKEND_DIR="$PROJECT_ROOT/tea-app/server"
PID_DIR="$SCRIPT_DIR/.pids"

# Create PID directory if it doesn't exist
mkdir -p "$PID_DIR"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Tea Timer App - Starting Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if services are already running
if [ -f "$PID_DIR/backend.pid" ] || [ -f "$PID_DIR/frontend.pid" ]; then
    echo -e "${RED}Warning: PID files found. Services may already be running.${NC}"
    echo "If services are not running, please run shutdown.sh first to clean up."
    exit 1
fi

# Start Backend Server
echo -e "${GREEN}[1/2] Starting Backend Server (Express on port 3001)...${NC}"
cd "$BACKEND_DIR"
npm start > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait a moment for backend to initialize
sleep 2

# Start Frontend Server
echo -e "${GREEN}[2/2] Starting Frontend Server (Vite on port 5173)...${NC}"
cd "$FRONTEND_DIR"
npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$PID_DIR/frontend.pid"
echo "Frontend PID: $FRONTEND_PID"
echo ""

# Wait for servers to initialize
sleep 3

# Check if processes are still running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}Error: Backend server failed to start. Check $SCRIPT_DIR/backend.log${NC}"
    exit 1
fi

if ! ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${RED}Error: Frontend server failed to start. Check $SCRIPT_DIR/frontend.log${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Services Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo ""
echo "Logs:"
echo "  Backend:  $SCRIPT_DIR/backend.log"
echo "  Frontend: $SCRIPT_DIR/frontend.log"
echo ""
echo "To stop services, run: .scripts/shutdown.sh"
echo ""
