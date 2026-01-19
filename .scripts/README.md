# Tea Timer App - Startup/Shutdown Scripts

This directory contains scripts to easily start and stop the Tea Timer App services.

## Scripts

### `startup.sh`
Starts both the frontend (Vite) and backend (Express) servers in the background.

**Usage:**
```bash
./.scripts/startup.sh
```

**What it does:**
- Starts the backend server (Express) on port 3001
- Starts the frontend server (Vite) on port 5173
- Stores process IDs (PIDs) in `.scripts/.pids/` for graceful shutdown
- Creates log files in `.scripts/` directory:
  - `backend.log` - Backend server output
  - `frontend.log` - Frontend server output

**Output:**
- Frontend will be available at: http://localhost:5173
- Backend API will be available at: http://localhost:3001

### `shutdown.sh`
Gracefully stops both frontend and backend servers.

**Usage:**
```bash
./.scripts/shutdown.sh
```

**What it does:**
- Reads PIDs from `.scripts/.pids/` directory
- Attempts graceful shutdown (SIGTERM)
- Force kills if necessary after 5 seconds
- Cleans up PID files

## Quick Start

### Starting the App
```bash
# From project root
./.scripts/startup.sh

# Or from anywhere
cd /path/to/gf_tea && ./.scripts/startup.sh
```

### Stopping the App
```bash
# From project root
./.scripts/shutdown.sh

# Or from anywhere
cd /path/to/gf_tea && ./.scripts/shutdown.sh
```

## Troubleshooting

### "Services may already be running" error
If you see this error, it means PID files exist. Either:
1. Services are already running - check with `ps aux | grep -E "(vite|ts-node)"`
2. Services crashed and left stale PID files - run `shutdown.sh` to clean up

### Check if services are running
```bash
# Check backend (should show ts-node process)
ps aux | grep "ts-node"

# Check frontend (should show vite process)
ps aux | grep "vite"

# Check ports
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
```

### View logs
```bash
# Backend logs
tail -f .scripts/backend.log

# Frontend logs
tail -f .scripts/frontend.log
```

### Manual cleanup
If scripts fail and you need to manually clean up:
```bash
# Kill processes
pkill -f "ts-node"
pkill -f "vite"

# Remove PID files
rm -rf .scripts/.pids
```

## Notes

- Logs are appended on each startup (not overwritten)
- PID files are stored in `.scripts/.pids/` (this directory is auto-created)
- Scripts must be run from project root or with absolute paths
- Both scripts use color-coded output for better readability
