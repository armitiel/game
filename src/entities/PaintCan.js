import Phaser from 'phaser';

export default class PaintCan extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, colorName) {
    super(scene, x, y, `paint_can_sprite_${colorName.toLowerCase()}`);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.colorName = colorName.toLowerCase();
    // Procedural textures are already at display size (18x34)
    this.setDepth(2.5);  // above murals (depth 1.5-2), below platforms (depth 3)
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
    player.collectPaint(this.colorName);

    // Contact point: midpoint between player and can
    const px = (this.x + player.x) / 2;
    const py = (this.y + player.y) / 2;

    // Sparkle particles
    for (let i = 0; i < 10; i++) {
      const star = this.scene.add.star(
        px + Phaser.Math.Between(-10, 10),
        py + Phaser.Math.Between(-10, 10),
        5,                              // 5 points
        Phaser.Math.Between(1, 3),      // inner radius
        Phaser.Math.Between(3, 6),      // outer radius
        0xffdd33, 1
      ).setDepth(10);

      this.scene.tweens.add({
        targets: star,
        x: star.x + Phaser.Math.Between(-25, 25),
        y: star.y + Phaser.Math.Between(-30, -5),
        alpha: 0,
        scale: 0.2,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(300, 600),
        onComplete: () => star.destroy()
      });
    }

    // Floating text
    const text = this.scene.add.text(px, py - 16, `+${this.colorName}`, {
      font: '12px monospace',
      fill: '#00ff88'
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
