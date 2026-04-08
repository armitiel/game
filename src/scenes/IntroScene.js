import Phaser from 'phaser';
import { t } from '../config/i18n.js';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' });
  }

  init(data) {
    this._levelIndex = data.levelIndex ?? 0;
    this._done = false;
  }

  create() {
    // Belt-and-suspenders: remove any leaked overlay from a previous run
    document.querySelectorAll('div[data-intro-overlay]').forEach(el => {
      try { el.remove(); } catch (e) {}
    });

    const canvas = this.sys.game.canvas;
    const parent = canvas.parentElement || document.body;

    // Overlay container — fixed so it covers the full viewport without affecting canvas layout
    this._container = document.createElement('div');
    this._container.setAttribute('data-intro-overlay', '1');
    this._container.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 9999;
      background: #000;
    `;

    this._video = document.createElement('video');
    this._video.src = '/assets/sprites/intro.mp4';
    this._video.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain;
    `;
    this._video.playsInline = true;
    this._video.muted = false;

    this._skipHint = document.createElement('div');
    this._skipHint.textContent = t('skipHint');
    this._skipHint.style.cssText = `
      position: absolute;
      bottom: 18px; right: 20px;
      color: rgba(255,255,255,0.5);
      font-family: Calibri, sans-serif;
      font-weight: bold;
      font-size: 15px;
      pointer-events: none;
      text-shadow: 0 0 6px #000;
    `;

    this._container.appendChild(this._video);
    this._container.appendChild(this._skipHint);
    document.body.appendChild(this._container);

    // Play — if autoplay blocked, try muted, then skip straight to game
    this._video.play().catch(() => {
      this._video.muted = true;
      this._video.play().catch(() => this._goToGame());
    });

    this._video.addEventListener('ended', () => this._goToGame());

    // Skip inputs
    this.input.keyboard.on('keydown-SPACE', () => this._goToGame());
    this.input.keyboard.on('keydown-ENTER', () => this._goToGame());
    this.input.keyboard.on('keydown-ESC', () => this._goToGame());
    // Click/tap on the HTML overlay (Phaser pointerdown won't fire — overlay covers canvas).
    // Stop propagation so the touch sequence does not leak onto the canvas
    // of the next scene and trigger an unintended pointerdown/pointerup.
    this._onOverlayTap = (ev) => {
      try { ev.preventDefault(); } catch (e) {}
      try { ev.stopPropagation(); } catch (e) {}
      this._goToGame();
    };
    this._container.addEventListener('click', this._onOverlayTap);
    this._container.addEventListener('touchstart', this._onOverlayTap, { passive: false });
    this._container.addEventListener('touchend', (ev) => {
      try { ev.preventDefault(); } catch (e) {}
      try { ev.stopPropagation(); } catch (e) {}
    }, { passive: false });
  }

  _goToGame() {
    if (this._done) return;
    this._done = true;
    // IMMEDIATELY hide the overlay so even if DOM removal is delayed a frame,
    // nothing is blocking the canvas. Also neutralise pointer events.
    if (this._container) {
      try {
        this._container.style.display = 'none';
        this._container.style.pointerEvents = 'none';
        this._container.style.zIndex = '-1';
      } catch (e) {}
    }
    this._cleanup();
    // Defer the scene.start by one frame so the current touch/click
    // event fully propagates out of this handler before Phaser boots
    // GameScene. Without this delay a fast tap could end with touchend
    // firing on the freshly-started GameScene and desync its input.
    const go = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.scene.start('GameScene', { levelIndex: this._levelIndex });
    };
    try {
      this.time.delayedCall(16, go);
    } catch (e) {
      go();
    }
  }

  _cleanup() {
    if (this._video) {
      try { this._video.pause(); } catch (e) {}
      try { this._video.removeAttribute('src'); } catch (e) {}
      try { this._video.load(); } catch (e) {}
    }
    if (this._container && this._container.parentNode) {
      try { this._container.parentNode.removeChild(this._container); } catch (e) {}
    }
    // Belt-and-suspenders: remove any other lingering overlays in the DOM
    document.querySelectorAll('div[data-intro-overlay]').forEach(el => {
      try { el.remove(); } catch (e) {}
    });
    this._video = null;
    this._container = null;
    this._skipHint = null;
  }

  shutdown() {
    this._cleanup();
  }
}
