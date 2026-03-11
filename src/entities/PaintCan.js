import Phaser from 'phaser';

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
    player.collectPaint(this.colorName);

    // Contact point: midpoint between player and can
    const px = (this.x + player.x) / 2;
    const py = (this.y + player.y) / 2;

    // Rounded 3D-style sparkle particles (same spread as original stars)
    for (let i = 0; i < 25; i++) {
      const size = Phaser.Math.Between(4, 9);
      const r = Math.round(size * 0.4);
      const sx = px + Phaser.Math.Between(-20, 20);
      const sy = py + Phaser.Math.Between(-20, 20);
      const half = size / 2;

      // Draw around (0,0) so position/scale/angle tweens work naturally
      const gfx = this.scene.add.graphics().setPosition(sx, sy).setDepth(10);
      gfx.fillStyle(0x997700, 0.6);
      gfx.fillRoundedRect(-half + 1, -half + 1, size, size, r);
      gfx.fillStyle(0xffdd33, 1);
      gfx.fillRoundedRect(-half, -half, size, size, r);
      const hl = Math.max(2, Math.round(size * 0.45));
      gfx.fillStyle(0xffffff, 0.5);
      gfx.fillRoundedRect(-half + 1, -half + 1, hl, hl, Math.round(hl * 0.3));

      this.scene.tweens.add({
        targets: gfx,
        x: sx + Phaser.Math.Between(-40, 40),
        y: sy + Phaser.Math.Between(-50, -10),
        alpha: 0,
        scale: 0.3,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(350, 700),
        onComplete: () => gfx.destroy()
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
