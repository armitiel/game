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

// === PWA: Install prompt with browser detection ===
const isStandalone = window.matchMedia('(display-mode: fullscreen)').matches
  || window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true;

const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua);
const isAndroid = /android/i.test(ua);
// On iOS all browsers use WebKit — detect Safari (no CriOS/FxiOS/EdgiOS = real Safari)
const isIOSSafari = isIOS && !(/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua));
const isMobileDevice = isIOS || isAndroid;

let deferredInstallPrompt = null;

// Chrome/Edge/Samsung on Android: real install via beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (isMobileDevice) showInstallBanner('chromium');
});

// iOS Safari: only browser that supports "Add to Home Screen" PWA on iOS
if (isIOSSafari && !isStandalone) {
  setTimeout(() => showInstallBanner('ios-safari'), 2500);
}
// iOS but NOT Safari — PWA won't work, tell user to open in Safari
if (isIOS && !isIOSSafari && !isStandalone) {
  setTimeout(() => showInstallBanner('ios-other'), 2500);
}

function showInstallBanner(type) {
  if (isStandalone) return;
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';

  const messages = {
    'chromium': `
      <span>Zainstaluj Shadow Tagger na ekranie!</span>
      <button id="pwa-install">Instaluj</button>
      <button id="pwa-dismiss">&times;</button>
    `,
    'ios-safari': `
      <span>Zainstaluj: tap <strong style="font-size:18px">&#x2934;</strong> (Udostepnij) &rarr; <strong>Ekran poczatkowy</strong></span>
      <button id="pwa-dismiss">&times;</button>
    `,
    'ios-other': `
      <span>Otworz w <strong>Safari</strong> aby zainstalowac jako aplikacje</span>
      <button id="pwa-dismiss">&times;</button>
    `
  };
  banner.innerHTML = messages[type] || '';

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
  if (dismissBtn) {
    dismissBtn.style.cssText = 'background:none;border:none;color:#ff6666;font-size:20px;cursor:pointer;padding:0 4px;';
    dismissBtn.addEventListener('click', () => banner.remove());
  }

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

// Auto-fullscreen on mobile — enter fullscreen on first tap anywhere
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  document.addEventListener('pointerdown', () => {
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
