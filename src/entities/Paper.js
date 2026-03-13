import Phaser from 'phaser';

/**
 * Paper — newspaper/litter prop lying on the ground.
 * When a player runs past it, it gets blown by the wind:
 *   - slides along the ground (never below homeY)
 *   - slight lift then settles back
 *   - deforms (squeeze, skew) to mimic crumpling
 *   - rotates like a tumbling page
 *   - settles back near its origin
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
    this.setDepth(4.5);       // above platforms (3), below player (5)
    this.setDisplaySize(42, 32);

    // Store base scale after setDisplaySize — tweens deform RELATIVE to this
    this._bsX = this.scaleX;
    this._bsY = this.scaleY;

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
   * Paper slides along the ground line, never sinks below homeY.
   * @param {number} playerVelX  player horizontal velocity (sign = direction)
   * @param {number} playerSpeed  absolute speed (stronger = more blow)
   */
  disturb(playerVelX, playerSpeed) {
    if (this._isBlowing || this._blowCooldown > 0) return;
    this._isBlowing = true;
    this._blowCooldown = 1800;

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 160, 0.4, 1.2);

    const driftX  = dir * Phaser.Math.Between(25, 55) * strength;
    const liftY   = -Phaser.Math.Between(8, 22) * strength;
    // Clamp rotation to ±90° from base so paper never flips below ground line
    const rawSpin = dir * Phaser.Math.Between(60, 160) * strength;
    const maxSpin = 85 - Math.abs(this.baseAngle); // stay within -90..+90 total
    const spinDeg = Phaser.Math.Clamp(rawSpin, -maxSpin, maxSpin);

    const scene = this.scene;
    const bsX = this._bsX;
    const bsY = this._bsY;
    const groundY = this.homeY;

    // Helper: clamp angle so paper image stays above ground
    const clampAngle = (a) => Phaser.Math.Clamp(a, -88, 88);

    // Phase 1 — quick lift + sideways slide with crumple deformation
    const p1x = this.x + driftX * 0.6;
    const p1y = Math.min(this.y + liftY, groundY);
    scene.tweens.add({
      targets: this,
      x: p1x,
      y: p1y,
      angle: clampAngle(this.baseAngle + spinDeg * 0.5),
      scaleX: bsX * (0.7 + 0.3 * Math.random()),
      scaleY: bsY * (1.1 + 0.15 * Math.random()),
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — tumble along ground, more deformation
        const p2x = this.x + driftX * 0.4 + dir * Phaser.Math.Between(5, 15);
        scene.tweens.add({
          targets: this,
          x: p2x,
          y: groundY,
          angle: clampAngle(this.baseAngle + spinDeg),
          scaleX: bsX * (1.15 + 0.1 * Math.random()),
          scaleY: bsY * (0.75 + 0.15 * Math.random()),
          duration: 300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Phase 3 — settle back near home
            const settleX = this.homeX + dir * Phaser.Math.Between(3, 14);
            const settleAngle = this.baseAngle + Phaser.Math.Between(-6, 6);
            scene.tweens.add({
              targets: this,
              x: settleX,
              y: groundY,
              angle: settleAngle,
              scaleX: bsX,
              scaleY: bsY,
              duration: 600,
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
