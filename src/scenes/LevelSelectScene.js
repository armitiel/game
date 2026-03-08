import Phaser from 'phaser';
import { LEVELS } from '../config/levels.js';

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create() {
    const cx = this.sys.game.config.width / 2;

    this.cameras.main.setBackgroundColor('#0a0a1a');

    // City silhouette background
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 1);
    for (let i = 0; i < 12; i++) {
      const bw = Phaser.Math.Between(40, 80);
      const bh = Phaser.Math.Between(100, 300);
      const bx = i * 70 + Phaser.Math.Between(-10, 10);
      bg.fillRect(bx, this.sys.game.config.height - bh, bw, bh);
    }

    // Title
    this.add.text(cx, 60, 'WYBIERZ LEVEL', {
      font: 'bold 28px monospace',
      fill: '#00ff88'
    }).setOrigin(0.5);

    // Level cards
    const cardW = 220;
    const cardH = 260;
    const gap = 40;
    const totalW = LEVELS.length * cardW + (LEVELS.length - 1) * gap;
    const startX = cx - totalW / 2 + cardW / 2;
    const cardY = this.sys.game.config.height / 2 - 10;

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      const x = startX + i * (cardW + gap);

      // Card background
      const card = this.add.rectangle(x, cardY, cardW, cardH, 0x1a1a3a, 0.9)
        .setStrokeStyle(2, 0x334466)
        .setInteractive({ useHandCursor: true });

      // Level number
      this.add.text(x, cardY - 80, String(i + 1), {
        font: 'bold 48px monospace',
        fill: '#334466'
      }).setOrigin(0.5);

      // Level name
      this.add.text(x, cardY - 20, level.name, {
        font: 'bold 18px monospace',
        fill: '#00ff88'
      }).setOrigin(0.5);

      // Description
      this.add.text(x, cardY + 20, level.description, {
        font: '11px monospace',
        fill: '#667788',
        wordWrap: { width: cardW - 20 },
        align: 'center'
      }).setOrigin(0.5);

      // Stats
      const spots = level.paintSpots ? level.paintSpots.length : 0;
      const cops = level.cops ? level.cops.length : 0;
      this.add.text(x, cardY + 65, `Murale: ${spots}   Cops: ${cops}`, {
        font: '10px monospace',
        fill: '#556677'
      }).setOrigin(0.5);

      // Lock indicator for future levels (level 2 is playable but placeholder)
      if (i >= 2) {
        card.setAlpha(0.4);
        this.add.text(x, cardY + 100, 'WKROTCE', {
          font: 'bold 12px monospace',
          fill: '#ff6666'
        }).setOrigin(0.5);
      }

      // Hover effects
      card.on('pointerover', () => {
        card.setStrokeStyle(2, 0x00ff88);
      });
      card.on('pointerout', () => {
        card.setStrokeStyle(2, 0x334466);
      });

      // Click to start level
      if (i < LEVELS.length) {
        card.on('pointerdown', () => {
          this.scene.start('GameScene', { levelIndex: i });
        });
      }

      // Keyboard shortcuts (1, 2, ...)
      this.input.keyboard.on(`keydown-${i + 1}`, () => {
        if (i < LEVELS.length) {
          this.scene.start('GameScene', { levelIndex: i });
        }
      });
    }

    // Back hint
    this.add.text(cx, this.sys.game.config.height - 40, '[ Kliknij level lub nacisnij 1-2 ]', {
      font: '12px monospace',
      fill: '#445566'
    }).setOrigin(0.5);

    // ESC to go back to menu
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }
}
