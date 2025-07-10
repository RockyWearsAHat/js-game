#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
EC2_HOST="opposed.io"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
REMOTE_DIR="/home/$EC2_USER/game-server-deployment"
PACKAGE_NAME="deployment-package.tar.gz"

echo "Creating deployment package..."
# Package the distribution, node modules, and other necessary files
tar -czf $PACKAGE_NAME dist package.json package-lock.json deploy/nginx.conf deploy/game-server.service deploy/setup-server.sh

# --- 3. Upload and Execute ---
echo "Uploading package and executing setup on server..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  set -e
  # Create a clean directory for the deployment
  rm -rf $REMOTE_DIR
  mkdir -p $REMOTE_DIR
"

# Upload the single tarball
scp -i "$SSH_KEY" $PACKAGE_NAME "$EC2_USER@$EC2_HOST:$REMOTE_DIR/"

# Execute the remote setup script
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  set -e
  # Unpack the files
  tar -xzf $REMOTE_DIR/$PACKAGE_NAME -C $REMOTE_DIR
  # Make the setup script executable
  chmod +x $REMOTE_DIR/deploy/setup-server.sh
  # Run the setup script with sudo
  sudo $REMOTE_DIR/deploy/setup-server.sh
"

# --- 4. Cleanup ---
echo "Cleaning up local package..."
rm $PACKAGE_NAME

echo "--- Deployment Complete ---"
echo "Your site should be live at https://opposed.io"
echo "To check logs, run: ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\" \"journalctl -u game-server.service -f\""
