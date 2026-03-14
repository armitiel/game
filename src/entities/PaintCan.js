import Phaser from 'phaser';
import { PAINT } from '../config/gameConfig.js';

export default class PaintCan extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, colorName) {
    super(scene, x, y, `paint_can_sprite_${colorName.toLowerCase()}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.colorName = colorName.toLowerCase();
    // Native 102x72 texture — scale to ~34px tall in game
    this.setScale(34 / 72);
    this.setDepth(2.5);
    this.body.setSize(20, 30);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.moves = false;  // let tween drive position — no physics velocity fighting

    // Floating animation
    this._baseY = y;
    scene.tweens.add({
      targets: this,
      y: y - 4,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  collect(player) {
    player.collectPaint(this.colorName, PAINT.PAINT_PER_CAN);

    // Contact point: midpoint between player and can
    const px = (this.x + player.x) / 2;
    const py = (this.y + player.y) / 2;

    // Star sparkle particles with slightly rounded tips
    for (let i = 0; i < 25; i++) {
      const innerR = Phaser.Math.Between(2, 5);
      const outerR = Phaser.Math.Between(5, 10);
      const sx = px + Phaser.Math.Between(-20, 20);
      const sy = py + Phaser.Math.Between(-20, 20);

      const star = this.scene.add.star(sx, sy, 5, innerR, outerR, 0xffdd33, 1)
        .setDepth(10);
      // Round the tips with a subtle lineStyle matching the fill
      star.setStrokeStyle(1.5, 0xffdd33, 1);
      star.lineJoin = 'round';

      this.scene.tweens.add({
        targets: star,
        x: star.x + Phaser.Math.Between(-40, 40),
        y: star.y + Phaser.Math.Between(-50, -10),
        alpha: 0,
        scale: 0.3,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(350, 700),
        onComplete: () => star.destroy()
      });
    }

    // Floating text
    const text = this.scene.add.text(px, py - 16, `+${this.colorName}`, {
      font: '12px ChangaOne, monospace',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy()
    });

    // Remove can instantly
    this.destroy();
  }
}
