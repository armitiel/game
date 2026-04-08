import Phaser from 'phaser';
import { GAME } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';
import WinScene from './scenes/WinScene.js';
import IntroScene from './scenes/IntroScene.js';
import { t } from './config/i18n.js';

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const config = {
  type: Phaser.AUTO,
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  parent: 'game-container',
  backgroundColor: GAME.BACKGROUND_COLOR,
  fps: {
    limit: 114
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GAME.GRAVITY },
      debug: false  // set to true to see collision boxes
    }
  },
  scene: [BootScene, MenuScene, LevelSelectScene, IntroScene, GameScene, WinScene],
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: isMobile ? Phaser.Scale.EXPAND : Phaser.Scale.FIT,
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

// === Orientation gate ===
// On touch devices, defer booting Phaser until the device is actually
// in landscape. Otherwise the logo/intro screen renders under the rotate
// overlay at portrait dimensions and has to survive a massive resize
// when the user rotates.
const _isTouchDevice = window.matchMedia('(pointer: coarse)').matches
  || ('ontouchstart' in window)
  || (navigator.maxTouchPoints > 0);
function _isLandscapeNow() {
  // Trust window dimensions — screen.orientation lies during transitions
  return window.innerWidth >= window.innerHeight;
}

// Force-load Bungee font before starting Phaser so the loading screen uses it
const fontFace = new FontFace('Bungee', 'url(/assets/sprites/elementy/Bungee-Regular.ttf)');
let _phaserGame = null;
let _phaserBootScheduled = false;

function _bootPhaser() {
  if (_phaserGame || _phaserBootScheduled) return;
  _phaserBootScheduled = true;
  fontFace.load().then(f => {
    document.fonts.add(f);
    _phaserGame = new Phaser.Game(config);
  }).catch(() => {
    _phaserGame = new Phaser.Game(config); // fallback if font fails
  });
}

function _checkOrientationAndBoot() {
  if (_phaserGame || _phaserBootScheduled) return;
  if (!_isTouchDevice || _isLandscapeNow()) {
    // Wait two frames for viewport to settle after rotation animation
    requestAnimationFrame(() => requestAnimationFrame(_bootPhaser));
  }
}

// Initial check — desktop boots immediately; mobile-landscape also boots
_checkOrientationAndBoot();

// If still waiting (mobile portrait), listen for rotation
if (!_phaserBootScheduled) {
  const _mql = window.matchMedia('(orientation: landscape)');
  if (_mql.addEventListener) {
    _mql.addEventListener('change', _checkOrientationAndBoot);
  } else if (_mql.addListener) {
    _mql.addListener(_checkOrientationAndBoot);
  }
  window.addEventListener('resize', _checkOrientationAndBoot);
  window.addEventListener('orientationchange', _checkOrientationAndBoot);
  if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
    window.screen.orientation.addEventListener('change', _checkOrientationAndBoot);
  }
}

// === Robust resize / orientation handling ===
// Browsers (esp. mobile) fire multiple resize events during orientation
// transitions and animations; Phaser's ScaleManager can latch onto an
// intermediate size, leaving the canvas fitted to the wrong dimensions.
// We debounce and force scale.refresh() on multiple triggers so the
// final window size is always caught.
let _refreshTimer = null;
const _scheduleScaleRefresh = (reason, delay) => {
  if (!_phaserGame || !_phaserGame.scale) return;
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    _refreshTimer = null;
    try {
      if (_phaserGame && _phaserGame.scale) {
        _phaserGame.scale.refresh();
      }
    } catch (e) {
      console.warn('[SCALE] refresh failed:', e);
    }
  }, delay);
};

// Catch all resize triggers and schedule a refresh. Multiple refreshes
// at different delays ensure we catch the final, stable size even when
// the browser is still animating.
const _onResizeBurst = () => {
  _scheduleScaleRefresh('resize', 50);
  // Follow-up refreshes at longer delays — orientation animations can
  // take 300-500ms on some devices.
  setTimeout(() => { if (_phaserGame && _phaserGame.scale) _phaserGame.scale.refresh(); }, 250);
  setTimeout(() => { if (_phaserGame && _phaserGame.scale) _phaserGame.scale.refresh(); }, 600);
};

window.addEventListener('resize', _onResizeBurst);
window.addEventListener('orientationchange', _onResizeBurst);
if (screen.orientation) {
  screen.orientation.addEventListener('change', _onResizeBurst);
}
// visualViewport fires during pinch-zoom / browser UI show/hide on mobile
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', _onResizeBurst);
}

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
      <span>${t('pwaInstall')}</span>
      <button id="pwa-install">${t('pwaInstallBtn')}</button>
      <button id="pwa-dismiss">&times;</button>
    `,
    'ios-safari': `
      <button id="pwa-dismiss" style="position:absolute;top:6px;right:8px;">&times;</button>
      <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:#00ff88;">${t('pwaIosTitle')}</div>
      <div style="${stepStyle}">
        <span style="${numStyle}">1</span>
        <span>Tap</span> ${iosShareIcon} <span style="color:#aaa;">${t('pwaIosStep1')}</span>
      </div>
      <div style="${stepStyle}">
        <span style="${numStyle}">2</span>
        ${iosAddIcon} <strong>${t('pwaIosStep2')}</strong>
      </div>
      <div style="${stepStyle}">
        <span style="${numStyle}">3</span>
        <span>Tap</span> <strong>${t('pwaIosTapAdd')}</strong> ${arrowRight} <span style="color:#aaa;">${t('pwaIosStep3')}</span>
      </div>
    `,
    'ios-other': `
      <span>${t('pwaOpenSafari')}</span>
      <button id="pwa-dismiss">&times;</button>
    `
  };
  banner.innerHTML = messages[type] || '';

  const isIOSGuide = type === 'ios-safari';
  banner.style.cssText = `
    position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
    z-index: 10001;
    display: ${isIOSGuide ? 'block' : 'flex'}; align-items: center; gap: 12px;
    background: #111; color: #00ff88; font-family: 'Bungee', monospace; font-size: 14px;
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
