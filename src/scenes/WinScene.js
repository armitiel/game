import Phaser from 'phaser';

export default class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  create() {
    const cx = this.sys.game.config.width / 2;
    const cy = this.sys.game.config.height / 2;
    const gw = this.sys.game.config.width;
    const gh = this.sys.game.config.height;

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
    this.add.text(cx, cy - 60, 'LEVEL COMPLETE', {
      font: 'bold 48px monospace',
      fill: '#00ff88',
      stroke: '#003322',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(cx, cy + 10, 'The city is your canvas.', {
      font: '18px monospace',
      fill: '#667788'
    }).setOrigin(0.5);

    // Restart prompt
    const isMobile = this.sys.game.device.input.touch;
    const restartText = this.add.text(cx, cy + 80,
      isMobile ? '[ TAP - Zagraj ponownie ]' : '[ SPACE - Zagraj ponownie ]', {
      font: '16px monospace',
      fill: '#ffdd33'
    }).setOrigin(0.5);

    if (!isMobile) {
      this.add.text(cx, cy + 110, '[ M - Menu glowne ]', {
        font: '14px monospace',
        fill: '#556677'
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
