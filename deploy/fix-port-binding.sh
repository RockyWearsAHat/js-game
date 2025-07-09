#!/bin/bash
# Script to fix port binding issues and use port forwarding

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixing Port Binding Issues ==="
echo "Setting up port forwarding from 80 to 8080..."

# Update game-server.service
scp -i "$SSH_KEY" ./deploy/game-server.service $EC2_USER@"$EC2_HOST":/tmp/

# SSH into server and set up port forwarding
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  # Update game server service to listen on port 8080
  sudo mv /tmp/game-server.service /etc/systemd/system/
  sudo systemctl daemon-reload
  
  # Set up port forwarding using iptables
  echo 'Setting up port forwarding...'
  sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
  sudo iptables -t nat -A OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port 8080
  
  # Make iptables rules persistent
  if ! command -v iptables-save &> /dev/null; then
    sudo dnf install -y iptables-services
    sudo systemctl enable iptables
  fi
  sudo iptables-save | sudo tee /etc/sysconfig/iptables
  
  # Restart game server
  sudo systemctl restart game-server
  
  # Verify it's running and listening
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  echo 'Listening ports:'
  sudo ss -tulpn | grep -E '(node|:80|:8080)'
  
  # Check connectivity from outside
  echo 'Testing connection from outside...'
  curl -I http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null | head -1
  public_ip=\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
  
  # Wait a moment for everything to start
  sleep 5
  
  # Test local connection
  echo 'Testing local port 8080:'
  curl -v http://localhost:8080/ 2>&1 | head -20
  
  echo 'Testing port forwarding (80 -> 8080):'
  curl -v http://localhost:80/ 2>&1 | head -20
"

echo "Setup fixed! The application should now be accessible at:"
echo "http://$EC2_HOST"
echo "WebSocket should be available at ws://$EC2_HOST"
echo ""
echo "If you still have issues, try accessing directly on port 8080:"
echo "http://$EC2_HOST:8080"
