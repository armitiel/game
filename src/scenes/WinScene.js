import Phaser from 'phaser';
import { t } from '../config/i18n.js';

export default class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    // Play win sound
    this.sound.play('sfx_win', { volume: 0.5 });

    // Play outro video first, then show win screen
    this._playOutro();
  }

  _playOutro() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Create video DOM element manually for reliable playback
    const videoEl = document.createElement('video');
    videoEl.src = 'assets/sprites/outro.mp4';
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.zIndex = '9999';
    videoEl.style.backgroundColor = '#000';
    videoEl.playsInline = true;
    videoEl.muted = false;
    videoEl.autoplay = true;

    // Add to game container
    const container = this.game.canvas.parentElement || document.body;
    container.appendChild(videoEl);

    // Allow skipping with click/tap or SPACE
    const skip = () => {
      cleanup();
      this._showWinScreen();
    };

    const onEnded = () => {
      cleanup();
      this._showWinScreen();
    };

    const cleanup = () => {
      try { videoEl.pause(); } catch (e) {}
      try { container.removeChild(videoEl); } catch (e) {}
      try { this.input.keyboard.off('keydown-SPACE', skip); } catch (e) {}
      try { this.input.off('pointerdown', skip); } catch (e) {}
    };

    videoEl.addEventListener('ended', onEnded, { once: true });
    videoEl.addEventListener('error', () => {
      // If video fails to load, skip to win screen
      cleanup();
      this._showWinScreen();
    }, { once: true });

    // Try to play — handle autoplay restrictions
    const playPromise = videoEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        // Autoplay blocked — skip to win screen
        cleanup();
        this._showWinScreen();
      });
    }

    // Skip on input
    this.input.keyboard.once('keydown-SPACE', skip);
    this.input.once('pointerdown', skip);

    // Safety timeout — if video hangs, skip after 30s
    this.time.delayedCall(30000, () => {
      if (videoEl.parentElement) skip();
    });
  }

  _showWinScreen() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const gw = this.scale.width;
    const gh = this.scale.height;

    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Graffiti celebration effect
    const gfx = this.add.graphics();
    const colors = [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88];
    for (let i = 0; i < 30; i++) {
      const color = Phaser.Utils.Array.GetRandom(colors);
      gfx.fillStyle(color, Math.random() * 0.3 + 0.1);
      gfx.fillRect(
        Phaser.Math.Between(0, gw),
        Phaser.Math.Between(0, gh),
        Phaser.Math.Between(20, 80),
        Phaser.Math.Between(5, 15)
      );
    }

    // Win text — responsive sizes
    const titleSize = Math.min(96, gw * 0.18);
    const subSize = Math.min(28, gw * 0.06);
    const replaySize = Math.min(24, gw * 0.05);
    const menuSize = Math.min(20, gw * 0.04);

    this.add.text(cx, cy - 70, t('levelComplete'), {
      font: `bold ${titleSize}px Bungee, monospace`,
      fill: '#00ff88',
      stroke: '#003322',
      strokeThickness: 8
    }).setOrigin(0.5);

    this.add.text(cx, cy + 20, t('winSubtitle'), {
      font: `${subSize}px Bungee, monospace`,
      fill: '#667788',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);

    // Restart prompt
    const isMobile = this.sys.game.device.input.touch;
    const restartText = this.add.text(cx, cy + 100,
      isMobile ? t('tapReplay') : t('spaceReplay'), {
      font: `${replaySize}px Bungee, monospace`,
      fill: '#ffdd33',
      stroke: '#332200', strokeThickness: 4
    }).setOrigin(0.5);

    if (!isMobile) {
      this.add.text(cx, cy + 140, t('mainMenu'), {
        font: `${menuSize}px Bungee, monospace`,
        fill: '#556677',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);
    }

    this.tweens.add({
      targets: restartText,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1
    });

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelSelectScene');
    });

    this.input.keyboard.once('keydown-M', () => {
      this.scene.start('MenuScene');
    });

    this.input.once('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });

    // Rebuild on significant resize
    this._initW = this.scale.width;
    this._initH = this.scale.height;
    this._resizeHandler = (gs) => {
      if (!this.sys || !this.sys.isActive()) return;
      if (Math.abs(gs.width - this._initW) > 2 || Math.abs(gs.height - this._initH) > 2) {
        this.scene.restart();
      }
    };
    this.scale.on('resize', this._resizeHandler);
    this.events.once('shutdown', () => {
      try { this.scale.off('resize', this._resizeHandler); } catch (e) {}
    });
  }
}
