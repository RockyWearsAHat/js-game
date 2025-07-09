#!/bin/bash
# Complete deployment script that ensures static files are properly included

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Complete Deployment with Static Files ==="

# Build the application ensuring static files are included
echo "Building application..."
npm run build

echo "Preparing deployment package..."
# Create a temporary directory for the deployment
DEPLOY_TMP="./deploy/tmp"
mkdir -p $DEPLOY_TMP

# Copy the server files (assuming they're in dist/server)
mkdir -p $DEPLOY_TMP/dist/server
cp -r ./dist/server $DEPLOY_TMP/dist/

# Find where the index.html is actually located
INDEX_PATH=$(find . -name "index.html" | grep -v "node_modules" | head -1)
if [ -n "$INDEX_PATH" ]; then
  echo "Found index.html at $INDEX_PATH"
  # Get the directory of index.html
  INDEX_DIR=$(dirname "$INDEX_PATH")
  
  # Copy index.html to the deployment root
  cp "$INDEX_PATH" $DEPLOY_TMP/
  
  # Look for assets directory
  if [ -d "$INDEX_DIR/assets" ]; then
    echo "Found assets directory, copying..."
    cp -r "$INDEX_DIR/assets" $DEPLOY_TMP/
  fi
else
  echo "WARNING: Could not find index.html!"
fi

# Copy package files
cp package.json package-lock.json $DEPLOY_TMP/

# Check SSH key permissions and exists
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  echo "Available keys in ./deploy:"
  ls -la ./deploy/*.pem
  echo "Please update the SSH_KEY variable in this script."
  exit 1
fi

chmod 400 "$SSH_KEY"
echo "Using SSH key: $SSH_KEY"

# Test SSH connection before proceeding
echo "Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no $EC2_USER@"$EC2_HOST" "echo Connection successful" || {
  echo "ERROR: Could not connect to $EC2_HOST with key $SSH_KEY"
  echo "Available keys:"
  ls -la $HOME/*.pem
  echo "Please verify your key and try again."
  exit 1
}

# Upload all files to server
echo "Uploading to server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "mkdir -p $APP_DIR"
scp -i "$SSH_KEY" -r $DEPLOY_TMP/* $EC2_USER@"$EC2_HOST":$APP_DIR/
scp -i "$SSH_KEY" ./deploy/game-server.service $EC2_USER@"$EC2_HOST":/tmp/

# Install and configure on server
echo "Setting up server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  cd $APP_DIR
  
  # Install Node.js 20
  echo 'Upgrading to Node.js v20...'
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
  
  # Verify Node.js version
  echo 'Node.js version:'
  node --version
  npm --version
  
  # Gracefully stop existing services
  echo 'Gracefully stopping services...'
  sudo systemctl stop game-server || true
  
  # Check for any lingering processes on port 8080
  PORT_PID=\$(sudo lsof -t -i:8080 2>/dev/null)
  if [ ! -z \"\$PORT_PID\" ]; then
    echo \"Found process using port 8080: \$PORT_PID\"
    echo \"Sending graceful termination signal...\"
    sudo kill \$PORT_PID
    # Wait for process to terminate
    sleep 2
    # Check if it's still running and force kill if necessary
    if ps -p \$PORT_PID > /dev/null; then
      echo \"Process still running, force killing...\"
      sudo kill -9 \$PORT_PID
    fi
  fi
  
  # Verify files were uploaded correctly
  echo 'Checking deployed files:'
  ls -la
  
  # Install dependencies with Node.js 20
  echo 'Installing dependencies...'
  rm -rf node_modules package-lock.json
  npm install --production
  npm install dotenv  # Ensure dotenv is installed
  
  # Configure service to use port 8080 since we know it works
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
  
  # Remove nginx if it exists
  if command -v nginx &> /dev/null; then
    echo 'Removing nginx...'
    sudo systemctl stop nginx || true
    sudo systemctl disable nginx || true
  fi
  
  # Start service with appropriate permissions for port 80
  echo 'Starting game server service...'
  sudo systemctl daemon-reload
  sudo systemctl enable game-server
  sudo systemctl restart game-server
  
  # Check status
  echo 'Game server status:'
  sudo systemctl status game-server --no-pager
  
  # Check if port 80 is being used
  echo 'Checking ports:'
  sudo ss -tulpn | grep -E ':(80|8080)' || echo 'No process listening on ports 80 or 8080'
  
  # If port 80 fails, try port 8080 instead
  if ! sudo ss -tulpn | grep -E ':80' &>/dev/null; then
    echo 'Port 80 not accessible, updating to use port 8080 instead...'
    sudo sed -i 's/PORT=80/PORT=8080/g' /etc/systemd/system/game-server.service
    sudo systemctl daemon-reload
    sudo systemctl restart game-server
    echo 'Updated service to use port 8080'
  fi
"

# Clean up
echo "Cleaning up temporary files..."
rm -rf $DEPLOY_TMP

echo "=== Deployment Complete ==="
echo "Website and WebSocket server should be accessible at: http://$EC2_HOST"
echo "If port 80 was not available, try: http://$EC2_HOST:8080"
echo ""
echo "To check server logs:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
# Clean up
echo "Cleaning up temporary files..."
rm -rf $DEPLOY_TMP

echo "=== Deployment Complete ==="
echo "Website should be accessible at: http://$EC2_HOST"
echo "WebSocket should be accessible at: ws://$EC2_HOST/ws"
echo ""
echo "If you still can't access the site, run this check:"
echo "./deploy/check-connectivity.sh"
