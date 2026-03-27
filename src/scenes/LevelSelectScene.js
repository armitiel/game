import Phaser from 'phaser';
import { LEVELS, STEALTH_LEVELS, PUZZLE_LEVELS, TOWER_LEVELS, LEVEL_TUTORIAL } from '../config/levels.js';
import { t } from '../config/i18n.js';

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data) {
    this._selectedMode = (data && data.mode) || null;
  }

  create() {
    const cx = this.scale.width / 2;
    const gh = this.scale.height;

    // Background image stretched to fill
    const bg = this.add.image(cx, gh / 2, 'bckg');
    bg.setDisplaySize(this.scale.width, gh);

    if (!this._selectedMode) {
      this.showModeSelect(cx, gh);
    } else {
      this.showLevelCards(cx, gh, this._selectedMode);
    }

    // ESC to go back
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._selectedMode) {
        this.scene.restart({ mode: null });
      } else {
        this.scene.start('MenuScene');
      }
    });
  }

  // === MODE SELECT SCREEN ===

  getLevelsForMode(modeKey) {
    if (modeKey === 'stealth') return STEALTH_LEVELS;
    if (modeKey === 'puzzle') return PUZZLE_LEVELS;
    if (modeKey === 'tower') return TOWER_LEVELS;
    return LEVELS.filter(l => (l.mode || 'stealth') === modeKey);
  }

  showModeSelect(cx, gh) {
    // Title with 3D depth effect
    const titleY = 60;
    const titleStyle = {
      fontFamily: 'Bungee',
      fontSize: '58px',
      fontStyle: 'bold',
    };
    // 3D layers (bottom to top)
    for (let d = 4; d >= 1; d--) {
      this.add.text(cx, titleY + d * 2, t('chooseMode'), {
        ...titleStyle, color: '#003311', stroke: '#001a08', strokeThickness: 7
      }).setOrigin(0.5).setAlpha(0.6);
    }
    this.add.text(cx, titleY, t('chooseMode'), {
      ...titleStyle, color: '#ffffff', stroke: '#003322', strokeThickness: 7,
      shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 12, fill: true, stroke: true }
    }).setOrigin(0.5).setTint(0x66ffcc, 0x66ffcc, 0x00aa44, 0x00aa44);

    const modes = [
      {
        key: 'stealth', name: t('stealthName'),
        desc: t('stealthDesc'),
        frame: 'frame_s1', fillColor: '#4488ff', strokeColor: '#1a3399', tintTop: 0xaaccff, tintBot: 0x2255cc,
        levels: this.getLevelsForMode('stealth')
      },
      {
        key: 'puzzle', name: t('puzzleName'),
        desc: t('puzzleDesc'),
        frame: 'frame_s2', fillColor: '#ffaa33', strokeColor: '#994400', tintTop: 0xffdd88, tintBot: 0xcc7700,
        levels: this.getLevelsForMode('puzzle')
      },
      {
        key: 'tower', name: t('towerName'),
        desc: t('towerDesc'),
        frame: 'frame_s3', fillColor: '#ee55aa', strokeColor: '#881144', tintTop: 0xffaadd, tintBot: 0xbb2266,
        levels: this.getLevelsForMode('tower')
      }
    ];

    const frameW = 336;
    const frameH = 336;
    const gap = 14;
    const totalW = modes.length * frameW + (modes.length - 1) * gap;
    const startX = cx - totalW / 2 + frameW / 2;
    const cardY = gh / 2 + 20;

    // Glow particle texture (reuse if MenuScene already made it)
    if (!this.textures.exists('_glow_particle')) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(0xffffff);
      gfx.fillCircle(16, 16, 16);
      gfx.generateTexture('_glow_particle', 32, 32);
      gfx.destroy();
    }

    // Background glow particles
    this.add.particles(cx, cardY, '_glow_particle', {
      speed: { min: 5, max: 30 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 2000, max: 5000 },
      frequency: 80,
      quantity: 1,
      blendMode: 'ADD',
      tint: [0x3366ff, 0x4488ff, 0xff9933, 0xffaa44, 0xff3366, 0xee55aa],
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Rectangle(-totalW / 2 - 20, -frameH / 2 - 20, totalW + 40, frameH + 40)
      }
    }).setDepth(0);

    modes.forEach((m, i) => {
      const x = startX + i * (frameW + gap);

      // Drop shadow behind card
      this.add.image(x + 6, cardY + 6, m.frame).setDisplaySize(frameW, frameH).setTint(0x000000).setAlpha(0.35);

      // Frame image scaled to card size (linear filter for smooth gradients)
      this.textures.get(m.frame).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.add.image(x, cardY, m.frame).setDisplaySize(frameW, frameH);

      // Invisible hitbox for interaction
      const card = this.add.rectangle(x, cardY, frameW, frameH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      // Mode name — big bold white with dark stroke, italic style
      const nameY = cardY - frameH / 2 + frameH * 0.24;
      const nameStyle = {
        fontFamily: 'Bungee', fontSize: '44px', fontStyle: 'bold',
      };
      // 3D shadow layers
      for (let d = 4; d >= 1; d--) {
        this.add.text(x, nameY + d * 2, m.name, {
          ...nameStyle, color: m.strokeColor, stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0.45);
      }
      this.add.text(x, nameY, m.name, {
        ...nameStyle, color: '#ffffff', stroke: m.strokeColor, strokeThickness: 6,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 10, fill: true, stroke: true }
      }).setOrigin(0.5).setTint(m.tintTop, m.tintTop, m.tintBot, m.tintBot);

      // Description — white text with dark stroke for readability
      const descY = cardY + frameH * 0.15;
      this.add.text(x, descY, m.desc, {
        fontFamily: 'Calibri, Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000', strokeThickness: 1.5,
        align: 'center', lineSpacing: 8,
        wordWrap: { width: frameW - 50 }
      }).setOrigin(0.5);

      // Click
      card.on('pointerdown', () => {
        if (m.levels.length === 1) {
          // Only 1 level — go straight to game
          const idx = LEVELS.indexOf(m.levels[0]);
          this.scene.start('IntroScene', { levelIndex: idx });
        } else {
          this.scene.restart({ mode: m.key });
        }
      });

      // Keyboard shortcut
      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        if (m.levels.length === 1) {
          const idx = LEVELS.indexOf(m.levels[0]);
          this.scene.start('IntroScene', { levelIndex: idx });
        } else {
          this.scene.restart({ mode: m.key });
        }
      });
    });

    // Tutorial button — small link at bottom
    const tutIdx = LEVELS.indexOf(LEVEL_TUTORIAL);
    if (tutIdx >= 0) {
      const tutBtn = this.add.text(cx, gh - 70, t('tutorial'), {
        fontFamily: 'Bungee', fontSize: '28px', fontStyle: 'bold',
        color: '#88aacc', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      tutBtn.on('pointerover', () => tutBtn.setStyle({ color: '#00ff88' }));
      tutBtn.on('pointerout', () => tutBtn.setStyle({ color: '#88aacc' }));
      tutBtn.on('pointerdown', () => {
        this.scene.start('GameScene', { levelIndex: tutIdx });
      });

      // T key shortcut
      this.input.keyboard.on('keydown-T', () => {
        this.scene.start('GameScene', { levelIndex: tutIdx });
      });
    }

  }

  // === LEVEL CARDS FOR SELECTED MODE ===

  showLevelCards(cx, gh, modeKey) {
    const levels = this.getLevelsForMode(modeKey);
    const modeNames = { stealth: t('stealthName'), puzzle: t('puzzleName'), tower: t('towerName') };

    // Mode title with 3D depth effect (matches mode select screen)
    const titleText = modeNames[modeKey] || modeKey.toUpperCase();
    const titleY = 70;
    const titleStyle = {
      fontFamily: 'Bungee',
      fontSize: '48px',
      fontStyle: 'bold'
    };
    for (let d = 4; d >= 1; d--) {
      this.add.text(cx, titleY + d * 2, titleText, {
        ...titleStyle,
        color: '#003311',
        stroke: '#001a08',
        strokeThickness: 7
      }).setOrigin(0.5).setAlpha(0.6);
    }
    this.add.text(cx, titleY, titleText, {
      ...titleStyle,
      color: '#00ff88',
      stroke: '#003322',
      strokeThickness: 7
    }).setOrigin(0.5);

    const cardW = 220;
    const cardH = 260;
    const gap = 40;
    const totalW = levels.length * cardW + (levels.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = gh / 2;

    const useFrame = (modeKey === 'stealth');

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const globalIdx = LEVELS.indexOf(level);
      const x = startX + i * (cardW + gap);

      // Stealth levels get a decorative frame background (frame.png)
      if (useFrame) {
        this.add.image(x, cardY, 'frame')
          .setDisplaySize(cardW + 24, cardH + 24)
          .setOrigin(0.5)
          .setDepth(0)
          .setAlpha(0.95);
      }

      // Invisible hitbox for interaction (no visible rectangle)
      const card = this.add.rectangle(x, cardY, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      // Level name
      const nameStyle = {
        fontFamily: 'Bungee',
        fontSize: '36px',
        fontStyle: 'bold',
        color: useFrame ? '#a6ffef' : '#00ff88',
        stroke: '#003322',
        strokeThickness: 5,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 6, stroke: true, fill: true }
      };
      this.add.text(x, cardY - 40, t(level.name), nameStyle).setOrigin(0.5);

      // Level description — readable sans-serif font (same as mode select)
      const descStyle = {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        wordWrap: { width: cardW - 20 },
        align: 'center',
        lineSpacing: 6
      };
      this.add.text(x, cardY + 40, t(level.description), descStyle).setOrigin(0.5);

      card.on('pointerdown', () => {
        this.scene.start('IntroScene', { levelIndex: globalIdx });
      });

      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        this.scene.start('IntroScene', { levelIndex: globalIdx });
      });
    }

  }

  /**
   * Build a 9-slice panel from a single frame texture, sliced at runtime via canvas.
   * Corners stay fixed, edges and center stretch to fill target size.
   * Source images are 377×403; slice insets: 80px each side.
   */
  _buildNineSlice(textureKey, px, py, w, h) {
    const src = this.textures.get(textureKey).getSourceImage();
    const sw = src.width;   // 377
    const sh = src.height;  // 403
    const inset = 110;      // px from each edge — must cover full rounded corner + shadow

    // Slice regions: [srcX, srcY, srcW, srcH]
    const slices = [
      // top row
      [0, 0, inset, inset],                           // TL
      [inset, 0, sw - inset * 2, inset],               // T
      [sw - inset, 0, inset, inset],                   // TR
      // middle row
      [0, inset, inset, sh - inset * 2],               // CL
      [inset, inset, sw - inset * 2, sh - inset * 2],  // C
      [sw - inset, inset, inset, sh - inset * 2],      // CR
      // bottom row
      [0, sh - inset, inset, inset],                   // BL
      [inset, sh - inset, sw - inset * 2, inset],      // BR
      [sw - inset, sh - inset, inset, inset],          // BR corner
    ];

    // Generate sub-textures if not cached
    const prefix = `${textureKey}_9s_`;
    if (!this.textures.exists(`${prefix}0`)) {
      slices.forEach((s, idx) => {
        const canvas = document.createElement('canvas');
        canvas.width = s[2];
        canvas.height = s[3];
        canvas.getContext('2d').drawImage(src, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]);
        this.textures.addCanvas(`${prefix}${idx}`, canvas);
      });
    }

    // Destination sizes — corners stay at inset size, mid stretches
    const cw = inset;                // corner width
    const ch = inset;                // corner height
    const midW = w - cw * 2;        // stretched middle width
    const midH = h - ch * 2;        // stretched middle height

    const place = (idx, dx, dy, dw, dh) => {
      this.add.image(dx, dy, `${prefix}${idx}`).setOrigin(0, 0).setDisplaySize(dw, dh);
    };

    // Top row
    place(0, px, py, cw, ch);
    place(1, px + cw, py, midW, ch);
    place(2, px + cw + midW, py, cw, ch);
    // Middle row
    place(3, px, py + ch, cw, midH);
    place(4, px + cw, py + ch, midW, midH);
    place(5, px + cw + midW, py + ch, cw, midH);
    // Bottom row
    place(6, px, py + ch + midH, cw, ch);
    place(7, px + cw, py + ch + midH, midW, ch);
    place(8, px + cw + midW, py + ch + midH, cw, ch);
  }
}
