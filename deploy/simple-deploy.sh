#!/bin/bash
# Simple deployment script that avoids nginx and directly uploads files

# Load configuration from server-config.env if it exists
if [ -f "./deploy/server-config.env" ]; then
  source ./deploy/server-config.env
else
  # Default configuration
  EC2_HOST="34.217.22.199"
  SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
fi

EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Simple Direct Deployment ==="
echo "Host: $EC2_HOST"
echo "SSH Key: $SSH_KEY"

# Build application
echo "Building application..."
npm run build

# Check if the key file exists and has proper permissions
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  exit 1
fi

chmod 400 "$SSH_KEY"

# Test SSH connection
echo "Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes $EC2_USER@"$EC2_HOST" "echo Connected" || {
  echo "ERROR: Cannot connect to server with provided key"
  echo "You may need to run the fresh-instance.sh script first to create a working instance"
  exit 1
}

# Upload files
echo "Uploading files to server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "mkdir -p $APP_DIR"
scp -i "$SSH_KEY" -r ./dist/* $EC2_USER@"$EC2_HOST":$APP_DIR/
scp -i "$SSH_KEY" package.json $EC2_USER@"$EC2_HOST":$APP_DIR/
scp -i "$SSH_KEY" package-lock.json $EC2_USER@"$EC2_HOST":$APP_DIR/

# Configure and start server
echo "Configuring server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  cd $APP_DIR
  
  # Install dependencies
  npm install --production
  npm install dotenv
  
  # Create direct server service
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
  
  # Setup port forwarding (80 -> 8080) using iptables
  echo 'Setting up port forwarding...'
  sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080 || echo 'Port forwarding setup failed - try accessing on port 8080 directly'
  
  # Restart service
  sudo systemctl daemon-reload
  sudo systemctl enable game-server
  sudo systemctl restart game-server
  
  # Show status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # Show which ports are being listened on
  echo 'Listening ports:'
  sudo ss -tulpn | grep -E ':(80|8080)' || echo 'No processes listening on web ports'
"

echo ""
echo "=== Deployment Complete ==="
echo "Your application should be accessible at:"
echo "http://$EC2_HOST"
echo "or"
echo "http://$EC2_HOST:8080"
echo ""
echo "To check server logs:"
echo "ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"sudo journalctl -u game-server -f\""
