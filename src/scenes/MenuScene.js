import Phaser from 'phaser';
import { GAME } from '../config/gameConfig.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = this.sys.game.config.width / 2;
    const cy = this.sys.game.config.height / 2;

    // Background
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // City silhouette (simple rectangles)
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 1);
    for (let i = 0; i < 12; i++) {
      const bw = Phaser.Math.Between(40, 80);
      const bh = Phaser.Math.Between(100, 300);
      const bx = i * 70 + Phaser.Math.Between(-10, 10);
      bg.fillRect(bx, this.sys.game.config.height - bh, bw, bh);
    }

    // Logo
    const logo = this.add.image(cx, cy - 60, 'logo').setOrigin(0.5);
    // Scale logo to fit nicely (max width ~600px)
    const maxW = 600;
    if (logo.width > maxW) {
      logo.setScale(maxW / logo.width);
    }

    // Subtitle
    this.add.text(cx, cy + logo.displayHeight / 2 - 30, 'Paint the city. Stay in the shadows.', {
      font: '16px ChangaOne, monospace',
      fill: '#667788',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // Start button
    const isMobile = this.sys.game.device.input.touch;
    const startText = this.add.text(cx, cy + 100,
      isMobile ? '[ TAP TO START ]' : '[ PRESS SPACE TO START ]', {
      font: '20px ChangaOne, monospace',
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

    // Controls info
    if (isMobile) {
      this.add.text(cx, this.sys.game.config.height - 65, 'D-pad: ruch   JUMP: skok   ACT: maluj   E: interakcja', {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
    } else {
      this.add.text(cx, this.sys.game.config.height - 80, 'ARROWS: Move   SPACE: Jump   E: Paint/Pickup', {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);

      this.add.text(cx, this.sys.game.config.height - 55, 'UP/DOWN on ladder   Hide in shadows to avoid cops', {
        font: '12px ChangaOne, monospace',
        fill: '#445566',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
    }

    // Input — keyboard + touch
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('LevelSelectScene');
    });
    this.input.once('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });
  }
}
