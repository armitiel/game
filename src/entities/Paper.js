import Phaser from 'phaser';

/**
 * Paper — newspaper/litter prop lying on the ground.
 * When a player runs past it, it gets blown by the wind:
 *   - jumps slightly up and sideways (in player direction)
 *   - deforms (scaleX/scaleY squeeze to mimic a crumpled page)
 *   - rotates like a tumbling page
 *   - settles back near its origin with a slight random offset
 */
export default class Paper extends Phaser.GameObjects.Image {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {number} [baseAngle]  slight resting tilt (-15 to 15 deg)
   */
  constructor(scene, x, y, baseAngle) {
    super(scene, x, y, 'paper_img');

    scene.add.existing(this);

    this.homeX = x;
    this.homeY = y;
    this.baseAngle = baseAngle ?? Phaser.Math.Between(-12, 12);
    this.setAngle(this.baseAngle);
    this.setOrigin(0.5, 1);   // anchor at bottom-centre — sits on the ground
    this.setDepth(3.5);       // above ground, below player (depth 5)
    this.setDisplaySize(36, 28);

    this._isBlowing = false;
    this._blowCooldown = 0;
  }

  /**
   * Called each frame from GameScene.update().
   * @param {number} delta  ms since last frame
   */
  tick(delta) {
    if (this._blowCooldown > 0) this._blowCooldown -= delta;
  }

  /**
   * Trigger wind-blow animation when player runs past.
   * @param {number} playerVelX  player horizontal velocity (sign = direction)
   * @param {number} playerSpeed  absolute speed (stronger = more blow)
   */
  disturb(playerVelX, playerSpeed) {
    if (this._isBlowing || this._blowCooldown > 0) return;
    this._isBlowing = true;
    this._blowCooldown = 1800; // ms cooldown before next trigger

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 160, 0.4, 1.2);

    // How far the paper travels
    const driftX  = dir * Phaser.Math.Between(22, 50) * strength;
    const riseY   = -Phaser.Math.Between(20, 55) * strength;
    const spinDeg = dir * Phaser.Math.Between(80, 200) * strength;

    const scene = this.scene;
    const startX = this.x;
    const startY = this.y;
    const targetX = startX + driftX;
    const targetY = startY + riseY;

    // Phase 1 — blow away (fast, with deformation)
    scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      angle: this.baseAngle + spinDeg * 0.6,
      scaleX: 0.85 + 0.25 * Math.random(), // crinkle
      scaleY: 0.80 + 0.25 * Math.random(),
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — tumble a bit further (slower)
        scene.tweens.add({
          targets: this,
          x: targetX + dir * Phaser.Math.Between(8, 22),
          y: targetY + Phaser.Math.Between(10, 28), // fall back down
          angle: this.baseAngle + spinDeg,
          scaleX: 0.9 + 0.2 * Math.random(),
          scaleY: 0.9 + 0.2 * Math.random(),
          duration: 380,
          ease: 'Sine.easeIn',
          onComplete: () => {
            // Phase 3 — settle near home (slow drift back, gentle)
            const settleX = this.homeX + dir * Phaser.Math.Between(5, 18);
            const settleAngle = this.baseAngle + Phaser.Math.Between(-8, 8);
            scene.tweens.add({
              targets: this,
              x: settleX,
              y: this.homeY,
              angle: settleAngle,
              scaleX: 1,
              scaleY: 1,
              duration: 700,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this._isBlowing = false;
              }
            });
          }
        });
      }
    });
  }
}
