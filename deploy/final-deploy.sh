#!/bin/bash
# Final deployment script - uses port 4321 to avoid conflicts

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"
UNIQUE_PORT="4321" # Using an uncommon port to avoid conflicts

echo "=== Final Deployment with Server Reboot ==="
echo "Will use port $UNIQUE_PORT to avoid conflicts"

# Build the application
echo "Building application..."
npm run build

# Prepare deployment package
echo "Preparing deployment package..."
mkdir -p ./deploy/dist
cp -r ./dist/* ./deploy/dist/
cp package.json package-lock.json ./deploy/dist/

# First, reboot the server to clear all processes
echo "Rebooting server to clear all processes..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "sudo reboot" || true

# Wait for server to come back online
echo "Waiting for server to reboot (60 seconds)..."
sleep 60

# Try to connect until the server is back
MAX_RETRIES=10
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
  echo "Attempting to connect to server (attempt $((COUNT+1))/$MAX_RETRIES)..."
  if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no $EC2_USER@"$EC2_HOST" "echo Server is up"; then
    echo "Server is back online!"
    break
  fi
  COUNT=$((COUNT+1))
  if [ $COUNT -eq $MAX_RETRIES ]; then
    echo "Failed to connect after $MAX_RETRIES attempts. Please check server status manually."
    exit 1
  fi
  echo "Server not ready yet. Waiting 30 seconds..."
  sleep 30
done

# Upload files to server
echo "Uploading to server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "mkdir -p $APP_DIR"
scp -i "$SSH_KEY" -r ./deploy/dist/* $EC2_USER@"$EC2_HOST":$APP_DIR/

# Configure and start server
echo "Setting up server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  cd $APP_DIR
  
  # Ensure Node.js 20 is installed
  if [[ \$(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
    echo 'Upgrading to Node.js v20...'
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi
  
  echo 'Node.js version:'
  node --version
  
  # Verify there are no processes using our port
  echo 'Verifying port $UNIQUE_PORT is free...'
  if sudo ss -tulpn | grep ':$UNIQUE_PORT'; then
    echo 'Port $UNIQUE_PORT is in use. Killing process...'
    sudo fuser -k $UNIQUE_PORT/tcp || true
  fi
  
  # Install dependencies
  echo 'Installing dependencies...'
  npm install --production
  npm install dotenv
  
  # Update service configuration with our unique port
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
Environment=PORT=$UNIQUE_PORT
Environment=HOST=0.0.0.0
Environment=SERVE_STATIC=true
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service
  
  # Restart service
  sudo systemctl daemon-reload
  sudo systemctl enable game-server
  sudo systemctl restart game-server
  
  # Wait a moment for service to start
  sleep 5
  
  # Check status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # Check if service is listening on our port
  echo 'Checking ports:'
  sudo ss -tulpn | grep -E ':$UNIQUE_PORT' || echo 'No process listening on port $UNIQUE_PORT'
  
  # Check logs for errors
  echo 'Recent logs:'
  sudo journalctl -u game-server -n 20 --no-pager
"

echo "=== Deployment Complete ==="
echo "Your application should now be accessible at: http://$EC2_HOST:$UNIQUE_PORT"
echo ""
echo "To check server logs:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
