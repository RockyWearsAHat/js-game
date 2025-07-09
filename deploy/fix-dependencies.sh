#!/bin/bash
# Script to fix missing dependencies and create a simple test server

# Configuration
EC2_HOST="34.217.22.199"
SSH_KEY="/Users/alexwaldmann/fresh-game-server-key-1752004606.pem"
EC2_USER="ec2-user"
APP_DIR="/home/$EC2_USER/game-server"

echo "=== Fixing Missing Dependencies ==="

# SSH into server and install dependencies
ssh -i "$SSH_KEY" $EC2_USER@"$EC2_HOST" "
  echo 'Installing missing dependencies...'
  cd $APP_DIR
  npm install dotenv
  
  # Create a simple test server file that will definitely work
  echo 'Creating simple test server...'
  cat > $APP_DIR/simple-server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  console.log(\`Request received: \${req.url}\`);
  
  if (req.url === '/' || req.url === '/index.html') {
    // Check if index.html exists
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const content = fs.readFileSync(indexPath);
      res.end(content);
    } else {
      // Fallback message
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Game Server</h1><p>Server is running but index.html not found!</p></body></html>');
    }
  } else if (req.url.startsWith('/assets/')) {
    // Serve assets
    const assetPath = path.join(__dirname, req.url);
    if (fs.existsSync(assetPath)) {
      let contentType = 'application/octet-stream';
      if (req.url.endsWith('.js')) contentType = 'text/javascript';
      if (req.url.endsWith('.css')) contentType = 'text/css';
      if (req.url.endsWith('.png')) contentType = 'image/png';
      if (req.url.endsWith('.jpg')) contentType = 'image/jpeg';
      
      res.writeHead(200, { 'Content-Type': contentType });
      const content = fs.readFileSync(assetPath);
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } else {
    // List files in directory for debugging
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    let fileList = 'Files in directory:\\n';
    
    try {
      const files = fs.readdirSync(__dirname);
      files.forEach(file => {
        const stats = fs.statSync(path.join(__dirname, file));
        fileList += \`\${file} (\${stats.isDirectory() ? 'dir' : 'file'})\\n\`;
      });
      
      if (fs.existsSync(path.join(__dirname, 'assets'))) {
        fileList += '\\nFiles in assets:\\n';
        const assetFiles = fs.readdirSync(path.join(__dirname, 'assets'));
        assetFiles.forEach(file => {
          fileList += \`assets/\${file}\\n\`;
        });
      }
      
      res.end(fileList);
    } catch (err) {
      res.end(\`Error listing files: \${err.message}\`);
    }
  }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running at http://0.0.0.0:\${PORT}/\`);
});
EOF

  # Create a simple HTML file for testing
  echo 'Creating test HTML file...'
  cat > $APP_DIR/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Game Server Test</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Game Server is Running!</h1>
  <p>If you see this page, the simple server is working correctly.</p>
  <p>The time on the server is: <span id='server-time'></span></p>
  
  <script>
    // Update the time every second
    setInterval(() => {
      document.getElementById('server-time').textContent = new Date().toLocaleTimeString();
    }, 1000);
  </script>
</body>
</html>
EOF

  # Update service file to use the simple server
  echo 'Updating service file to use simple server...'
  echo '[Unit]
Description=Game Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/game-server
ExecStart=/usr/bin/node simple-server.js
Restart=always
RestartSec=10
Environment=PORT=8080
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target' | sudo tee /etc/systemd/system/game-server.service

  # Restart the service
  sudo systemctl daemon-reload
  sudo systemctl restart game-server
  
  # Check service status
  echo 'Service status:'
  sudo systemctl status game-server --no-pager
  
  # List listening ports
  echo 'Listening ports:'
  sudo ss -tulpn | grep :8080
  
  # Show server logs
  echo 'Server logs:'
  sudo journalctl -u game-server -n 10 --no-pager
"

echo "=== Fix Complete ==="
echo "A simple test server has been deployed and should be running at:"
echo "http://$EC2_HOST:8080"
echo ""
echo "When you're ready to deploy your actual application, run:"
echo "./deploy/complete-deploy.sh"
echo ""
echo "But make sure to include the 'dotenv' package in your dependencies first!"
