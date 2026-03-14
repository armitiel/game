import Phaser from 'phaser';

/**
 * Carton — crushed cardboard box prop on the ground.
 * Slides when the player runs past.
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
    this.setDepth(4.5);
    // Source: 441x206 → ratio 2.14:1, display ~34x16
    this.setDisplaySize(34, 16);

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
    this._blowCooldown = 2000;

    const dir = playerVelX >= 0 ? 1 : -1;
    const strength = Phaser.Math.Clamp(playerSpeed / 160, 0.4, 1.2);

    const driftX = dir * Phaser.Math.Between(15, 40) * strength;
    const liftY = -Phaser.Math.Between(6, 18) * strength;
    const rawSpin = dir * Phaser.Math.Between(20, 50) * strength;
    const spinDeg = Phaser.Math.Clamp(rawSpin, -30, 30);

    const scene = this.scene;
    const bsX = this._bsX;
    const bsY = this._bsY;
    const groundY = this.homeY;

    // Phase 1 — lift and slide
    scene.tweens.add({
      targets: this,
      x: this.x + driftX * 0.7,
      y: Math.min(this.y + liftY, groundY),
      angle: this.baseAngle + spinDeg * 0.5,
      scaleX: bsX * (0.85 + 0.15 * Math.random()),
      scaleY: bsY * (1.05 + 0.1 * Math.random()),
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Phase 2 — slide on ground
        scene.tweens.add({
          targets: this,
          x: this.x + driftX * 0.3,
          y: groundY,
          angle: this.baseAngle + spinDeg,
          scaleX: bsX * (1.1 + 0.1 * Math.random()),
          scaleY: bsY * (0.85 + 0.1 * Math.random()),
          duration: 280,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            // Phase 3 — settle
            const settleX = this.homeX + dir * Phaser.Math.Between(3, 12);
            scene.tweens.add({
              targets: this,
              x: settleX,
              y: groundY,
              angle: this.baseAngle + Phaser.Math.Between(-4, 4),
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
