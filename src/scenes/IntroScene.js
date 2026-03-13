import Phaser from 'phaser';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' });
  }

  init(data) {
    this._levelIndex = data.levelIndex ?? 0;
    this._done = false;
  }

  create() {
    const canvas = this.sys.game.canvas;
    const parent = canvas.parentElement || document.body;

    // Overlay container — fixed so it covers the full viewport without affecting canvas layout
    this._container = document.createElement('div');
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
    this._skipHint.textContent = '[ SPACJA / TAP — POMIŃ ]';
    this._skipHint.style.cssText = `
      position: absolute;
      bottom: 18px; right: 20px;
      color: rgba(255,255,255,0.5);
      font-family: ChangaOne, monospace;
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
    this.input.on('pointerdown', () => this._goToGame());
  }

  _goToGame() {
    if (this._done) return;
    this._done = true;
    this._cleanup();
    this.scene.start('GameScene', { levelIndex: this._levelIndex });
  }

  _cleanup() {
    if (this._video) {
      this._video.pause();
      this._video.src = '';
    }
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._video = null;
    this._container = null;
    this._skipHint = null;
  }

  shutdown() {
    this._cleanup();
  }
}
