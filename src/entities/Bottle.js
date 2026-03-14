import Phaser from 'phaser';

/**
 * Bottle — lying bottle prop on the ground.
 * Rolls away when the player runs past.
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
    this.setDepth(4.5);
    // Source: 903x332 → ratio 2.72:1, display ~38x14
    this.setDisplaySize(38, 14);

    this._bsX = this.scaleX;
    this._bsY = this.scaleY;

    this._isBlowing = false;
    this._blowCooldown = 0;
  }

  tick(delta) {
    if (this._blowCooldown > 0) this._blowCooldown -= delta;
  }

  disturb(playerVelX, playerSpeed) {
    if (this._isBlowing || this._blowCooldown > 0) return;
    this._isBlowing = true;
    this._blowCooldown = 2200;

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 160, 0.4, 1.2);

    const driftX = dir * Phaser.Math.Between(30, 70) * strength;
    const liftY = -Phaser.Math.Between(4, 12) * strength;
    const spinDeg = dir * Phaser.Math.Between(40, 120) * strength;

    const scene = this.scene;
    const bsX = this._bsX;
    const bsY = this._bsY;
    const groundY = this.homeY;

    // Phase 1 — roll and slight lift
    scene.tweens.add({
      targets: this,
      x: this.x + driftX * 0.6,
      y: Math.min(this.y + liftY, groundY),
      angle: this.baseAngle + spinDeg * 0.5,
      duration: 250,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — continue rolling on ground
        scene.tweens.add({
          targets: this,
          x: this.x + driftX * 0.4,
          y: groundY,
          angle: this.baseAngle + spinDeg,
          duration: 350,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Phase 3 — settle
            const settleX = this.homeX + dir * Phaser.Math.Between(5, 20);
            scene.tweens.add({
              targets: this,
              x: settleX,
              y: groundY,
              angle: this.baseAngle + Phaser.Math.Between(-5, 5),
              scaleX: bsX,
              scaleY: bsY,
              duration: 500,
              ease: 'Sine.easeOut',
              onComplete: () => { this._isBlowing = false; }
            });
          }
        });
      }
    });
  }
}
