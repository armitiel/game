import Phaser from 'phaser';
import { t } from '../config/i18n.js';

export default class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  create() {
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

    // Win text
    this.add.text(cx, cy - 60, t('levelComplete'), {
      font: 'bold 48px Bungee, monospace',
      fill: '#00ff88',
      stroke: '#003322',
      strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, t('winSubtitle'), {
      font: '18px Bungee, monospace',
      fill: '#667788',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // Restart prompt
    const isMobile = this.sys.game.device.input.touch;
    const restartText = this.add.text(cx, cy + 80,
      isMobile ? t('tapReplay') : t('spaceReplay'), {
      font: '16px Bungee, monospace',
      fill: '#ffdd33',
      stroke: '#332200', strokeThickness: 3
    }).setOrigin(0.5);

    if (!isMobile) {
      this.add.text(cx, cy + 110, t('mainMenu'), {
        font: '14px Bungee, monospace',
        fill: '#556677',
        stroke: '#000000', strokeThickness: 2
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
  }
}
