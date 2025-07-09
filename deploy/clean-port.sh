#!/bin/bash
# Script to clear port 8080 and restart the game server

# This script is intended to be run directly on the EC2 instance.
# It does not require SSH configuration within itself.

# Configuration
PORT_TO_CLEAN=${1:-8080}

echo "=== Cleaning Port $PORT_TO_CLEAN ==="

# Find and kill any process using the specified port
echo "Finding processes using port $PORT_TO_CLEAN..."
PORT_PID=$(sudo lsof -t -i:$PORT_TO_CLEAN)
if [ ! -z "$PORT_PID" ]; then
  echo "Found process(es) using port $PORT_TO_CLEAN: $PORT_PID"
  echo "Killing processes..."
  sudo kill -9 $PORT_PID
  echo "Process(es) killed."
else
  echo "No process found using port $PORT_TO_CLEAN."
fi

# Stop the service gracefully if it's running
echo "Stopping game-server service..."
sudo systemctl stop game-server.service || echo "Service was not running."

# Verify port is free
sleep 2
if sudo lsof -t -i:$PORT_TO_CLEAN; then
  echo "Warning: Port $PORT_TO_CLEAN is still in use after attempting to clear it!"
else
  echo "Port $PORT_TO_CLEAN is now free."
fi

echo "=== Port Cleanup Complete ==="
