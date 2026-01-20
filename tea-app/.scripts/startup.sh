#!/bin/bash

# Tea Timer App - Startup Script
# Starts both the frontend (Vite) and backend (Express) servers

set -e

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT"
BACKEND_DIR="$PROJECT_ROOT/server"
PID_DIR="$SCRIPT_DIR/.pids"

# Load configuration
source "$SCRIPT_DIR/config.sh"

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

# Kill any orphaned server processes on configured ports
echo -e "${BLUE}Checking for orphaned processes...${NC}"

# Kill any process on backend port
BACKEND_PORT_PID=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PID" ]; then
    echo -e "${RED}Found orphaned process on port $BACKEND_PORT (PID: $BACKEND_PORT_PID). Killing...${NC}"
    kill -9 $BACKEND_PORT_PID 2>/dev/null || true
    sleep 1
fi

# Kill any process on frontend port
FRONTEND_PORT_PID=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PID" ]; then
    echo -e "${RED}Found orphaned process on port $FRONTEND_PORT (PID: $FRONTEND_PORT_PID). Killing...${NC}"
    kill -9 $FRONTEND_PORT_PID 2>/dev/null || true
    sleep 1
fi

# Kill any orphaned ts-node/tsx server processes
pkill -f "ts-node.*server/index.ts" 2>/dev/null || true
pkill -f "tsx.*server/index.ts" 2>/dev/null || true

# Clean up stale PID files
if [ -f "$PID_DIR/backend.pid" ]; then
    OLD_PID=$(cat "$PID_DIR/backend.pid")
    if ! ps -p $OLD_PID > /dev/null 2>&1; then
        echo "Removing stale backend PID file"
        rm -f "$PID_DIR/backend.pid"
    fi
fi

if [ -f "$PID_DIR/frontend.pid" ]; then
    OLD_PID=$(cat "$PID_DIR/frontend.pid")
    if ! ps -p $OLD_PID > /dev/null 2>&1; then
        echo "Removing stale frontend PID file"
        rm -f "$PID_DIR/frontend.pid"
    fi
fi

echo -e "${GREEN}Ports are clear. Starting services...${NC}"
echo ""

# Start Backend Server
echo -e "${GREEN}[1/2] Starting Backend Server (Express on port $BACKEND_PORT)...${NC}"
cd "$BACKEND_DIR"
npm start > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait a moment for backend to initialize
sleep 2

# Start Frontend Server
echo -e "${GREEN}[2/2] Starting Frontend Server (Vite on port $FRONTEND_PORT)...${NC}"
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
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "Logs:"
echo "  Backend:  $SCRIPT_DIR/backend.log"
echo "  Frontend: $SCRIPT_DIR/frontend.log"
echo ""
echo "To stop services, run: .scripts/shutdown.sh"
echo ""
