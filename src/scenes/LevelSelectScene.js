import Phaser from 'phaser';
import { LEVELS, STEALTH_LEVELS, PUZZLE_LEVELS, TOWER_LEVELS } from '../config/levels.js';

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data) {
    this._selectedMode = (data && data.mode) || null;
  }

  create() {
    const cx = this.sys.game.config.width / 2;
    const gh = this.sys.game.config.height;

    // Background image stretched to fill
    const bg = this.add.image(cx, gh / 2, 'bckg');
    bg.setDisplaySize(this.sys.game.config.width, gh);

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

  showModeSelect(cx, gh) {
    this.add.text(cx, 60, 'WYBIERZ TRYB', {
      fontFamily: 'ChangaOne',
      fontSize: '58px',
      fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#003322', strokeThickness: 7
    }).setOrigin(0.5);

    const modes = [
      {
        key: 'stealth', name: 'STEALTH',
        desc: 'Uciekaj przed policja\ni maluj murale w cieniu',
        icon: '\u{1F3AD}', color: 0x3366ff, levels: STEALTH_LEVELS
      },
      {
        key: 'puzzle', name: 'PUZZLE',
        desc: 'Uzyj drabin i koszy\nby dotrzec do murali',
        icon: '\u{1F9E9}', color: 0xff9933, levels: PUZZLE_LEVELS
      },
      {
        key: 'tower', name: 'WIEZA',
        desc: 'Wspinaj sie w gore\nczas ucieka!',
        icon: '\u{1F3D7}', color: 0xff3366, levels: TOWER_LEVELS
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

      // Frame image from spritesheet (blue=0, orange=1, pink=2)
      const frame = this.add.image(x, cardY, 'mode_frames', i)
        .setDisplaySize(frameW, frameH);

      // Invisible hitbox for interaction
      const card = this.add.rectangle(x, cardY, frameW * 0.8, frameH * 0.8, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      // Icon
      this.add.text(x, cardY - frameH * 0.28, m.icon, {
        font: '48px sans-serif'
      }).setOrigin(0.5);

      // Name
      this.add.text(x, cardY - frameH * 0.05, m.name, {
        fontFamily: 'ChangaOne',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#' + m.color.toString(16).padStart(6, '0'),
        stroke: '#000000', strokeThickness: 5
      }).setOrigin(0.5);

      // Description
      this.add.text(x, cardY + frameH * 0.07, m.desc, {
        fontFamily: 'ChangaOne',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
        align: 'center', lineSpacing: 6
      }).setOrigin(0.5);

      // Level count
      this.add.text(x, cardY + frameH * 0.22, `Level: ${m.levels.length}`, {
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
          this.scene.start('GameScene', { levelIndex: idx });
        } else {
          this.scene.restart({ mode: m.key });
        }
      });

      // Keyboard shortcut
      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        if (m.levels.length === 1) {
          const idx = LEVELS.indexOf(m.levels[0]);
          this.scene.start('GameScene', { levelIndex: idx });
        } else {
          this.scene.restart({ mode: m.key });
        }
      });
    });

    this.add.text(cx, gh - 40, '[ Kliknij tryb lub nacisnij 1-3 | ESC = menu ]', {
      font: '12px ChangaOne, monospace', fill: '#445566',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
  }

  // === LEVEL CARDS FOR SELECTED MODE ===

  showLevelCards(cx, gh, modeKey) {
    const modeMap = { stealth: STEALTH_LEVELS, puzzle: PUZZLE_LEVELS, tower: TOWER_LEVELS };
    const levels = modeMap[modeKey] || [];
    const modeNames = { stealth: 'STEALTH', puzzle: 'PUZZLE', tower: 'WIEZA' };

    this.add.text(cx, 40, modeNames[modeKey] || modeKey.toUpperCase(), {
      font: 'bold 20px ChangaOne, monospace', fill: '#667788',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    this.add.text(cx, 70, 'WYBIERZ LEVEL', {
      font: 'bold 24px ChangaOne, monospace', fill: '#00ff88',
      stroke: '#003322', strokeThickness: 4
    }).setOrigin(0.5);

    const cardW = 220;
    const cardH = 260;
    const gap = 40;
    const totalW = levels.length * cardW + (levels.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = gh / 2;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const globalIdx = LEVELS.indexOf(level);
      const x = startX + i * (cardW + gap);

      const card = this.add.rectangle(x, cardY, cardW, cardH, 0x1a1a3a, 0.9)
        .setStrokeStyle(2, 0x334466)
        .setInteractive({ useHandCursor: true });

      this.add.text(x, cardY - 80, String(i + 1), {
        font: 'bold 48px ChangaOne, monospace', fill: '#334466',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5);

      this.add.text(x, cardY - 20, level.name, {
        font: 'bold 18px ChangaOne, monospace', fill: '#00ff88',
        stroke: '#003322', strokeThickness: 3
      }).setOrigin(0.5);

      this.add.text(x, cardY + 20, level.description, {
        font: '11px ChangaOne, monospace', fill: '#667788',
        stroke: '#000000', strokeThickness: 2,
        wordWrap: { width: cardW - 20 }, align: 'center'
      }).setOrigin(0.5);

      const spots = level.paintSpots ? level.paintSpots.length : 0;
      const cops = level.cops ? level.cops.length : 0;
      let statsStr = `Murale: ${spots}`;
      if (modeKey === 'stealth') statsStr += `   Cops: ${cops}`;
      if (modeKey === 'tower' && level.timer) statsStr += `   Czas: ${level.timer.startSeconds}s`;

      this.add.text(x, cardY + 65, statsStr, {
        font: '10px ChangaOne, monospace', fill: '#556677',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      card.on('pointerover', () => card.setStrokeStyle(2, 0x00ff88));
      card.on('pointerout', () => card.setStrokeStyle(2, 0x334466));

      card.on('pointerdown', () => {
        this.scene.start('GameScene', { levelIndex: globalIdx });
      });

      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        this.scene.start('GameScene', { levelIndex: globalIdx });
      });
    }

    this.add.text(cx, gh - 40, '[ Kliknij level | ESC = tryby ]', {
      font: '12px ChangaOne, monospace', fill: '#445566',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
  }
}
