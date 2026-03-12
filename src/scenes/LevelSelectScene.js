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

    this.cameras.main.setBackgroundColor('#0a0a1a');

    // City silhouette background
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 1);
    for (let i = 0; i < 16; i++) {
      const bw = Phaser.Math.Between(40, 80);
      const bh = Phaser.Math.Between(100, 300);
      const bx = i * 70 + Phaser.Math.Between(-10, 10);
      bg.fillRect(bx, gh - bh, bw, bh);
    }

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
    this.add.text(cx, 50, 'WYBIERZ TRYB', {
      font: 'bold 28px ChangaOne, monospace', fill: '#00ff88',
      stroke: '#003322', strokeThickness: 4
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

    const cardW = 260;
    const cardH = 300;
    const gap = 40;
    const totalW = modes.length * cardW + (modes.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = gh / 2 - 10;

    modes.forEach((m, i) => {
      const x = startX + i * (cardW + gap);

      // Card bg
      const card = this.add.rectangle(x, cardY, cardW, cardH, 0x1a1a3a, 0.9)
        .setStrokeStyle(2, m.color, 0.6)
        .setInteractive({ useHandCursor: true });

      // Icon
      this.add.text(x, cardY - 90, m.icon, {
        font: '48px sans-serif'
      }).setOrigin(0.5);

      // Name
      this.add.text(x, cardY - 20, m.name, {
        font: 'bold 22px ChangaOne, monospace', fill: '#' + m.color.toString(16).padStart(6, '0'),
        stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5);

      // Description
      this.add.text(x, cardY + 30, m.desc, {
        font: '12px ChangaOne, monospace', fill: '#889999',
        stroke: '#000000', strokeThickness: 2,
        align: 'center', lineSpacing: 4
      }).setOrigin(0.5);

      // Level count
      this.add.text(x, cardY + 85, `Levele: ${m.levels.length}`, {
        font: '10px ChangaOne, monospace', fill: '#556677',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      // Hover
      card.on('pointerover', () => card.setStrokeStyle(3, 0x00ff88));
      card.on('pointerout', () => card.setStrokeStyle(2, m.color, 0.6));

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
