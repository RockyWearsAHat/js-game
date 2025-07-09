#!/bin/bash
# Script to launch a fresh EC2 instance with direct Node.js server (no nginx)

AWS_REGION="us-west-2"
INSTANCE_TYPE="t3.micro"
SECURITY_GROUP_NAME="game-server-sg"
INSTANCE_NAME="game-server"

echo "=== Creating Fresh EC2 Instance ==="
echo "This script will create a new EC2 instance with direct Node.js access"

# Create a new key pair
KEY_NAME="game-server-key-$(date +%s)"
KEY_FILE="$HOME/$KEY_NAME.pem"
echo "Creating new key pair: $KEY_NAME"
aws ec2 create-key-pair --region $AWS_REGION --key-name $KEY_NAME --query 'KeyMaterial' --output text > "$KEY_FILE"
chmod 400 "$KEY_FILE"
echo "Key saved to: $KEY_FILE"

# Get latest Amazon Linux 2023 AMI
echo "Finding latest Amazon Linux 2023 AMI..."
AMI_ID=$(aws ec2 describe-images \
  --region $AWS_REGION \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" \
  --output text)

echo "Using AMI: $AMI_ID"

# Get or create security group
echo "Setting up security group..."
DEFAULT_VPC_ID=$(aws ec2 describe-vpcs --region $AWS_REGION --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SG_ID=$(aws ec2 describe-security-groups --region $AWS_REGION \
  --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" "Name=vpc-id,Values=$DEFAULT_VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text 2>/dev/null) || SG_ID=""

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
  echo "Creating new security group..."
  SG_ID=$(aws ec2 create-security-group --region $AWS_REGION \
    --group-name $SECURITY_GROUP_NAME \
    --description "Security group for game server" \
    --vpc-id $DEFAULT_VPC_ID \
    --query 'GroupId' --output text)
  
  # Add all required ports to security group
  echo "Adding required ports to security group..."
  aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 8080 --cidr 0.0.0.0/0
  aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol icmp --port -1 --cidr 0.0.0.0/0
fi

# Create user data script for bootstrap
cat > /tmp/user-data.sh << 'EOF'
#!/bin/bash
# Update system
dnf update -y
dnf install -y nodejs git

# Set up app directory
mkdir -p /home/ec2-user/game-server
chown ec2-user:ec2-user /home/ec2-user/game-server

# Create a simple test server
cat > /home/ec2-user/game-server/test-server.js << 'SERVEREOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  console.log(`Request for: ${req.url}`);
  
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>Game Server</h1><p>Server is running!</p></body></html>');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
SERVEREOF

# Set up systemd service file
cat > /etc/systemd/system/game-server.service << 'SERVICEEOF'
[Unit]
Description=Game Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/game-server
ExecStart=/usr/bin/node /home/ec2-user/game-server/test-server.js
Restart=always
RestartSec=10
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Set up port forwarding from 80 to 8080
echo "Setting up port forwarding from 80 to 8080..."
cat > /etc/rc.local << 'RCEOF'
#!/bin/bash
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
EOF
chmod +x /etc/rc.local
/etc/rc.local

# Start service
systemctl enable game-server
systemctl start game-server
EOF

# Launch instance
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances --region $AWS_REGION \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --user-data file:///tmp/user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Waiting for instance to start..."
aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --region $AWS_REGION \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo ""
echo "=== Instance Created Successfully ==="
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Key: $KEY_FILE"
echo ""
echo "To connect: ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"
echo ""
echo "The server should be accessible at:"
echo "http://$PUBLIC_IP"
echo "and"
echo "http://$PUBLIC_IP:8080"
echo ""
echo "Wait about 2-3 minutes for the instance to initialize completely."

# Update configuration for deployment
echo "EC2_HOST=\"$PUBLIC_IP\"" > ./deploy/server-config.env
echo "SSH_KEY=\"$KEY_FILE\"" >> ./deploy/server-config.env

echo ""
echo "Server configuration saved to ./deploy/server-config.env"
echo "Use these settings in your deployment scripts."
