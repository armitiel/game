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
      fontFamily: 'ChangaOne',
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
      ...titleStyle, color: '#00ff88', stroke: '#003322', strokeThickness: 7
    }).setOrigin(0.5);

    const modes = [
      {
        key: 'stealth', name: t('stealthName'),
        desc: t('stealthDesc'),
        icon: '\u{1F3AD}', color: 0x3366ff,
        levels: this.getLevelsForMode('stealth')
      },
      {
        key: 'puzzle', name: t('puzzleName'),
        desc: t('puzzleDesc'),
        icon: '\u{1F9E9}', color: 0xff9933,
        levels: this.getLevelsForMode('puzzle')
      },
      {
        key: 'tower', name: t('towerName'),
        desc: t('towerDesc'),
        icon: '\u{1F3D7}', color: 0xff3366,
        levels: this.getLevelsForMode('tower')
      }
    ];

    const frameW = 280;
    const frameH = frameW * (1024 / 512); // preserve 1:2 aspect ratio
    const gap = 5;
    const totalW = modes.length * frameW + (modes.length - 1) * gap;
    const startX = cx - totalW / 2 + frameW / 2;
    const cardY = gh / 2 + 20;

    modes.forEach((m, i) => {
      const x = startX + i * (frameW + gap);
      // Nudge side card text inward so it fits inside frames
      const textInset = i === 0 ? 22 : i === 2 ? -22 : 0;
      const tx = x + textInset;

      // Frame image from spritesheet (blue=0, orange=1, pink=2)
      const frame = this.add.image(x, cardY, 'mode_frames', i)
        .setDisplaySize(frameW, frameH);

      // Invisible hitbox for interaction
      const card = this.add.rectangle(x, cardY, frameW * 0.8, frameH * 0.8, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      // Name with 3D depth effect
      const nameY = cardY - frameH * 0.14;
      const nameHex = '#' + m.color.toString(16).padStart(6, '0');
      const nameStyle = {
        fontFamily: 'ChangaOne', fontSize: '40px', fontStyle: 'bold',
      };
      // 3D shadow layers
      for (let d = 3; d >= 1; d--) {
        this.add.text(tx, nameY + d * 2, m.name, {
          ...nameStyle, color: '#111111', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setAlpha(0.5);
      }
      this.add.text(tx, nameY, m.name, {
        ...nameStyle, color: nameHex, stroke: '#000000', strokeThickness: 5
      }).setOrigin(0.5);

      // Description — readable sans-serif font
      this.add.text(tx, cardY - frameH * 0.01, m.desc, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
        align: 'center', lineSpacing: 6
      }).setOrigin(0.5);

      // Level count — below frame
      this.add.text(tx, cardY + frameH * 0.24, `${t('levelCount')}: ${m.levels.length}`, {
        fontFamily: 'ChangaOne',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#aabbcc',
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);

      // Hover — scale frame up slightly
      const baseScale = frameW / 512;
      card.on('pointerover', () => frame.setScale(baseScale * 1.05));
      card.on('pointerout', () => frame.setScale(baseScale));

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
        fontFamily: 'ChangaOne', fontSize: '18px', fontStyle: 'bold',
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

    this.add.text(cx, gh - 40, t('modeSelectHint'), {
      font: '12px ChangaOne, monospace', fill: '#445566',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
  }

  // === LEVEL CARDS FOR SELECTED MODE ===

  showLevelCards(cx, gh, modeKey) {
    const levels = this.getLevelsForMode(modeKey);
    const modeNames = { stealth: t('stealthName'), puzzle: t('puzzleName'), tower: t('towerName') };

    // Mode title with 3D depth effect (matches mode select screen)
    const titleText = modeNames[modeKey] || modeKey.toUpperCase();
    const titleY = 40;
    const titleStyle = {
      fontFamily: 'ChangaOne',
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

    // Subtitle (instruction)
    const subtitleY = titleY + 50;
    this.add.text(cx, subtitleY, t('chooseLevel'), {
      font: 'bold 24px ChangaOne, monospace',
      fill: '#00ff88',
      stroke: '#003322',
      strokeThickness: 4
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
        fontFamily: 'ChangaOne',
        fontSize: '36px',
        fontStyle: 'bold',
        color: useFrame ? '#a6ffef' : '#00ff88',
        stroke: '#003322',
        strokeThickness: 5,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 6, stroke: true, fill: true }
      };
      this.add.text(x, cardY - 40, level.name, nameStyle).setOrigin(0.5);

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
      this.add.text(x, cardY + 40, level.description, descStyle).setOrigin(0.5);

      card.on('pointerdown', () => {
        this.scene.start('IntroScene', { levelIndex: globalIdx });
      });

      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        this.scene.start('IntroScene', { levelIndex: globalIdx });
      });
    }

    this.add.text(cx, gh - 40, t('levelSelectHint'), {
      font: '12px ChangaOne, monospace', fill: '#445566',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
  }
}
