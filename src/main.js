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
  },
  audio: {
    disableWebAudio: false,  // prefer WebAudio, Phaser falls back to HTML5 Audio if needed
    noAudio: false
  }
};

// iOS: pre-create and unlock AudioContext on first user gesture BEFORE Phaser starts.
// iOS Safari suspends AudioContext until a touch event handler creates or resumes it.
// This global handler ensures the context is unlocked as early as possible.
let _audioCtxUnlocked = false;
const unlockAudioContext = () => {
  if (_audioCtxUnlocked) return;
  _audioCtxUnlocked = true;
  try {
    // Create a silent AudioContext and resume it — this "unlocks" audio for the page
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      // Play a silent buffer to fully unlock on iOS
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      console.log('Audio context unlocked via user gesture');
    }
  } catch (e) {
    console.warn('Audio unlock failed:', e);
  }
};
// Listen on BOTH touchstart and click — touchstart fires first on iOS
document.addEventListener('touchstart', unlockAudioContext, { once: true });
document.addEventListener('click', unlockAudioContext, { once: true });

const game = new Phaser.Game(config);

// === PWA: Register service worker (skip in Vite dev mode to avoid HMR conflicts) ===
if ('serviceWorker' in navigator && !import.meta.hot) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
} else if (import.meta.hot && 'serviceWorker' in navigator) {
  // Dev mode: unregister any existing SW so it doesn't intercept Vite HMR
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
    console.log('[DEV] Unregistered', regs.length, 'service worker(s)');
  });
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

  // iOS share icon (square with arrow up) recreated in CSS
  const iosShareIcon = `<span style="display:inline-block;position:relative;width:22px;height:26px;vertical-align:middle;">
    <span style="position:absolute;bottom:0;left:3px;width:16px;height:18px;border:2px solid #00ff88;border-top:none;border-radius:0 0 3px 3px;"></span>
    <span style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:2px;height:16px;background:#00ff88;"></span>
    <span style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(-45deg);transform-origin:bottom left;width:2px;height:7px;background:#00ff88;"></span>
    <span style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(45deg);transform-origin:bottom right;width:2px;height:7px;background:#00ff88;"></span>
  </span>`;

  // iOS "Add to Home Screen" icon (plus in a square)
  const iosAddIcon = `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid #00ff88;border-radius:4px;font-size:18px;font-weight:bold;color:#00ff88;line-height:1;vertical-align:middle;">+</span>`;

  const stepStyle = 'display:flex;align-items:center;gap:8px;margin:4px 0;';
  const numStyle = 'display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:50%;background:#00ff88;color:#000;font-weight:bold;font-size:13px;';
  const arrowRight = '<span style="color:#00ff8888;font-size:18px;margin:0 2px;">&#10145;</span>';

  const messages = {
    'chromium': `
      <span>Zainstaluj Shadow Tagger na ekranie!</span>
      <button id="pwa-install">Instaluj</button>
      <button id="pwa-dismiss">&times;</button>
    `,
    'ios-safari': `
      <button id="pwa-dismiss" style="position:absolute;top:6px;right:8px;">&times;</button>
      <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:#00ff88;">Zainstaluj Shadow Tagger</div>
      <div style="${stepStyle}">
        <span style="${numStyle}">1</span>
        <span>Tap</span> ${iosShareIcon} <span style="color:#aaa;">na pasku Safari</span>
      </div>
      <div style="${stepStyle}">
        <span style="${numStyle}">2</span>
        <span>Wybierz</span> ${iosAddIcon} <strong>Na ekranie poczatkowym</strong>
      </div>
      <div style="${stepStyle}">
        <span style="${numStyle}">3</span>
        <span>Tap</span> <strong>Dodaj</strong> ${arrowRight} <span style="color:#aaa;">Gotowe!</span>
      </div>
    `,
    'ios-other': `
      <span>Otworz w <strong>Safari</strong> aby zainstalowac jako aplikacje</span>
      <button id="pwa-dismiss">&times;</button>
    `
  };
  banner.innerHTML = messages[type] || '';

  const isIOSGuide = type === 'ios-safari';
  banner.style.cssText = `
    position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
    z-index: 10001;
    display: ${isIOSGuide ? 'block' : 'flex'}; align-items: center; gap: 12px;
    background: #111; color: #00ff88; font-family: monospace; font-size: 14px;
    padding: ${isIOSGuide ? '14px 18px' : '10px 16px'}; border-radius: 10px; border: 1px solid #00ff8855;
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

// === Dev: reload game when level editor saves ===
if (import.meta.hot) {
  console.log('[DEV] HMR active — listening for levels-updated event');
  import.meta.hot.on('levels-updated', () => {
    console.log('[DEV] Received levels-updated HMR event! Reloading...');
    location.reload();
  });

  // Polling fallback: check /save-timestamp every 2s in case HMR websocket fails
  let _lastKnownTs = 0;
  setInterval(async () => {
    try {
      const r = await fetch('/save-timestamp', { cache: 'no-store' });
      const { ts } = await r.json();
      if (_lastKnownTs === 0) {
        _lastKnownTs = ts; // first poll — just record current timestamp
        console.log('[DEV] Poll: initial save timestamp:', ts);
      } else if (ts > _lastKnownTs) {
        console.log('[DEV] Poll: new save detected! ts:', ts, '(was:', _lastKnownTs, ') — reloading...');
        _lastKnownTs = ts;
        location.reload();
      }
    } catch (e) { /* server not ready yet */ }
  }, 2000);
} else {
  console.log('[DEV] import.meta.hot is NOT available — HMR disabled');
}
