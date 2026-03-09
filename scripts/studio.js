#!/usr/bin/env node
/**
 * Studio launcher — builds, starts Vite dev server, opens game + level editor.
 *
 * Both game and editor run through Vite on port 8080.
 * Vite's built-in plugin (vite.config.js) handles:
 *   - GET  /levels-data  → parsed levels.js as JSON (editor startup)
 *   - POST /save         → writes levels.js + triggers HMR reload in game
 */
import { execSync, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Build
console.log('Building...');
execSync('npx vite build', { stdio: 'inherit', cwd: ROOT });

// 2. Start Vite dev server (serves game + editor + handles /save & /levels-data)
console.log('Starting Vite dev server on :8080...');
const vite = spawn('npx', ['vite', '--port', '8080'], {
  stdio: 'inherit',
  shell: true,
  cwd: ROOT,
});

// 3. Wait for server to be ready, then open both URLs
await setTimeout(2500);

const open = (url) => {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { shell: true, stdio: 'ignore' });
};

open('http://localhost:8080/');
open('http://localhost:8080/tools/level-editor.html');

console.log('\n  Game:    http://localhost:8080/');
console.log('  Editor:  http://localhost:8080/tools/level-editor.html');
console.log('  (Ctrl+C to stop)\n');

// Keep alive — exit when server dies
vite.on('close', (code) => process.exit(code));
process.on('SIGINT', () => { vite.kill(); process.exit(0); });
