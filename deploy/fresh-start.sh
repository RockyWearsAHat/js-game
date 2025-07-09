#!/bin/bash
# Script to launch a fresh EC2 instance with guaranteed SSH access

AWS_REGION="us-west-2"
INSTANCE_TYPE="t3.micro"
# Get the latest Amazon Linux 2023 AMI ID dynamically instead of hardcoding
SECURITY_GROUP_NAME="game-server-sg"
INSTANCE_NAME="game-server"

# Set to exit on error
set -e

echo "=== Fresh EC2 Instance Setup ==="
echo "This script will create a brand new EC2 instance with a new key pair"

# Get Amazon Linux 2023 AMI using EC2 API instead of SSM
echo "Finding latest Amazon Linux 2023 AMI..."
AMI_ID=$(aws ec2 describe-images \
  --region $AWS_REGION \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" \
  --output text)

echo "Using AMI: $AMI_ID"

# Create a unique key pair name with timestamp
KEY_NAME="fresh-game-server-key-$(date +%s)"
echo "Creating new key pair: $KEY_NAME"
KEY_FILE="$HOME/$KEY_NAME.pem"
aws ec2 create-key-pair --region $AWS_REGION --key-name $KEY_NAME --query 'KeyMaterial' --output text > "$KEY_FILE"
chmod 400 "$KEY_FILE"
echo "Key saved to: $KEY_FILE"

# Get the default VPC
DEFAULT_VPC_ID=$(aws ec2 describe-vpcs --region $AWS_REGION --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

# Check for existing security group
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups --region $AWS_REGION \
  --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" "Name=vpc-id,Values=$DEFAULT_VPC_ID" \
  --query "SecurityGroups[0].GroupId" --output text 2>/dev/null) || SECURITY_GROUP_ID=""

# Create security group if it doesn't exist
if [ -z "$SECURITY_GROUP_ID" ] || [ "$SECURITY_GROUP_ID" == "None" ]; then
  echo "Creating new security group..."
  SECURITY_GROUP_ID=$(aws ec2 create-security-group --region $AWS_REGION \
    --group-name $SECURITY_GROUP_NAME \
    --description "Security group for game server" \
    --vpc-id $DEFAULT_VPC_ID \
    --query 'GroupId' --output text)
  
  # Add security group rules
  aws ec2 authorize-security-group-ingress --region $AWS_REGION \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp --port 22 --cidr 0.0.0.0/0
    
  aws ec2 authorize-security-group-ingress --region $AWS_REGION \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp --port 80 --cidr 0.0.0.0/0
    
  aws ec2 authorize-security-group-ingress --region $AWS_REGION \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp --port 8080 --cidr 0.0.0.0/0
fi

# Create user data script for setup with Node.js 20
cat > /tmp/bootstrap.sh << 'EOF'
#!/bin/bash
# Update system
dnf update -y

# Install curl and development tools
dnf install -y curl gcc-c++ make

# Install Node.js 20 from NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

# Verify Node.js version
node --version
npm --version

# Set up application directory
mkdir -p /home/ec2-user/game-server
chown ec2-user:ec2-user /home/ec2-user/game-server
EOF

# Launch EC2 instance with proper error handling
echo "Launching new EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances --region $AWS_REGION \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SECURITY_GROUP_ID \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --user-data file:///tmp/bootstrap.sh \
  --query 'Instances[0].InstanceId' \
  --output text)

if [ -z "$INSTANCE_ID" ]; then
  echo "Failed to create instance. Exiting."
  exit 1
fi

echo "Instance created: $INSTANCE_ID"
echo "Waiting for instance to start..."
aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE_ID

# Get public IP with verification
PUBLIC_IP=$(aws ec2 describe-instances --region $AWS_REGION \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
  echo "Failed to get public IP. Instance may not be properly configured."
  exit 1
fi

echo "=== Instance Created Successfully ==="
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Key: $KEY_FILE"
echo ""
echo "To connect: ssh -i $KEY_FILE ec2-user@$PUBLIC_IP"

# Update deploy.sh
DEPLOY_SCRIPT="./deploy/deploy.sh"
if [ -f "$DEPLOY_SCRIPT" ]; then
  sed -i '' "s/EC2_HOST=\"[0-9.]*\"/EC2_HOST=\"$PUBLIC_IP\"/" "$DEPLOY_SCRIPT"
  sed -i '' "s|SSH_KEY=\"[^\"]*\"|SSH_KEY=\"$KEY_FILE\"|" "$DEPLOY_SCRIPT"
  echo "Updated $DEPLOY_SCRIPT with new IP and key path."
fi

echo "Wait about 30 seconds for the instance to fully initialize before connecting."
