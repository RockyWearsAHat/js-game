#!/bin/bash
# Script to verify the build output and structure

echo "=== Build Output Verification ==="

# Clean previous build
echo "Cleaning previous build..."
rm -rf ./dist

# Run build
echo "Building application..."
npm run build

# Check build output
echo "Checking build output structure..."
if [ -d "./dist" ]; then
  echo "✅ dist directory exists"
  find ./dist -type f | sort
else
  echo "❌ ERROR: dist directory not found!"
fi

# Specifically check for index.html
if [ -f "./dist/index.html" ]; then
  echo "✅ index.html found in dist folder"
else
  echo "❌ ERROR: index.html not found in dist folder!"
  # Look for it elsewhere
  echo "Searching for index.html..."
  find . -name "index.html" -not -path "*node_modules*" -not -path "*\.git*"
fi

# Check for assets
if [ -d "./dist/assets" ]; then
  echo "✅ assets directory found"
  ls -la ./dist/assets
else
  echo "❌ ERROR: assets directory not found in dist folder!"
  # Look for it elsewhere
  echo "Searching for assets directory..."
  find . -name "assets" -type d -not -path "*node_modules*" -not -path "*\.git*"
fi

echo ""
echo "=== Current Directory Structure ==="
find . -maxdepth 2 -type f -name "index.html" -not -path "*node_modules*" -not -path "*\.git*"
find . -maxdepth 2 -type d -name "assets" -not -path "*node_modules*" -not -path "*\.git*"

echo ""
echo "If index.html is not in the dist folder, try the following:"
echo "1. Update vite.config.ts as suggested"
echo "2. Make sure your index.html is at the correct location"
echo "3. Run the build again"
