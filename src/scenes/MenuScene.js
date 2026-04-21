import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';
import { t } from '../config/i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Belt-and-suspenders: remove any leaked intro overlay
    try {
      document.querySelectorAll('div[data-intro-overlay]').forEach(el => {
        try { el.remove(); } catch (e) {}
      });
    } catch (e) {}

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

    const gw = this.scale.width;
    const gh = this.scale.height;
    const cx = gw / 2;
    const cy = gh / 2;
    // Responsive scale factor — design base is 1280×720
    const ss = Math.min(gw / 1280, gh / 720);

    // Background image stretched to fill
    const bg = this.add.image(cx, cy, 'bckg');
    bg.setDisplaySize(gw, gh);

    // Particle glow behind logo
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(16, 16, 16);
    gfx.generateTexture('_glow_particle', 32, 32);
    gfx.destroy();

    const logoY = cy - Math.round(60 * ss);
    const particles = this.add.particles(cx, logoY, '_glow_particle', {
      speed: { min: 8 * ss, max: 50 * ss },
      scale: { start: 1.2 * ss, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 2000, max: 4000 },
      frequency: 40,
      quantity: 2,
      blendMode: 'ADD',
      tint: [0xff66aa, 0xff88cc, 0xffaadd, 0xffdd44, 0xffee66],
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Ellipse(0, 0, Math.round(550 * ss), Math.round(220 * ss))
      }
    });

    // Logo — snap scale to nearest clean 1/4 step (0.25/0.5/0.75/1.0) so the
    // 1200px-wide source samples without sub-pixel blur. Target ~75% of screen
    // width → at design res (1280) picks 0.75× = 900 px wide logo.
    const logo = this.add.image(cx, logoY, 'logo').setOrigin(0.5);
    const maxLogoW = Math.min(gw * 0.75, 900 * ss);
    const SNAP = 0.25;
    const rawScale = maxLogoW / logo.width;
    const cleanScale = Math.max(SNAP, Math.floor(rawScale / SNAP) * SNAP);
    logo.setScale(cleanScale);

    // Start button
    const isMobile = this.sys.game.device.input.touch;
    const startFontSize = Math.round(24 * ss);
    const startText = this.add.text(cx, gh - Math.round(140 * ss),
      isMobile ? t('tapToStart') : t('spaceToStart'), {
      fontFamily: 'Bungee, monospace',
      fontSize: `${startFontSize}px`,
      fontStyle: 'bold',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: Math.round(4 * ss)
    }).setOrigin(0.5).setResolution(2);

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
    const smallFont = Math.max(12, Math.round(18 * ss));
    this.add.text(Math.round(16 * ss), gh - Math.round(16 * ss),
      buildDate ? `${t('lastUpdate')}: ${buildDate}` : '', {
      font: `bold ${smallFont}px Calibri, sans-serif`,
      fill: '#778899',
      stroke: '#000000', strokeThickness: Math.round(3 * ss)
    }).setOrigin(0, 1).setDepth(10).setResolution(2);

    // Visitor counter (bottom-right)
    const counterText = this.add.text(gw - Math.round(16 * ss), gh - Math.round(16 * ss), '', {
      font: `bold ${smallFont}px Calibri, sans-serif`,
      fill: '#556677',
      stroke: '#000000', strokeThickness: Math.round(3 * ss)
    }).setOrigin(1, 1).setResolution(2);

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
    // To prevent cascades from a prior scene's pointer event (e.g. tapping
    // Home in GameScene and HOLDING the finger down), we require a FRESH
    // pointerdown → pointerup pair: the user must fully release and press
    // again before anything navigates. A simple delay is not enough because
    // a slow tap can outlast it.
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelSelectScene');
    });
    this.time.delayedCall(150, () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.input.once('pointerdown', () => {
        if (!this.sys || !this.sys.isActive()) return;
        this.input.once('pointerup', () => {
          if (!this.sys || !this.sys.isActive()) return;
          this.scene.start('LevelSelectScene');
        });
      });
    });

    // Rebuild on significant resize so the background + centred text
    // re-fit when the URL bar hides, orientation flips, or fullscreen
    // changes the viewport after create() ran.
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
