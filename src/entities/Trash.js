import Phaser from 'phaser';

/**
 * Trash — a pushable trash can that acts as a movable platform.
 * Player can push it left/right by walking into it, and can jump on top of it.
 */
export default class Trash extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'trash');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Scale: 290x366 → ~40x50 in-game
    const dw = 40, dh = 50;
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
}
