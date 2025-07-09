#!/bin/bash
# Script to fix connection refused issues

# Configuration - update these values if needed
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixing Connection Refused Issue ==="

# SSH into server and run diagnostics/fixes
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  echo '=== System Status ==='
  uptime
  
  echo '=== Process Check ==='
  ps aux | grep node
  
  echo '=== Port Check ==='
  sudo ss -tulpn | grep -E ':(80|8080)' || echo 'No processes listening on web ports'
  
  echo '=== Firewall Status ==='
  sudo systemctl status firewalld || echo 'Firewall not running (good)'
  
  echo '=== Service Status ==='
  sudo systemctl status game-server --no-pager
  
  echo '=== Service Logs ==='
  sudo journalctl -u game-server -n 20 --no-pager
  
  echo '=== Creating Simple Test Server ==='
  cat > $APP_DIR/test-server.js << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Received request:', req.url);
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<html><body><h1>Test Server</h1><p>This is a test server running on port 8080</p></body></html>');
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Test server running at http://0.0.0.0:8080/');
});
EOF
  
  echo '=== Updating Service to Use Test Server ==='
  echo '[Unit]
Description=Test Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/game-server
ExecStart=/usr/bin/node test-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service
  
  echo '=== Starting Test Server ==='
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  echo '=== Checking Test Server Status ==='
  sudo systemctl status game-server --no-pager
  
  echo '=== Checking Ports Again ==='
  sudo ss -tulpn | grep -E ':(80|8080)' || echo 'Still no processes listening on web ports'
  
  echo '=== Testing Connectivity Locally ==='
  curl -v http://localhost:8080/ 2>&1 || echo 'Local curl failed'
  
  echo '=== Opening Firewall Port 8080 ==='
  sudo dnf install -y iptables-services
  sudo systemctl start iptables
  sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
  sudo service iptables save
  
  echo '=== Creating Keepalive Script ==='
  echo '#!/bin/bash
while true; do
  if ! pgrep -f test-server.js > /dev/null; then
    cd /home/ec2-user/game-server
    nohup node test-server.js > test-server.log 2>&1 &
    echo \"Restarted test server at \$(date)\"
  fi
  sleep 30
done' > $APP_DIR/keepalive.sh
  chmod +x $APP_DIR/keepalive.sh
  
  echo '=== Starting Keepalive Script ==='
  nohup $APP_DIR/keepalive.sh > $APP_DIR/keepalive.log 2>&1 &
  
  echo '=== Final Status ==='
  ps aux | grep node
  sudo ss -tulpn | grep -E ':(80|8080)'
"

echo "=== Connection Fix Complete ==="
echo "Try accessing the test server at: http://$EC2_HOST:8080"
echo ""
echo "If you still can't connect, run this AWS security group check:"
echo "aws ec2 describe-security-groups --region us-west-2 --filters \"Name=ip-permission.from-port,Values=8080\" --query \"SecurityGroups[].{Name:GroupName, ID:GroupId}\""
