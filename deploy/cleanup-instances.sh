#!/bin/bash
# Script to identify and clean up multiple EC2 instances (macOS compatible)

AWS_REGION="us-west-2"
INSTANCE_NAME="game-server"

echo "Identifying all running EC2 instances with name '$INSTANCE_NAME'..."

# Get all running instances with the tag Name=game-server
INSTANCES=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
  --query "Reservations[].Instances[].[InstanceId,LaunchTime,PublicIpAddress]" \
  --output text)

if [ -z "$INSTANCES" ]; then
  echo "No matching instances found."
  exit 0
fi

# Display all instances
echo -e "\nFound the following instances:"
echo -e "INDEX\tINSTANCE ID\t\tPUBLIC IP\t\tLAUNCH TIME"
echo "----------------------------------------------------------------------"

# Parse the instances into arrays using standard shell approach (macOS compatible)
# Create empty arrays
INSTANCE_IDS=()
PUBLIC_IPS=()
LAUNCH_TIMES=()

# Read the output line by line into arrays
i=0
while read -r instance_id launch_time public_ip; do
  INSTANCE_IDS[$i]=$instance_id
  LAUNCH_TIMES[$i]=$launch_time
  PUBLIC_IPS[$i]=$public_ip
  
  echo -e "$i\t$instance_id\t$public_ip\t$launch_time"
  ((i++))
done <<< "$INSTANCES"

INSTANCE_COUNT=$i

echo -e "\nWould you like to:"
echo "1) Keep the newest instance and terminate all others"
echo "2) Select which instance to keep"
echo "3) Terminate all instances"
echo "4) Exit without terminating any instances"
read -p "Enter your choice (1-4): " CHOICE

case $CHOICE in
  1)
    # We can't easily determine the newest instance in a portable way here
    # Ask user to select the newest one from the list
    echo "Please select the index of the newest instance (look at the launch time column):"
    read NEWEST_INDEX
    
    if [[ $NEWEST_INDEX =~ ^[0-9]+$ ]] && [ $NEWEST_INDEX -lt $INSTANCE_COUNT ]; then
      NEWEST_INSTANCE_ID=${INSTANCE_IDS[$NEWEST_INDEX]}
      NEWEST_INSTANCE_IP=${PUBLIC_IPS[$NEWEST_INDEX]}
      
      echo "Keeping instance: $NEWEST_INSTANCE_ID ($NEWEST_INSTANCE_IP)"
      
      # Terminate all other instances
      for i in $(seq 0 $((INSTANCE_COUNT-1))); do
        if [ $i -ne $NEWEST_INDEX ]; then
          echo "Terminating instance: ${INSTANCE_IDS[$i]}"
          aws ec2 terminate-instances --region $AWS_REGION --instance-ids ${INSTANCE_IDS[$i]}
        fi
      done
      
      echo "Would you like to update your deploy.sh script with the IP of the kept instance? (y/n)"
      read UPDATE_DEPLOY
      
      if [[ "$UPDATE_DEPLOY" =~ ^[Yy]$ ]]; then
        DEPLOY_SCRIPT="/Users/alexwaldmann/Desktop/stupid/deploy/deploy.sh"
        if [ -f "$DEPLOY_SCRIPT" ]; then
          # Update the EC2_HOST in deploy.sh
          sed -i '' "s/EC2_HOST=\"[0-9.]*\"/EC2_HOST=\"$NEWEST_INSTANCE_IP\"/" "$DEPLOY_SCRIPT"
          echo "Updated $DEPLOY_SCRIPT with IP: $NEWEST_INSTANCE_IP"
        else
          echo "Could not find deploy.sh at $DEPLOY_SCRIPT"
        fi
      fi
    else
      echo "Invalid index selected."
    fi
    ;;
    
  2)
    # Let user select which instance to keep
    read -p "Enter the INDEX of the instance to keep: " KEEP_INDEX
    
    if [[ $KEEP_INDEX =~ ^[0-9]+$ ]] && [ $KEEP_INDEX -lt $INSTANCE_COUNT ]; then
      KEEP_INSTANCE_ID=${INSTANCE_IDS[$KEEP_INDEX]}
      KEEP_INSTANCE_IP=${PUBLIC_IPS[$KEEP_INDEX]}
      
      echo "Keeping instance: $KEEP_INSTANCE_ID ($KEEP_INSTANCE_IP)"
      
      # Terminate all other instances
      for i in $(seq 0 $((INSTANCE_COUNT-1))); do
        if [ $i -ne $KEEP_INDEX ]; then
          echo "Terminating instance: ${INSTANCE_IDS[$i]}"
          aws ec2 terminate-instances --region $AWS_REGION --instance-ids ${INSTANCE_IDS[$i]}
        fi
      done
      
      echo "Would you like to update your deploy.sh script with the IP of the kept instance? (y/n)"
      read UPDATE_DEPLOY
      
      if [[ "$UPDATE_DEPLOY" =~ ^[Yy]$ ]]; then
        DEPLOY_SCRIPT="/Users/alexwaldmann/Desktop/stupid/deploy/deploy.sh"
        if [ -f "$DEPLOY_SCRIPT" ]; then
          # Update the EC2_HOST in deploy.sh
          sed -i '' "s/EC2_HOST=\"[0-9.]*\"/EC2_HOST=\"$KEEP_INSTANCE_IP\"/" "$DEPLOY_SCRIPT"
          echo "Updated $DEPLOY_SCRIPT with IP: $KEEP_INSTANCE_IP"
        else
          echo "Could not find deploy.sh at $DEPLOY_SCRIPT"
        fi
      fi
    else
      echo "Invalid index selected."
    fi
    ;;
    
  3)
    # Terminate all instances
    echo "Terminating all instances..."
    for i in $(seq 0 $((INSTANCE_COUNT-1))); do
      echo "Terminating instance: ${INSTANCE_IDS[$i]}"
      aws ec2 terminate-instances --region $AWS_REGION --instance-ids ${INSTANCE_IDS[$i]}
    done
    ;;
    
  4)
    echo "No instances terminated."
    ;;
    
  *)
    echo "Invalid choice."
    ;;
esac

echo "Done."
