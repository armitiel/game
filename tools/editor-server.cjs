const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LEVELS_PATH = path.join(__dirname, '..', 'src', 'config', 'levels.js');
const EDITOR_PATH = path.join(__dirname, 'level-editor.html');
const PORT = 3333;

/**
 * Parse levels.js and extract level data as plain JSON.
 * levels.js uses ES module syntax and relative coords like (H - 156).
 * We evaluate it in a sandbox to get the actual numbers.
 */
function parseLevelsJS() {
  try {
    let code = fs.readFileSync(LEVELS_PATH, 'utf-8');
    // Strip ES module syntax → make it plain script
    code = code.replace(/^import .*/gm, '');
    code = code.replace(/^export /gm, '');
    // Provide GAME constant
    code = `const GAME = { WIDTH: 1280, HEIGHT: 720 };\n` + code;
    // Execute and extract LEVELS
    const sandbox = {};
    vm.runInNewContext(code + '\n__result = JSON.stringify(LEVELS);', sandbox);
    return sandbox.__result; // JSON string
  } catch (e) {
    console.error('Failed to parse levels.js:', e.message);
    return null;
  }
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve editor HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/editor')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(EDITOR_PATH, 'utf-8'));
    return;
  }

  // Return parsed level data as JSON (editor loads this on startup)
  if (req.method === 'GET' && req.url === '/levels-data') {
    const json = parseLevelsJS();
    if (json) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(json);
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to parse levels.js' }));
    }
    return;
  }

  // Read raw levels.js source
  if (req.method === 'GET' && req.url === '/levels') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(fs.readFileSync(LEVELS_PATH, 'utf-8'));
    return;
  }

  // Save levels.js
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFileSync(LEVELS_PATH, body, 'utf-8');
      console.log(`[${new Date().toLocaleTimeString()}] levels.js saved (${body.length} bytes)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Level editor server running at http://localhost:${PORT}`);
  console.log(`Saving to: ${LEVELS_PATH}`);
});
