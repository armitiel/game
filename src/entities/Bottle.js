import Phaser from 'phaser';

/**
 * Bottle — lying bottle prop on the ground.
 * When the player walks past it nudges in the player's direction
 * and stays where it lands (never returns to its original position).
 * Displayed in front of the player (depth > 5).
 */
export default class Bottle extends Phaser.GameObjects.Image {
  constructor(scene, x, y, baseAngle) {
    super(scene, x, y, 'bottle_img');

    scene.add.existing(this);

    this.homeX = x;
    this.homeY = y;
    this.baseAngle = baseAngle ?? Phaser.Math.Between(-8, 8);
    this.setAngle(this.baseAngle);
    this.setOrigin(0.5, 1);
    this.setDepth(5.5);       // in front of player (5)
    // Source: 903x332 → ratio ~2.7:1
    this.setDisplaySize(38, 14);

    this._bsX = this.scaleX;
    this._bsY = this.scaleY;

    this._isRolling = false;
    this._rollCooldown = 0;
  }

  tick(delta) {
    if (this._rollCooldown > 0) this._rollCooldown -= delta;
  }

  /**
   * Nudge the bottle along the ground when the player passes by.
   * It slides a short distance in the player's direction, rolls a bit, then stops.
   * The new position becomes permanent — the bottle never resets.
   */
  disturb(playerVelX, playerSpeed) {
    if (this._isRolling || this._rollCooldown > 0) return;
    this._isRolling = true;
    this._rollCooldown = 800;

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 180, 0.3, 1.0);

    // Short nudge distance — bottle just scoots a bit
    const nudge = dir * Phaser.Math.Between(12, 30) * strength;
    // Gentle roll rotation (stays flat, ±25°)
    const roll  = dir * Phaser.Math.Between(15, 40) * strength;

    const scene  = this.scene;
    const groundY = this.homeY;

    // Phase 1 — quick nudge with slight roll
    const targetX = this.x + nudge;
    const midAngle = Phaser.Math.Clamp(this.angle + roll, -25, 25);
    scene.tweens.add({
      targets: this,
      x: targetX,
      y: groundY,
      angle: midAngle,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — settle: tiny extra slide + angle dampens
        const restX = targetX + dir * Phaser.Math.Between(2, 8);
        const restAngle = midAngle * 0.4 + Phaser.Math.Between(-3, 3);
        scene.tweens.add({
          targets: this,
          x: restX,
          y: groundY,
          angle: Phaser.Math.Clamp(restAngle, -20, 20),
          duration: 300,
          ease: 'Sine.easeOut',
          onComplete: () => {
            // Update home position — bottle stays where it landed
            this.homeX = this.x;
            this.homeY = groundY;
            this.baseAngle = this.angle;
            this._isRolling = false;
          }
        });
      }
    });
  }
}
