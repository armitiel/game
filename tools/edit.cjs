const { exec } = require('child_process');
const path = require('path');

// Start editor server
require('./editor-server.cjs');

// Open browser after short delay
setTimeout(() => {
  const url = 'http://localhost:3333';
  const cmd = process.platform === 'win32' ? `start ${url}`
    : process.platform === 'darwin' ? `open ${url}`
    : `xdg-open ${url}`;
  exec(cmd);
  console.log(`Browser opened: ${url}`);
}, 500);
