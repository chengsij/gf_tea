#!/bin/bash

# Tea Timer App - Shutdown Script
# Gracefully stops both the frontend and backend servers

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_DIR="$SCRIPT_DIR/.pids"

# Load configuration
source "$SCRIPT_DIR/config.sh"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Tea Timer App - Stopping Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if PID directory exists
if [ ! -d "$PID_DIR" ]; then
    echo -e "${YELLOW}No PID directory found. Services may not be running.${NC}"
    exit 0
fi

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file=$2

    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        echo -e "${GREEN}Stopping $service_name (PID: $PID)...${NC}"

        if ps -p $PID > /dev/null; then
            kill $PID 2>/dev/null

            # Wait for graceful shutdown (max 5 seconds)
            for i in {1..5}; do
                if ! ps -p $PID > /dev/null; then
                    echo -e "${GREEN}$service_name stopped successfully.${NC}"
                    rm "$pid_file"
                    return 0
                fi
                sleep 1
            done

            # Force kill if still running
            if ps -p $PID > /dev/null; then
                echo -e "${YELLOW}$service_name did not stop gracefully. Force killing...${NC}"
                kill -9 $PID 2>/dev/null
                rm "$pid_file"
            fi
        else
            echo -e "${YELLOW}$service_name process not found. Cleaning up PID file.${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}$service_name PID file not found.${NC}"
    fi
}

# Stop Frontend Server
stop_service "Frontend Server" "$PID_DIR/frontend.pid"
echo ""

# Stop Backend Server
stop_service "Backend Server" "$PID_DIR/backend.pid"
echo ""

# Kill any remaining processes on configured ports
echo -e "${BLUE}Checking for any remaining processes on configured ports...${NC}"
echo ""

# Kill any remaining process on backend port
BACKEND_PORT_PID=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PID" ]; then
    echo -e "${YELLOW}Found process still running on backend port $BACKEND_PORT (PID: $BACKEND_PORT_PID). Force killing...${NC}"
    kill -9 $BACKEND_PORT_PID 2>/dev/null || true
    echo ""
fi

# Kill any remaining process on frontend port
FRONTEND_PORT_PID=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PID" ]; then
    echo -e "${YELLOW}Found process still running on frontend port $FRONTEND_PORT (PID: $FRONTEND_PORT_PID). Force killing...${NC}"
    kill -9 $FRONTEND_PORT_PID 2>/dev/null || true
    echo ""
fi

# Clean up PID directory if empty
if [ -d "$PID_DIR" ] && [ -z "$(ls -A $PID_DIR)" ]; then
    rmdir "$PID_DIR"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  All Services Stopped${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
