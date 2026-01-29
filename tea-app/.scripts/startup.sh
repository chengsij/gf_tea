#!/bin/bash

# Tea Timer App - Startup Script
# Starts the backend (Express) server which also serves the frontend

set -e

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
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

# Also remove frontend PID if it exists
rm -f "$PID_DIR/frontend.pid"

echo -e "${GREEN}Ports are clear. Starting services...${NC}"
echo ""

# Start Backend Server
echo -e "${GREEN}Starting Server (Express on port $BACKEND_PORT)...${NC}"
# Run from PROJECT_ROOT so backend can find the 'dist' folder for serving the frontend
cd "$PROJECT_ROOT"
NODE_ENV=production npx tsx server/index.ts > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"
echo "Backend PID: $BACKEND_PID"
echo ""

# Wait for server to initialize
sleep 3

# Check if process is still running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}Error: Backend server failed to start. Check $SCRIPT_DIR/backend.log${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Services Started Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "App is available at: http://localhost:$BACKEND_PORT"
echo ""
echo "Logs:"
echo "  Server:  $SCRIPT_DIR/backend.log"
echo ""
echo "To stop services, run: .scripts/shutdown.sh"
echo ""
