import Phaser from 'phaser';
import { GAME } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';
import WinScene from './scenes/WinScene.js';

// On mobile, widen the game to match screen aspect ratio (no black bars)
// Keep height at 720, stretch width to fill screen
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const screenRatio = window.innerWidth / window.innerHeight;
const gameW = isMobile ? Math.round(GAME.HEIGHT * Math.max(screenRatio, GAME.WIDTH / GAME.HEIGHT)) : GAME.WIDTH;

const config = {
  type: Phaser.AUTO,
  width: gameW,
  height: GAME.HEIGHT,
  parent: 'game-container',
  backgroundColor: GAME.BACKGROUND_COLOR,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GAME.GRAVITY },
      debug: false  // set to true to see collision boxes
    }
  },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, WinScene],
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true
  },
  input: {
    activePointers: 4  // multi-touch for D-pad + buttons simultaneously
  }
};

const game = new Phaser.Game(config);

// === PWA: Register service worker ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// === PWA: Install prompt ===
// Chrome/Edge/Samsung: capture beforeinstallprompt
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

// iOS Safari: detect standalone mode and show hint if not installed
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: fullscreen)').matches
  || window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true;

if (isIOS && !isStandalone) {
  // Show iOS-specific install hint after a short delay
  setTimeout(() => showInstallBanner(true), 2500);
}

function showInstallBanner(isIOSHint) {
  // Don't show if already in standalone/fullscreen mode
  if (isStandalone) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';

  if (isIOSHint) {
    banner.innerHTML = `
      <span>Dodaj do ekranu: tap <strong>Udostepnij</strong> &#x2934; &rarr; <strong>Dodaj do ekranu</strong></span>
      <button id="pwa-dismiss">&times;</button>
    `;
  } else {
    banner.innerHTML = `
      <span>Zainstaluj Shadow Tagger na ekranie!</span>
      <button id="pwa-install">Instaluj</button>
      <button id="pwa-dismiss">&times;</button>
    `;
  }

  banner.style.cssText = `
    position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
    z-index: 10001; display: flex; align-items: center; gap: 12px;
    background: #111; color: #00ff88; font-family: monospace; font-size: 14px;
    padding: 10px 16px; border-radius: 10px; border: 1px solid #00ff8855;
    box-shadow: 0 4px 20px rgba(0,255,136,0.15);
    max-width: 90vw;
  `;
  document.body.appendChild(banner);

  const dismissBtn = document.getElementById('pwa-dismiss');
  dismissBtn.style.cssText = 'background:none;border:none;color:#ff6666;font-size:20px;cursor:pointer;padding:0 4px;';
  dismissBtn.addEventListener('click', () => banner.remove());

  const installBtn = document.getElementById('pwa-install');
  if (installBtn) {
    installBtn.style.cssText = 'background:#00ff88;color:#000;border:none;padding:6px 14px;border-radius:6px;font-family:monospace;font-weight:bold;cursor:pointer;';
    installBtn.addEventListener('click', () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
      }
      banner.remove();
    });
  }

  // Auto-dismiss after 15 seconds
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 15000);
}

// Auto-fullscreen on mobile — show "Tap to play" overlay that triggers fullscreen
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  const overlay = document.createElement('div');
  overlay.id = 'fullscreen-overlay';
  overlay.innerHTML = '<p>Tap to play</p>';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    display: flex; justify-content: center; align-items: center;
    background: rgba(10,10,30,0.85);
    color: #00ff88; font-family: monospace; font-size: 24px;
    cursor: pointer; touch-action: none;
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('pointerdown', () => {
    overlay.remove();
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      req.call(el).catch(() => {});
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
  }, { once: true });
}
