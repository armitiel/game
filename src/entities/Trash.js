import Phaser from 'phaser';

/**
 * Trash — a pushable trash can that acts as a movable platform.
 * Player can push it left/right by walking into it, and can jump on top of it.
 * After 2 jumps on top, it transforms into trash2 with a smoke effect.
 */
export default class Trash extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'trash');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale: 290x366 → ~48x60 in-game (+20%)
    const dw = 48, dh = 60;
    this.setDisplaySize(dw, dh);
    this.setDepth(4.5);  // in front of ladders (depth 4)

    // Physics body — setSize works in source pixels, so scale accordingly
    const scaleX = dw / 290;  // ~0.138
    const scaleY = dh / 366;  // ~0.137
    const bw = 260;  // source px — slightly smaller than full width
    const bh = 340;  // source px — slightly smaller than full height
    this.body.setSize(bw, bh);
    this.body.setOffset((290 - bw) / 2, 366 - bh);  // align to bottom

    this.body.setAllowGravity(false);  // no gravity — positioned manually on ground
    this.body.setImmovable(true);     // immovable by default — only pushable with E
    this.body.setBounce(0);
    this.body.setDragX(300);
    this.body.setMaxVelocityX(80);

    this.setCollideWorldBounds(true);

    this.isBeingPushed = false;  // true when player holds E near this trash
    this.jumpCount = 0;         // how many times player jumped on top
    this.isCrushed = false;     // true after transforming to trash2
    this._playerWasOnTop = false; // track landing vs standing
    this._offTopFrames = 0;     // consecutive frames player is NOT on top
  }

  /** Enable pushing (called each frame while E is held near this trash) */
  enablePush() {
    this.body.setImmovable(false);
    // NO gravity — only move horizontally, stay at same Y
    this.body.setAllowGravity(false);
    this.isBeingPushed = true;
  }

  /** Disable pushing (called when E released or player moves away) */
  disablePush() {
    this.body.setImmovable(true);
    this.body.setAllowGravity(false);
    this.body.setVelocityX(0);
    this.body.setVelocityY(0);
    this.isBeingPushed = false;
  }

  /**
   * Called when player is standing on top (body.touching.up on trash).
   * Counts distinct landings — transforms after 2.
   */
  onPlayerOnTop() {
    if (this.isCrushed) return;
    this._offTopFrames = 0; // player is on top — reset off-counter
    if (!this._playerWasOnTop) {
      this._playerWasOnTop = true;
      this.jumpCount++;

      // Squash effect on each landing
      this.scene.tweens.add({
        targets: this,
        scaleY: this.scaleY * 0.85,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut'
      });

      if (this.jumpCount >= 2) {
        this.crush();
      }
    }
  }

  /** Called when player is NOT touching the top this frame */
  onPlayerOffTop() {
    if (!this._playerWasOnTop) return;
    this._offTopFrames++;
    // Require 6+ consecutive frames off top to count as truly leaving
    // (prevents physics flicker from resetting mid-stand)
    if (this._offTopFrames >= 6) {
      this._playerWasOnTop = false;
    }
  }

  /** Transform into crushed trash with smoke particles */
  crush() {
    this.isCrushed = true;

    // Smoke puff particles
    for (let i = 0; i < 12; i++) {
      const px = this.x + Phaser.Math.Between(-20, 20);
      const py = this.y + Phaser.Math.Between(-25, 5);
      const size = Phaser.Math.Between(4, 10);
      const smoke = this.scene.add.circle(px, py, size, 0x888888, 0.7)
        .setDepth(10);

      this.scene.tweens.add({
        targets: smoke,
        x: smoke.x + Phaser.Math.Between(-20, 20),
        y: smoke.y + Phaser.Math.Between(-30, -10),
        alpha: 0,
        scale: Phaser.Math.FloatBetween(1.5, 2.5),
        duration: Phaser.Math.Between(400, 700),
        onComplete: () => smoke.destroy()
      });
    }

    // Swap texture — same size, nudged down slightly
    this.setTexture('trash2');
    this.setDisplaySize(48, 60);
    this.y += 4;

    // Shrink physics body height so player stands lower on crushed trash
    // Body stays aligned to bottom of sprite
    const bw = 260;
    const crushedBh = 200;  // original 340 → 200 (shorter collision top)
    this.body.setSize(bw, crushedBh);
    this.body.setOffset((290 - bw) / 2, 366 - crushedBh);

    // Screen shake
    this.scene.cameras.main.shake(120, 0.005);
  }
}
