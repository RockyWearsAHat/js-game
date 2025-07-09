#!/bin/bash

# Configuration - UPDATE THESE VALUES
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"
SERVER_PORT="8080" # The port your Node.js server will listen on
DOMAIN="opposed.io" # Your domain name

# Ensure script exits on any error
set -e

# Validation
if [ -z "$EC2_HOST" ]; then
  echo "ERROR: Please update the EC2_HOST variable at the top of this script"
  exit 1
fi

# Check if key exists and fix permissions
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  echo "Please update the SSH_KEY variable at the top of this script"
  exit 1
else
  # Ensure key has proper permissions (SSH requires this)
  chmod 400 "$SSH_KEY"
  echo "SSH key permissions set to 400"
fi

# Debug: Test SSH connection first before proceeding
echo "Testing SSH connection..."
ssh -v -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 $EC2_USER@"$EC2_HOST" "echo Connection successful" || {
  echo "SSH connection failed. Please check:"
  echo "1. The EC2 instance is running"
  echo "2. The security group allows SSH from your IP"
  echo "3. The key pair used to launch the instance matches your local key"
  exit 1
}

echo "Instance is reachable! Continuing with deployment..."

# Build the application
echo "Building application..."
npm run build

# Prepare the server for a clean deployment
echo "Preparing server for deployment..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Stop the service and remove the old directory to ensure a clean slate
  sudo systemctl stop game-server.service || echo 'Service was not running.'
  rm -rf $APP_DIR
  mkdir -p $APP_DIR/deploy
"

# Upload to server
echo "Uploading to server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no $EC2_USER@"$EC2_HOST" "mkdir -p $APP_DIR/deploy"
scp -i "$SSH_KEY" -r ./dist/* $EC2_USER@"$EC2_HOST":"$APP_DIR"/
scp -i "$SSH_KEY" ./package.json ./package-lock.json $EC2_USER@"$EC2_HOST":"$APP_DIR"/
scp -i "$SSH_KEY" ./deploy/game-server.service $EC2_USER@"$EC2_HOST":/tmp/
scp -i "$SSH_KEY" ./deploy/clean-port.sh $EC2_USER@"$EC2_HOST":"$APP_DIR/deploy/"
scp -i "$SSH_KEY" ./deploy/nginx.conf $EC2_USER@"$EC2_HOST":/tmp/

# Install dependencies and configure service
echo "Setting up server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Ensure Node.js 20 is installed
  if ! command -v node &> /dev/null || [ \$(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]; then
    echo 'Installing/Upgrading to Node.js 20...'
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi
  
  # Install NGINX
  sudo dnf install -y nginx
  
  # Install Certbot for Let's Encrypt
  if ! command -v certbot &> /dev/null; then
    echo 'Installing Certbot...'
    sudo dnf install -y certbot python3-certbot-nginx
  fi
  
  cd $APP_DIR && 
  npm install --production && 
  
  # Fix file permissions
  echo 'Setting proper file permissions...'
  sudo chown -R $EC2_USER:$EC2_USER $APP_DIR
  chmod +x $APP_DIR/deploy/clean-port.sh
  
  # Clean the port before starting the service
  echo 'Attempting to clean port $SERVER_PORT...'
  $APP_DIR/deploy/clean-port.sh
  
  # Setup systemd service and NGINX
  echo 'Setting up systemd service and NGINX...'
  sudo mv /tmp/game-server.service /etc/systemd/system/
  sudo mv /tmp/nginx.conf /etc/nginx/nginx.conf
  sudo systemctl daemon-reload
  sudo systemctl enable game-server.service
  sudo systemctl restart game-server.service
  sudo systemctl enable nginx
  
  # Obtain SSL certificate if it doesn't exist
  if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
    echo "Obtaining SSL certificate from Let's Encrypt..."
    # Temporarily stop nginx to allow certbot to bind to port 80
    sudo systemctl stop nginx
    # Request certificate
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m alexwaldmann2004@gmail.com # IMPORTANT: Change this email
  fi
  
  # Restart NGINX to apply all changes (including SSL)
  sudo systemctl restart nginx
  
  echo "Deployment script finished."
"

# Final check on the service status
echo "Checking service status on the server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  sudo systemctl status game-server.service --no-pager
  echo '--- NGINX Status ---'
  sudo systemctl status nginx --no-pager
  echo '--- Recent Logs ---'
  journalctl -u game-server.service -n 20 --no-pager
"

echo "Deployment complete! Server should be running at https://$DOMAIN"
