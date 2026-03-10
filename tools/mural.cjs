const { exec } = require('child_process');

// Start mural editor server
require('./mural-server.cjs');

// Open browser after short delay
setTimeout(() => {
  const url = 'http://localhost:3334';
  const cmd = process.platform === 'win32' ? `start ${url}`
    : process.platform === 'darwin' ? `open ${url}`
    : `xdg-open ${url}`;
  exec(cmd);
  console.log(`Browser opened: ${url}`);
}, 500);
