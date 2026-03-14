import Phaser from 'phaser';
import { COP } from '../config/gameConfig.js';

export default class Cop extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'cop_sheet', 1);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(4.5); // in front of shadows (2) and ladders (4)

    // Spritesheet is generated at COP.HEIGHT×COP.HEIGHT — no scaling needed (scale=1).
    // This gives crisp rendering (1080→168 direct downscale, no upscaling blur).
    const F = COP.HEIGHT;  // frame size = display size

    // Physics body — proportional to character in the Walk_P frame.
    // Feet at ~79% of frame height (measured from Walk_P PNGs).
    const FEET_Y = Math.round(F * 0.86);
    const bodyW = Math.round(F * 0.345);     // ~58 (proportional to 44/128)
    const bodyH = Math.round(F * 0.50);      // ~84 (proportional to 64/128)
    const bodyOffX = Math.round((F - bodyW) / 2);  // center horizontally
    const bodyOffY = FEET_Y - bodyH;                // body top
    this.body.setSize(bodyW, bodyH);
    this.body.setOffset(bodyOffX, bodyOffY);

    // y parameter = platform/ground surface level.
    // Position sprite so body bottom (feet) sits exactly on that surface.
    // With scale=1 and origin(0.5,0.5):
    //   body.bottom = sprite.y - F/2 + bodyOffY + bodyH = sprite.y + (FEET_Y - F/2)
    //   Want body.bottom = y  →  sprite.y = y - (FEET_Y - F/2)
    this.y = y - (FEET_Y - F / 2);

    // Start walk animation
    this.play('cop_walk');

    // Patrol bounds
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;
    this.direction = 1; // 1 = right, -1 = left

    // Direction change cooldown — prevents flip-flopping at edges
    this._dirCooldown = 0;

    // AI State
    this.state = 'PATROL'; // PATROL | DETECT | ALERT
    this.alertTimer = 0;
    this.alertDuration = 1500; // ms

    // Detection zone (visual)
    this.detectionCone = scene.add.graphics();
    this.detectionCone.setDepth(9);

    // Exclamation mark for alert
    this.alertMark = scene.add.text(x, y - 30, '!', {
      fontFamily: 'ChangaOne',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#ff3333',
      stroke: '#330000', strokeThickness: 4
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.setVelocityX(COP.SPEED * this.direction);
    this.setFlipX(this.direction === -1);
  }

  update(time, delta, player) {
    this.alertMark.setPosition(this.x, this.y - 40);

    // Tick direction cooldown
    if (this._dirCooldown > 0) this._dirCooldown -= delta;

    switch (this.state) {
      case 'PATROL':
        this.patrol();
        this.drawDetectionZone();
        if (this.canSeePlayer(player)) {
          this.enterDetect();
        }
        break;

      case 'DETECT':
        this.setVelocityX(0);
        if (this.anims.isPlaying && this.anims.currentAnim?.key === 'cop_walk') {
          this.play('cop_idle');
        }
        this.alertTimer += delta;
        if (this.alertTimer >= this.alertDuration) {
          this.enterAlert(player);
        }
        if (!this.canSeePlayer(player)) {
          this.returnToPatrol();
        }
        this.drawDetectionZone();
        break;

      case 'ALERT':
        // Player caught — handled in GameScene
        break;
    }
  }

  patrol() {
    let wantFlip = false;

    // --- Patrol bounds ---
    if (this.x <= this.patrolLeft && this.direction === -1) {
      wantFlip = true;
    } else if (this.x >= this.patrolRight && this.direction === 1) {
      wantFlip = true;
    }

    // --- Edge detection: don't walk off platforms ---
    if (!wantFlip && this.body.blocked.down) {
      const probeX = this.x + this.direction * (this.body.halfWidth + 4);
      const probeY = this.body.bottom + 6;
      if (!this._hasGroundAt(probeX, probeY)) {
        wantFlip = true;
      }
    }

    // Apply direction change with cooldown to prevent flip-flopping
    if (wantFlip && this._dirCooldown <= 0) {
      this.direction *= -1;
      this.setFlipX(this.direction === -1);
      this._dirCooldown = 300; // ms — ignore further flips for 300ms
    }

    this.setVelocityX(COP.SPEED * this.direction);
  }

  /**
   * Check if there is any solid platform/ground body at the given point.
   */
  _hasGroundAt(px, py) {
    const scene = this.scene;
    const groups = [scene.platforms, scene.ground];
    for (const group of groups) {
      const bodies = group.getChildren();
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i].body;
        if (!b) continue;
        if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) {
          return true;
        }
      }
    }
    return false;
  }

  canSeePlayer(player) {
    if (!player || player.isHidden) return false;

    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Must be in front and within range
    const inFront = (this.direction === 1 && dx > 0) || (this.direction === -1 && dx < 0);
    return inFront && dist < COP.DETECTION_RANGE && dy < 80;
  }

  drawDetectionZone() {
    this.detectionCone.clear();

    const dir = this.direction;
    const startX = this.x;
    const startY = this.y;
    const range = COP.DETECTION_RANGE;

    // Draw triangular detection zone
    this.detectionCone.fillStyle(0xffff00, 0.08);
    this.detectionCone.fillTriangle(
      startX, startY - 20,
      startX + range * dir, startY - 40,
      startX + range * dir, startY + 20
    );

    // Border
    this.detectionCone.lineStyle(1, 0xffff00, 0.2);
    this.detectionCone.strokeTriangle(
      startX, startY - 20,
      startX + range * dir, startY - 40,
      startX + range * dir, startY + 20
    );
  }

  enterDetect() {
    this.state = 'DETECT';
    this.alertTimer = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('?');
    this.alertMark.setStyle({ fill: '#ffff00' });
    this.setTint(COP.ALERT_COLOR);
  }

  enterAlert(player) {
    this.state = 'ALERT';
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff3333' });
    this.setVelocityX(0);

    // Emit event for GameScene to handle
    this.scene.events.emit('player-caught');
  }

  returnToPatrol() {
    this.state = 'PATROL';
    this.alertTimer = 0;
    this.alertMark.setVisible(false);
    this.clearTint();
    this.play('cop_walk');
    this.setVelocityX(COP.SPEED * this.direction);
  }

  resetState() {
    this.state = 'PATROL';
    this.alertTimer = 0;
    this._dirCooldown = 0;
    this.alertMark.setVisible(false);
    this.clearTint();
    this.play('cop_walk');
    this.setVelocityX(COP.SPEED * this.direction);
  }

  destroy() {
    this.detectionCone.destroy();
    this.alertMark.destroy();
    super.destroy();
  }
}
