#!/bin/bash
# Script to restore the working simple server

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Restoring Working Simple Server ==="

# SSH into server and restore the simple server
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Stop the current service
  sudo systemctl stop game-server
  
  # Restore simple server service
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
Environment=PORT=8080
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service
  
  # Restart the service
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  # Check status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # Check logs
  echo 'Server logs:'
  sudo journalctl -u game-server -n 10 --no-pager
  
  # Remove nginx if it's causing issues
  sudo systemctl stop nginx
  sudo systemctl disable nginx

  # Check listening ports
  echo 'Listening ports:'
  sudo ss -tulpn | grep -E ':(80|8080)'
"

echo "=== Server Restored ==="
echo "The simple server should now be accessible at http://$EC2_HOST:8080"
echo ""
echo "To see server logs in real-time, run:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
