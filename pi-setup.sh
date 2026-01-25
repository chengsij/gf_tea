#!/bin/bash
# Tea Timer App - Raspberry Pi Setup Script

set -e  # Exit on error

echo "========================================="
echo "  Tea Timer App - Raspberry Pi Setup"
echo "========================================="
echo ""

# 1. Install dependencies
echo "[1/5] Installing dependencies..."
cd tea-app
npm install
cd server && npm install && cd ..
echo "✓ Dependencies installed"
echo ""

# 2. Build React frontend
echo "[2/5] Building React frontend..."
npm run build
echo "✓ Frontend built to dist/"
echo ""

# 3. Install systemd service
echo "[3/5] Installing systemd service..."
sudo cp ../tea-app.service /etc/systemd/system/
sudo systemctl daemon-reload
echo "✓ Service installed"
echo ""

# 4. Enable and start service
echo "[4/5] Enabling service to start on boot..."
sudo systemctl enable tea-app
echo "✓ Service enabled"
echo ""

echo "[5/5] Starting service..."
sudo systemctl start tea-app
echo "✓ Service started"
echo ""

# 5. Show status
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Service status:"
sudo systemctl status tea-app --no-pager -l
echo ""
echo "Your tea app is now running on:"
echo "  http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status tea-app     # Check status"
echo "  sudo systemctl restart tea-app    # Restart after updates"
echo "  sudo journalctl -u tea-app -f     # View live logs"
echo "  sudo systemctl stop tea-app       # Stop service"
echo ""
