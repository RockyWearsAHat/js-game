#!/bin/bash
# Script to check connectivity and troubleshoot website access issues

# Configuration
EC2_HOST="34.217.22.199"  # Your EC2 public IP
SSH_KEY="$HOME/game-server-key-fixed-1752003505.pem"  # Update this to your current key path
EC2_USER="ec2-user"

echo "=== Website Connectivity Check ==="

# Check if port 80 is open
echo "Checking if port 80 is accessible..."
nc -z -w 5 $EC2_HOST 80
if [ $? -ne 0 ]; then
  echo "❌ Port 80 (HTTP) is not accessible!"
  echo "This could be due to:"
  echo "- AWS Security Group not allowing port 80"
  echo "- Nginx not running properly"
  echo "- Firewall blocking the connection"
else
  echo "✅ Port 80 is open and accessible"
fi

# Check if port 8080 is open
echo "Checking if port 8080 is accessible..."
nc -z -w 5 $EC2_HOST 8080
if [ $? -ne 0 ]; then
  echo "❌ Port 8080 (WebSocket) is not accessible!"
  echo "This could be due to:"
  echo "- AWS Security Group not allowing port 8080"
  echo "- Node.js service not running properly"
  echo "- Firewall blocking the connection"
else
  echo "✅ Port 8080 is open and accessible"
fi

# SSH into the server to check configurations and logs
echo "Checking server configuration and logs..."
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  echo '=== Server Checks ==='
  
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  sudo systemctl status nginx --no-pager
  
  echo 'File verification:'
  if [ -f /home/ec2-user/game-server/index.html ]; then
    echo '✅ index.html exists'
    cat /home/ec2-user/game-server/index.html | head -5
  else
    echo '❌ index.html is missing!'
    find /home/ec2-user/game-server -name '*.html'
  fi
  
  echo 'Server logs:'
  sudo journalctl -u game-server -n 20 --no-pager
  sudo tail -n 20 /var/log/nginx/error.log
  
  echo 'Network ports:'
  sudo ss -tulpn | grep -E ':(80|8080)'
  
  echo 'Security group verification:'
  curl -s http://169.254.169.254/latest/meta-data/security-groups
"

echo ""
echo "=== AWS Security Group Check ==="
echo "Checking AWS security group configuration..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --region us-west-2 \
  --filters "Name=ip-address,Values=$EC2_HOST" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text 2>/dev/null)

if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
  SG_ID=$(aws ec2 describe-instances \
    --region us-west-2 \
    --instance-ids $INSTANCE_ID \
    --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" \
    --output text)
  
  echo "Found security group: $SG_ID"
  
  # Check if port 80 is allowed
  HTTP_RULE=$(aws ec2 describe-security-groups \
    --region us-west-2 \
    --group-ids $SG_ID \
    --query "SecurityGroups[0].IpPermissions[?ToPort==\`80\`]" \
    --output text)
  
  if [ -z "$HTTP_RULE" ]; then
    echo "❌ Port 80 is not allowed in the security group!"
    echo "Would you like to add it? (y/n)"
    read -r add_http
    
    if [[ "$add_http" =~ ^[Yy]$ ]]; then
      aws ec2 authorize-security-group-ingress \
        --region us-west-2 \
        --group-id $SG_ID \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0
      echo "✅ Port 80 added to security group"
    fi
  else
    echo "✅ Port 80 is allowed in the security group"
  fi
  
  # Check if port 8080 is allowed
  WS_RULE=$(aws ec2 describe-security-groups \
    --region us-west-2 \
    --group-ids $SG_ID \
    --query "SecurityGroups[0].IpPermissions[?ToPort==\`8080\`]" \
    --output text)
  
  if [ -z "$WS_RULE" ]; then
    echo "❌ Port 8080 is not allowed in the security group!"
    echo "Would you like to add it? (y/n)"
    read -r add_ws
    
    if [[ "$add_ws" =~ ^[Yy]$ ]]; then
      aws ec2 authorize-security-group-ingress \
        --region us-west-2 \
        --group-id $SG_ID \
        --protocol tcp \
        --port 8080 \
        --cidr 0.0.0.0/0
      echo "✅ Port 8080 added to security group"
    fi
  else
    echo "✅ Port 8080 is allowed in the security group"
  fi
else
  echo "❌ Could not find instance with IP $EC2_HOST"
fi
