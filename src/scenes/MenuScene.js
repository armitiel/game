import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';
import { t } from '../config/i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Start ambience — try immediately, retry on user gesture if blocked
    const snd = this.game.sound;
    // Kill any lingering bgm from GameScene so it doesn't overlap with ambience
    try {
      const staleBgms = snd.getAll ? snd.getAll('bgm') : [];
      staleBgms.forEach(s => { try { s.stop(); s.destroy(); } catch(e) {} });
    } catch(e) {}
    // Deduplicate ambience: keep at most one playing instance
    try {
      const allAmb = snd.getAll ? snd.getAll('ambience') : [];
      let keptOne = false;
      allAmb.forEach(s => {
        if (!keptOne && s.isPlaying) { keptOne = true; return; }
        try { s.stop(); s.destroy(); } catch(e) {}
      });
    } catch(e) {}
    const tryAmbience = () => {
      const existing = snd.getAll ? snd.getAll('ambience') : [];
      const anyPlaying = existing.some(s => s.isPlaying);
      if (!anyPlaying) {
        existing.forEach(s => { try { s.destroy(); } catch(e) {} });
        snd.add('ambience', { loop: true, volume: 0.15 }).play();
      }
    };
    tryAmbience();
    this.input.once('pointerdown', tryAmbience);
    this.input.keyboard.once('keydown', tryAmbience);

    // Logo sound with 1s delay
    this.time.delayedCall(1000, () => {
      this.sound.play('sfx_logo', { volume: 0.5 });
    });

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Background image stretched to fill
    const bg = this.add.image(cx, cy, 'bckg');
    bg.setDisplaySize(this.scale.width, this.scale.height);

    // Particle glow behind logo
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(16, 16, 16);
    gfx.generateTexture('_glow_particle', 32, 32);
    gfx.destroy();

    const logoY = cy - 60;
    const particles = this.add.particles(cx, logoY, '_glow_particle', {
      speed: { min: 8, max: 50 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 2000, max: 4000 },
      frequency: 40,
      quantity: 2,
      blendMode: 'ADD',
      tint: [0xff66aa, 0xff88cc, 0xffaadd, 0xffdd44, 0xffee66],
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Ellipse(0, 0, 550, 220)
      }
    });

    // Logo
    const logo = this.add.image(cx, logoY, 'logo').setOrigin(0.5);
    // Scale logo to fit nicely (max width ~600px)
    const maxW = 600;
    if (logo.width > maxW) {
      logo.setScale(maxW / logo.width);
    }

    // Start button
    const isMobile = this.sys.game.device.input.touch;
    const startText = this.add.text(cx, this.scale.height - 140,
      isMobile ? t('tapToStart') : t('spaceToStart'), {
      fontFamily: 'Bungee, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 4
    }).setOrigin(0.5);

    // Blink effect
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Last update date (bottom-left)
    const buildDate = __BUILD_DATE__ || '';
    this.add.text(16, this.scale.height - 16, buildDate ? `${t('lastUpdate')}: ${buildDate}` : '', {
      font: 'bold 18px Calibri, sans-serif',
      fill: '#778899',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0, 1).setDepth(10).setResolution(2);

    // Visitor counter (bottom-right)
    const counterText = this.add.text(this.scale.width - 16, this.scale.height - 16, '', {
      font: 'bold 18px Calibri, sans-serif',
      fill: '#556677',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(1, 1);

    // ?owner=SECRET sets localStorage flag to exclude self from counter
    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get('owner');
    if (ownerParam) {
      localStorage.setItem('st_owner', ownerParam);
    }
    const ownerSecret = localStorage.getItem('st_owner') || '';

    const headers = {};
    if (ownerSecret) headers['x-owner'] = ownerSecret;

    fetch('/api/visit', { method: 'POST', headers })
      .then(r => r.json())
      .then(data => {
        if (data.count != null) {
          counterText.setText(`${t('visitors')}: ${data.count}`);
        }
      })
      .catch(() => {});

    // Input — keyboard + touch
    // Delay pointer listener registration so that a lingering pointerdown
    // from a previous scene (e.g. tapping Home in GameScene) doesn't
    // instantly fire this handler and cascade through to LevelSelectScene.
    this.time.delayedCall(250, () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.input.keyboard.once('keydown-SPACE', () => {
        this.scene.start('LevelSelectScene');
      });
      // Use pointerup instead of pointerdown to avoid event cascades
      this.input.once('pointerup', () => {
        this.scene.start('LevelSelectScene');
      });
    });
  }
}
