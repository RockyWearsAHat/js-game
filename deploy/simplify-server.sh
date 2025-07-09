#!/bin/bash
# Script to fix Node.js version and server setup

# Configuration
EC2_HOST="34.221.34.164"  # Use the new instance
SSH_KEY="/Users/alexwaldmann/game-server-key-1752008862.pem"  # Use the new key
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixing Server Setup ==="
echo "Installing Node.js 20 and configuring server..."

# SSH into server and fix setup
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Install Node.js 20 from NodeSource repository
  echo 'Installing Node.js 20...'
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
  
  # Verify Node.js version
  echo 'Node.js version:'
  node --version
  npm --version
  
  # Reinstall dependencies with Node.js 20
  cd $APP_DIR
  echo 'Reinstalling dependencies...'
  rm -rf node_modules package-lock.json
  npm install --omit=dev
  npm install dotenv
  
  # Update service file for correct configuration
  echo '[Unit]
Description=Game Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/game-server
ExecStart=/usr/bin/node dist/server/game-server.js --serve-static
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=0.0.0.0
Environment=SERVE_STATIC=true

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service
  
  # Restart service
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  # Check status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # Check if service is listening
  echo 'Checking ports:'
  sudo ss -tulpn | grep :8080 || echo 'No process listening on port 8080'
  
  # Check logs for errors
  echo 'Recent logs:'
  sudo journalctl -u game-server -n 20 --no-pager
"

echo "=== Setup Complete ==="
echo "Your application should now be accessible at: http://$EC2_HOST:8080"
echo ""
echo "To check server logs:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
