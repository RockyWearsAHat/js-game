#!/bin/bash
# Script to check what's using port 8080 on the server

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"

echo "=== Port Usage Investigation ==="
echo "This will check what processes are using port 8080 on your server"

# SSH into the server and run diagnostics
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  echo '=== Process List ==='
  ps aux | grep node
  
  echo '=== Listening Ports ==='
  sudo ss -tulpn | grep ':8080'
  
  echo '=== Process Using Port 8080 ==='
  PORT_PID=\$(sudo lsof -t -i:8080 2>/dev/null)
  if [ ! -z \"\$PORT_PID\" ]; then
    echo \"Process(es) using port 8080: \$PORT_PID\"
    echo \"Process details:\"
    ps -f -p \$PORT_PID
    
    echo \"Would you like to kill this process? (y/n)\"
    read -r answer
    if [[ \"\$answer\" =~ ^[Yy]\$ ]]; then
      sudo kill -9 \$PORT_PID
      echo \"Process killed. Checking port again...\"
      sleep 1
      if sudo ss -tulpn | grep ':8080'; then
        echo \"Port 8080 still in use by another process\"
      else
        echo \"Port 8080 is now free\"
      fi
    fi
  else
    echo \"No process found using port 8080 directly\"
    
    echo '=== Looking for related processes ==='
    sudo ps aux | grep -E 'server|node|8080'
    
    echo '=== Checking systemd services ==='
    systemctl list-units --type=service --state=running | grep -E 'server|node|game'
  fi
  
  echo '=== Checking Simple Server ==='
  if pgrep -f simple-server.js; then
    echo \"simple-server.js is running\"
  else
    echo \"simple-server.js is not running\"
  fi
  
  echo '=== Service Status ==='
  sudo systemctl status game-server --no-pager || true
"

echo "=== Next Steps ==="
echo "1. If a process is using port 8080, SSH in and kill it:"
echo "   ssh -i \"$SSH_KEY\" $EC2_USER@\"$EC2_HOST\""
echo "   sudo kill -9 <PID>"
echo ""
echo "2. Then restart your service with a different port:"
echo "   sudo sed -i 's/PORT=8080/PORT=8081/g' /etc/systemd/system/game-server.service"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl restart game-server"
echo ""
echo "3. Update your client to connect to port 8081 instead of 8080"
