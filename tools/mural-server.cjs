const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3334;
const PAINTINGS_DIR = path.join(__dirname, '..', 'public', 'assets', 'paintings');
const EDITOR_HTML = path.join(__dirname, 'mural-editor.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve editor HTML
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(EDITOR_HTML, 'utf-8'));
    return;
  }

  // List available mural JSON files
  if (req.method === 'GET' && url.pathname === '/mural-list') {
    const files = fs.readdirSync(PAINTINGS_DIR).filter(f => f.endsWith('.json'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // Load a mural file
  if (req.method === 'GET' && url.pathname === '/mural-load') {
    const file = url.searchParams.get('file');
    if (!file || file.includes('..') || !file.endsWith('.json')) {
      res.writeHead(400); res.end('Bad file'); return;
    }
    const filePath = path.join(PAINTINGS_DIR, file);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // Save a mural file
  if (req.method === 'POST' && url.pathname === '/mural-save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        if (!filename || !filename.endsWith('.json') || filename.includes('..')) {
          res.writeHead(400); res.end('Bad filename'); return;
        }
        const filePath = path.join(PAINTINGS_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] Saved: ${filename} (${cols_rows(data)})`);
        res.writeHead(200); res.end('OK');
      } catch (e) {
        console.error('Save error:', e.message);
        res.writeHead(500); res.end('Error');
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

function cols_rows(data) {
  return `${data.cols}x${data.rows}, ${data.colors ? data.colors.length : '?'} colors`;
}

server.listen(PORT, () => {
  console.log(`Mural editor server running at http://localhost:${PORT}`);
  console.log(`Paintings directory: ${PAINTINGS_DIR}`);
});
