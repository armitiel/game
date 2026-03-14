import Phaser from 'phaser';
import { COP } from '../config/gameConfig.js';

export default class Cop extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'cop_sheet', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(4.5); // in front of shadows (2) and ladders (4)

    // Scale 128px frame to match game world (similar height to player ~60px body)
    const targetH = COP.HEIGHT;
    const copScale = targetH / 128;
    this.setScale(copScale);

    // Physics body — centered on character within the 128px frame
    const bodyW = Math.round(24 / copScale);
    const bodyH = Math.round((targetH - 4) / copScale);
    const bodyOffX = Math.round((128 - bodyW) / 2);
    const bodyOffY = Math.round(128 - bodyH - 4 / copScale);
    this.body.setSize(bodyW, bodyH);
    this.body.setOffset(bodyOffX, bodyOffY);

    // Start walk animation
    this.play('cop_walk');

    // Patrol bounds
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;
    this.direction = 1; // 1 = right, -1 = left

    // AI State
    this.state = 'PATROL'; // PATROL | DETECT | ALERT
    this.alertTimer = 0;
    this.alertDuration = 1500; // ms

    // Detection zone (visual)
    this.detectionCone = scene.add.graphics();
    this.detectionCone.setDepth(9);

    // Exclamation mark for alert
    this.alertMark = scene.add.text(x, y - 30, '!', {
      font: 'bold 24px ChangaOne, monospace',
      fill: '#ff3333',
      stroke: '#330000', strokeThickness: 4
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.setVelocityX(COP.SPEED * this.direction);
    this.setFlipX(this.direction === -1);
  }

  update(time, delta, player) {
    this.alertMark.setPosition(this.x, this.y - 30);

    // Debug: log every 120 frames (~2s)
    if (!this._dbgFrame) this._dbgFrame = 0;
    this._dbgFrame++;
    if (this._dbgFrame % 120 === 1) {
      const canSee = this.canSeePlayer(player);
      const dx = player ? (player.x - this.x).toFixed(0) : '?';
      const dy = player ? Math.abs(player.y - this.y).toFixed(0) : '?';
      console.log(`[COP] state=${this.state} pos=(${this.x.toFixed(0)},${this.y.toFixed(0)}) dir=${this.direction} player=(${player?.x?.toFixed(0)},${player?.y?.toFixed(0)}) dx=${dx} dy=${dy} hidden=${player?.isHidden} canSee=${canSee}`);
    }

    switch (this.state) {
      case 'PATROL':
        this.patrol();
        this.drawDetectionZone();
        if (this.canSeePlayer(player)) {
          console.log('[COP] DETECTED PLAYER! Entering DETECT state');
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
        break;

      case 'ALERT':
        // Player caught — handled in GameScene
        break;
    }
  }

  patrol() {
    // --- Patrol bounds ---
    if (this.x <= this.patrolLeft) {
      this.direction = 1;
      this.setFlipX(false);
    } else if (this.x >= this.patrolRight) {
      this.direction = -1;
      this.setFlipX(true);
    }

    // --- Edge detection: don't walk off platforms ---
    if (this.body.blocked.down) {
      const probeX = this.x + this.direction * (this.body.halfWidth + 4);
      const probeY = this.body.bottom + 6; // just below feet
      if (!this._hasGroundAt(probeX, probeY)) {
        // No ground ahead — reverse direction
        this.direction *= -1;
        this.setFlipX(this.direction === -1);
      }
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

    // Detection cone turns red
    this.detectionCone.clear();
    const dir = this.direction;
    this.detectionCone.fillStyle(0xff0000, 0.15);
    this.detectionCone.fillTriangle(
      this.x, this.y - 20,
      this.x + COP.DETECTION_RANGE * dir, this.y - 40,
      this.x + COP.DETECTION_RANGE * dir, this.y + 20
    );
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
