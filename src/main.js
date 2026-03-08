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
