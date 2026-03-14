import Phaser from 'phaser';

/**
 * Carton — crushed cardboard box prop on the ground.
 * When the player walks past it nudges along the ground
 * and stays where it lands (never returns to original position).
 * Displayed in front of the player.
 */
export default class Carton extends Phaser.GameObjects.Image {
  constructor(scene, x, y, baseAngle) {
    super(scene, x, y, 'carton_img');

    scene.add.existing(this);

    this.homeX = x;
    this.homeY = y;
    this.baseAngle = baseAngle ?? Phaser.Math.Between(-6, 6);
    this.setAngle(this.baseAngle);
    this.setOrigin(0.5, 1);
    this.setDepth(5.5);       // in front of player (5)
    // Source: 441x206 → ratio 2.14:1, display ~44x21 (+30%)
    this.setDisplaySize(44, 21);

    this._bsX = this.scaleX;
    this._bsY = this.scaleY;

    this._isRolling = false;
    this._rollCooldown = 0;
  }

  tick(delta) {
    if (this._rollCooldown > 0) this._rollCooldown -= delta;
  }

  /**
   * Nudge the carton along the ground when the player passes by.
   * Slides a short distance, stays where it lands.
   */
  disturb(playerVelX, playerSpeed) {
    if (this._isRolling || this._rollCooldown > 0) return;
    this._isRolling = true;
    this._rollCooldown = 800;

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 180, 0.3, 1.0);

    const nudge = dir * Phaser.Math.Between(10, 25) * strength;
    const roll  = dir * Phaser.Math.Between(8, 25) * strength;

    const scene  = this.scene;
    const groundY = this.homeY;

    // Phase 1 — quick nudge with slight tilt
    const targetX = this.x + nudge;
    const midAngle = Phaser.Math.Clamp(this.angle + roll, -20, 20);
    scene.tweens.add({
      targets: this,
      x: targetX,
      y: groundY,
      angle: midAngle,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — tiny extra slide + settle
        const restX = targetX + dir * Phaser.Math.Between(2, 6);
        const restAngle = midAngle * 0.3 + Phaser.Math.Between(-2, 2);
        scene.tweens.add({
          targets: this,
          x: restX,
          y: groundY,
          angle: Phaser.Math.Clamp(restAngle, -15, 15),
          duration: 280,
          ease: 'Sine.easeOut',
          onComplete: () => {
            // Stay where it landed
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
