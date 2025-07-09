#!/bin/bash
# Script to fix port conflict issue

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixing Port Conflict Issue ==="

# SSH into server and fix the port conflict
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Stop all running services
  echo 'Stopping all services...'
  sudo systemctl stop game-server
  sudo systemctl stop nginx || true
  
  # Find and kill any process using port 8080
  echo 'Finding processes using port 8080...'
  PIDS=\$(sudo lsof -t -i:8080)
  if [ ! -z \"\$PIDS\" ]; then
    echo 'Killing processes using port 8080: \$PIDS'
    sudo kill -9 \$PIDS
  else
    echo 'No processes found using port 8080'
  fi
  
  # Wait a moment for port to be released
  sleep 2
  
  # Verify port is free
  if sudo ss -tulpn | grep ':8080 '; then
    echo 'WARNING: Port 8080 is still in use!'
  else
    echo 'Port 8080 is now free'
  fi
  
  # Update service file to use a different port
  echo '[Unit]
Description=Game Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/game-server
ExecStart=/usr/bin/node simple-server.js
Restart=always
RestartSec=10
Environment=PORT=8081
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service

  # Restart the service
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  # Check service status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # List listening ports
  echo 'Listening ports:'
  sudo ss -tulpn | grep -E ':(8080|8081)'
"

echo "=== Fix Complete ==="
echo "The server should now be accessible at http://$EC2_HOST:8081"
echo ""
echo "To see server logs in real-time, run:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
