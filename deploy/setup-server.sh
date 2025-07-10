#!/bin/bash
set -e
set -x # Enable debugging

# --- Variables ---
APP_DIR="/var/www/game-server"
REMOTE_DIR_NAME="game-server-deployment"
REMOTE_DIR_PATH="/home/ec2-user/$REMOTE_DIR_NAME"
DOMAIN="opposed.io"

# --- 1. Install Dependencies ---
echo "Installing Node.js v20, NGINX, and Certbot..."
sudo yum update -y
# Add the NodeSource repository for Node.js 20.x
curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
# Install Node.js, NGINX, and Certbot with the NGINX plugin
sudo yum install -y nodejs nginx python3-certbot-nginx

# --- 2. Configure Server Firewall ---
echo "Configuring server firewall..."
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# --- 3. Application Setup ---
echo "Setting up application directory..."
sudo rm -rf $APP_DIR
sudo mkdir -p $APP_DIR
sudo chown -R ec2-user:ec2-user $APP_DIR
# Move extracted files to the final application directory
sudo cp -r $REMOTE_DIR_PATH/dist $APP_DIR/
sudo cp $REMOTE_DIR_PATH/package.json $APP_DIR/
sudo cp $REMOTE_DIR_PATH/package-lock.json $APP_DIR/
sudo chown -R ec2-user:ec2-user $APP_DIR

echo "Installing application dependencies..."
cd $APP_DIR
npm install --production

# --- 4. NGINX Configuration (HTTP Only) ---
echo "Configuring NGINX for HTTP..."
CONFIG_SOURCE_PATH="$REMOTE_DIR_PATH/deploy"
# Use a temporary file for sed operations
cp "$CONFIG_SOURCE_PATH/nginx.conf" "/tmp/nginx.conf.tmp"
# Replace placeholders in NGINX config
sed -i "s|%APP_DIR%|$APP_DIR|g" "/tmp/nginx.conf.tmp"
sed -i "s|%DOMAIN%|$DOMAIN|g" "/tmp/nginx.conf.tmp"
# Move the final config file into place
sudo mv "/tmp/nginx.conf.tmp" "/etc/nginx/conf.d/game-server.conf"
# Remove default NGINX site if it exists
sudo rm -f /etc/nginx/conf.d/default.conf
# Test and restart NGINX
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# --- 4. Obtain SSL Certificate with Certbot ---
echo "Obtaining SSL certificate with Certbot..."
# Use the --nginx plugin to automatically configure SSL
# --non-interactive: Run without prompts
# --agree-tos: Agree to the Terms of Service
# --redirect: Automatically redirect HTTP to HTTPS
# -m: Email for renewal notices
# -d: Domain name
sudo certbot --nginx --non-interactive --agree-tos --redirect -m admin@opposed.io -d $DOMAIN

# --- 5. Systemd Service ---
echo "Setting up systemd service..."
# Use a temporary file for sed operations
cp "$CONFIG_SOURCE_PATH/game-server.service" "/tmp/game-server.service.tmp"
# Replace placeholders in service file
sed -i "s|%APP_DIR%|$APP_DIR|g" "/tmp/game-server.service.tmp"
# Move the final service file into place
sudo mv "/tmp/game-server.service.tmp" "/etc/systemd/system/game-server.service"
# Reload systemd and restart the service
sudo systemctl daemon-reload
sudo systemctl restart game-server.service
sudo systemctl enable game-server.service

echo "Server setup complete."
