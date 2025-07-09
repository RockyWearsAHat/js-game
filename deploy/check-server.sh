#!/bin/bash
# Script to check server and diagnose 500 errors

# Configuration
EC2_HOST="34.217.22.199" 
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Server Diagnostics ==="

# SSH into server to check configuration and logs
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  echo '=== System Info ==='
  uname -a
  df -h
  
  echo '=== File Structure ==='
  ls -la $APP_DIR
  
  echo '=== Check index.html ==='
  cat $APP_DIR/index.html | head -10
  
  echo '=== Nginx Configuration ==='
  sudo cat /etc/nginx/conf.d/game-server.conf
  
  echo '=== Nginx Error Logs ==='
  sudo tail -n 30 /var/log/nginx/error.log
  sudo tail -n 30 /var/log/nginx/game-server-error.log 2>/dev/null || echo 'No specific game-server error log found'
  
  echo '=== Game Server Logs ==='
  sudo journalctl -u game-server -n 30 --no-pager
  
  echo '=== Create Test File ==='
  echo '<html><body><h1>Test Page</h1></body></html>' > $APP_DIR/test.html
  echo 'Test file created at $APP_DIR/test.html'
  
  echo '=== SELinux Status ==='
  command -v getenforce >/dev/null && getenforce
  
  echo '=== Testing Nginx with curl ==='
  curl -v http://localhost/ 2>&1
"

echo "=== Local Tests ==="
echo "Checking port 80 access..."
nc -z -v $EC2_HOST 80

echo "Done. Try accessing: http://$EC2_HOST/test.html"
echo "If that works but the main page doesn't, it's likely a problem with your index.html file."
