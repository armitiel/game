import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Plugin: level editor save + load endpoints
function levelEditorSave() {
  return {
    name: 'level-editor-save',
    configureServer(server) {
      let _lastSaveTs = 0; // timestamp of last save

      // GET /save-timestamp — poll endpoint for game to detect new saves
      server.middlewares.use('/save-timestamp', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ ts: _lastSaveTs }));
      });

      // GET /levels-data — return parsed levels.js as JSON for editor startup
      server.middlewares.use('/levels-data', (req, res) => {
        console.log('[VITE PLUGIN] /levels-data request:', req.method);
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        try {
          const filePath = path.resolve('src/config/levels.js');
          console.log('[VITE PLUGIN] Reading levels.js from:', filePath);
          let code = fs.readFileSync(filePath, 'utf-8');
          code = code.replace(/^import .*/gm, '');
          code = code.replace(/^export /gm, '');
          code = 'const GAME = { WIDTH: 1280, HEIGHT: 720 };\n' + code;
          const sandbox = {};
          vm.runInNewContext(code + '\n__result = JSON.stringify(LEVELS);', sandbox);
          console.log('[VITE PLUGIN] /levels-data OK, length:', sandbox.__result.length);
          res.setHeader('Content-Type', 'application/json');
          res.end(sandbox.__result);
        } catch (e) {
          console.error('[VITE PLUGIN] /levels-data ERROR:', e.message);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // ---- Mural editor endpoints ----
      const muralsDir = path.resolve('public/assets/paintings');

      // GET /mural-list — return array of mural JSON filenames
      server.middlewares.use('/mural-list', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        try {
          const files = fs.readdirSync(muralsDir).filter(f => f.endsWith('.json'));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
        } catch (e) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
        }
      });

      // GET /mural-load?file=xxx — return mural JSON content
      server.middlewares.use('/mural-load', (req, res) => {
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        const url = new URL(req.url, 'http://localhost');
        const file = url.searchParams.get('file');
        if (!file) { res.statusCode = 400; res.end('{"error":"missing file param"}'); return; }
        try {
          const content = fs.readFileSync(path.join(muralsDir, path.basename(file)), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(content);
        } catch (e) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // POST /mural-save — save mural JSON to file
      server.middlewares.use('/mural-save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { filename, data } = JSON.parse(body);
            if (!filename) throw new Error('missing filename');
            if (!fs.existsSync(muralsDir)) fs.mkdirSync(muralsDir, { recursive: true });
            fs.writeFileSync(path.join(muralsDir, path.basename(filename)), JSON.stringify(data, null, 2), 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // POST /save — write levels.js and trigger game reload
      server.middlewares.use('/save', (req, res) => {
        console.log('[VITE PLUGIN] /save request:', req.method, req.url);
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const target = path.resolve('src/config/levels.js');
          console.log('[VITE PLUGIN] Writing levels.js to:', target, '(', body.length, 'bytes )');
          fs.writeFileSync(target, body, 'utf-8');
          // Invalidate Vite's cached module so next load gets fresh file
          const mod = server.moduleGraph.getModulesByFile(target);
          console.log('[VITE PLUGIN] Module graph entries found:', mod ? mod.size : 0);
          if (mod) mod.forEach(m => server.moduleGraph.invalidateModule(m));
          // Update save timestamp for polling fallback
          _lastSaveTs = Date.now();
          // Tell game to reload via HMR (try both ws and hot API)
          const ws = server.hot || server.ws;
          console.log('[VITE PLUGIN] Sending HMR event via:', server.hot ? 'server.hot' : 'server.ws');
          try {
            ws.send({ type: 'custom', event: 'levels-updated', data: {} });
            console.log('[VITE PLUGIN] HMR event sent OK');
          } catch (e) {
            console.error('[VITE PLUGIN] HMR send error:', e.message);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, file: target, ts: _lastSaveTs }));
          console.log('[VITE PLUGIN] /save complete OK, ts:', _lastSaveTs);
        });
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [levelEditorSave()],
  server: {
    port: 8080,
    open: true,
    watch: {
      ignored: ['**/src/config/levels.js']
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  }
});
