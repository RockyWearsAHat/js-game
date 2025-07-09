#!/bin/bash
# Fixed complete deployment script with better error handling and dependency management

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixed Complete Deployment ==="

# Build the application
echo "Building application..."
npm run build

echo "Preparing deployment package..."
DEPLOY_TMP="./deploy/tmp"
rm -rf $DEPLOY_TMP
mkdir -p $DEPLOY_TMP

# Copy ALL server files properly
echo "Copying server files..."
mkdir -p $DEPLOY_TMP/dist
cp -r ./dist/* $DEPLOY_TMP/dist/

# Copy index.html to the root for direct access
INDEX_PATH=$(find ./dist -name "index.html" | head -1)
if [ -n "$INDEX_PATH" ]; then
  echo "Found index.html at $INDEX_PATH"
  cp "$INDEX_PATH" $DEPLOY_TMP/
else
  echo "WARNING: Could not find index.html in dist!"
fi

# Copy package files
cp package.json package-lock.json $DEPLOY_TMP/

# Create a .env file if needed
echo "Creating .env file for dotenv..."
echo "PORT=8080
HOST=0.0.0.0
SERVE_STATIC=true" > $DEPLOY_TMP/.env

# Upload to server
echo "Uploading to server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "mkdir -p $APP_DIR"
scp -i "$SSH_KEY" -r $DEPLOY_TMP/* $EC2_USER@"$EC2_HOST":$APP_DIR/

# Deploy and configure on server
echo "Setting up server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  cd $APP_DIR
  
  # Verify files
  echo 'Checking deployed files:'
  ls -la
  
  # Install ALL dependencies including dev dependencies
  echo 'Installing dependencies...'
  npm install
  
  # Add dotenv explicitly
  npm install dotenv
  
  # Create simple direct service file
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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service
  
  # Stop nginx if it's causing issues
  sudo systemctl stop nginx
  sudo systemctl disable nginx
  
  # Start the game server
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  # Check status and logs
  echo 'Game server status:'
  sudo systemctl status game-server --no-pager
  
  echo 'Server logs:'
  sudo journalctl -u game-server -n 30 --no-pager
  
  echo 'Checking ports:'
  sudo ss -tulpn | grep -E ':(80|8080)'
"

echo "Cleaning up..."
rm -rf $DEPLOY_TMP

echo "=== Deployment Complete ==="
echo "Website should be accessible at: http://$EC2_HOST:8080"
echo ""
echo "To see real-time logs, run:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
