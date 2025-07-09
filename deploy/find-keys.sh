#!/bin/bash
# Script to find all SSH keys and test connectivity

EC2_HOST="34.217.22.199"
EC2_USER="ec2-user"

echo "=== Finding Valid SSH Keys ==="
echo "Target: $EC2_HOST"

# Find all .pem files in common locations
echo "Searching for SSH key files..."
KEY_FILES=(
  $(find $HOME -name "*.pem" -type f 2>/dev/null)
  $(find ./deploy -name "*.pem" -type f 2>/dev/null)
  $(find . -name "*.pem" -type f 2>/dev/null)
)

echo "Found ${#KEY_FILES[@]} potential key files."
echo

# Try each key
for KEY in "${KEY_FILES[@]}"; do
  echo "Testing key: $KEY"
  chmod 400 "$KEY" 2>/dev/null
  
  # Try to connect
  ssh -i "$KEY" -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no $EC2_USER@"$EC2_HOST" "echo Connection successful" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✅ Success! This key works: $KEY"
    echo 
    echo "Update your scripts with:"
    echo "SSH_KEY=\"$KEY\""
    echo
    echo "Would you like to create a symlink to this key in the deploy directory? (y/n)"
    read -r create_link
    
    if [[ "$create_link" =~ ^[Yy]$ ]]; then
      ln -sf "$KEY" ./deploy/working-key.pem
      chmod 400 ./deploy/working-key.pem
      echo "Created symlink at ./deploy/working-key.pem"
      echo "Use SSH_KEY=\"./deploy/working-key.pem\" in your scripts"
    fi
    
    break
  else
    echo "❌ Key doesn't work"
  fi
  echo
done

echo "If no working key was found, you may need to:"
echo "1. Create a new instance with a new key pair"
echo "2. Use EC2 Instance Connect to access your instance"
echo "3. Reset the SSH key using the AWS console"
