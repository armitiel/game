import Phaser from 'phaser';
import { COP } from '../config/gameConfig.js';

export default class Cop extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'cop_sheet', 1);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(4.5);

    // Spritesheet is generated at 2x COP.HEIGHT — scale 0.5 for crisp rendering.
    const F = COP.HEIGHT * 2;
    this.setScale(0.5);
    this.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Physics body in texture coords (2x), Phaser applies scale automatically.
    const FEET_Y = Math.round(F * 0.86);
    const bodyW = Math.round(F * 0.345);
    const bodyH = Math.round(F * 0.50);
    const bodyOffX = Math.round((F - bodyW) / 2);
    const bodyOffY = FEET_Y - bodyH;
    this.body.setSize(bodyW, bodyH);
    this.body.setOffset(bodyOffX, bodyOffY);
    this.y = y - (FEET_Y - F / 2) * 0.5;

    // Start walk animation
    this.play('cop_walk');

    // Patrol bounds
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;
    this.direction = 1;
    this._dirCooldown = 0;

    // AI State: PATROL → SUSPICIOUS → CHASE → ALERT
    //                          ↓ lost sight     ↓ lost sight
    //                      PATROL          INVESTIGATE → PATROL
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.lastSeenX = 0;       // last known player X position
    this.lastSeenY = 0;
    this.chaseSeenTime = 0;   // accumulated time seeing player during chase
    this._investigateDir = 1; // direction to look during investigate
    this._investigateTurns = 0;

    // Detection zone (visual)
    this.detectionCone = scene.add.graphics();
    this.detectionCone.setDepth(4);

    // Alert/status mark
    this.alertMark = scene.add.text(x, y - 30, '?', {
      fontFamily: 'ChangaOne',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#ffff00',
      stroke: '#330000', strokeThickness: 4
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    this.setVelocityX(COP.SPEED * this.direction);
    this.setFlipX(this.direction === -1);
  }

  update(time, delta, player) {
    this.alertMark.setPosition(this.x, this.y - 40);
    if (this._dirCooldown > 0) this._dirCooldown -= delta;

    const canSee = this.canSeePlayer(player);

    // Track last known position whenever we see the player
    if (canSee && player) {
      this.lastSeenX = player.x;
      this.lastSeenY = player.y;
    }

    switch (this.state) {
      case 'PATROL':
        this.patrol();
        this.drawDetectionZone(0xffff00, 0.08);
        if (canSee) {
          this.enterSuspicious();
        }
        break;

      case 'SUSPICIOUS':
        // Stop and watch — turn towards player
        this.setVelocityX(0);
        if (this.anims.currentAnim?.key !== 'cop_idle') this.play('cop_idle');
        this._facePoint(this.lastSeenX);
        this.drawDetectionZone(0xff8800, 0.12);
        this.stateTimer += delta;

        if (canSee) {
          if (this.stateTimer >= COP.SUSPICIOUS_TIME) {
            this.enterChase();
          }
        } else {
          // Lost sight — go back to patrol
          this.returnToPatrol();
        }
        break;

      case 'CHASE':
        // Run towards player
        this._facePoint(this.lastSeenX);
        this._moveTowards(this.lastSeenX);
        if (this.anims.currentAnim?.key !== 'cop_walk') this.play('cop_walk');
        this.drawDetectionZone(0xff3300, 0.15);

        if (canSee) {
          this.chaseSeenTime += delta;
          if (this.chaseSeenTime >= COP.CHASE_ALERT_TIME) {
            this.enterAlert(player);
          }
        } else {
          // Lost sight — investigate last known position
          this.enterInvestigate();
        }
        break;

      case 'INVESTIGATE':
        this.stateTimer += delta;
        this._investigate(delta);
        this.drawDetectionZone(0xff8800, 0.10);

        if (canSee) {
          // Found again — resume chase
          this.enterChase();
        } else if (this.stateTimer >= COP.INVESTIGATE_TIME) {
          this.returnToPatrol();
        }
        break;

      case 'ALERT':
        break;
    }
  }

  // --- PATROL ---
  patrol() {
    let wantFlip = false;

    if (this.x <= this.patrolLeft && this.direction === -1) {
      wantFlip = true;
    } else if (this.x >= this.patrolRight && this.direction === 1) {
      wantFlip = true;
    }

    if (!wantFlip && this.body.blocked.down) {
      const probeX = this.x + this.direction * (this.body.halfWidth + 4);
      const probeY = this.body.bottom + 6;
      if (!this._hasGroundAt(probeX, probeY)) {
        wantFlip = true;
      }
    }

    if (wantFlip && this._dirCooldown <= 0) {
      this.direction *= -1;
      this.setFlipX(this.direction === -1);
      this._dirCooldown = 300;
    }

    this.setVelocityX(COP.SPEED * this.direction);
  }

  // --- STATE TRANSITIONS ---
  enterSuspicious() {
    this.state = 'SUSPICIOUS';
    this.stateTimer = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('?');
    this.alertMark.setStyle({ fill: '#ffff00' });
    this.setTint(0xffaa00);
  }

  enterChase() {
    this.state = 'CHASE';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff6600' });
    this.setTint(COP.ALERT_COLOR);
  }

  enterInvestigate() {
    this.state = 'INVESTIGATE';
    this.stateTimer = 0;
    this._investigateTurns = 0;
    this.alertMark.setText('?');
    this.alertMark.setStyle({ fill: '#ff8800' });
  }

  enterAlert(player) {
    this.state = 'ALERT';
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff3333' });
    this.setVelocityX(0);
    if (this.anims.currentAnim?.key !== 'cop_idle') this.play('cop_idle');
    this.scene.events.emit('player-caught');
  }

  returnToPatrol() {
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this.alertMark.setVisible(false);
    this.clearTint();
    this.play('cop_walk');
    this.setVelocityX(COP.SPEED * this.direction);
  }

  resetState() {
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this._dirCooldown = 0;
    this.alertMark.setVisible(false);
    this.clearTint();
    this.play('cop_walk');
    this.setVelocityX(COP.SPEED * this.direction);
  }

  // --- INVESTIGATE: walk to last known pos, look around ---
  _investigate(delta) {
    const dx = this.lastSeenX - this.x;
    const dist = Math.abs(dx);

    if (dist > 15) {
      // Walk towards last seen position
      this._facePoint(this.lastSeenX);
      this._moveTowards(this.lastSeenX, COP.SPEED * 0.7);
      if (this.anims.currentAnim?.key !== 'cop_walk') this.play('cop_walk');
    } else {
      // At position — look around (turn every 600ms)
      this.setVelocityX(0);
      if (this.anims.currentAnim?.key !== 'cop_idle') this.play('cop_idle');

      const lookInterval = 600;
      const turnIndex = Math.floor(this.stateTimer / lookInterval);
      if (turnIndex > this._investigateTurns) {
        this._investigateTurns = turnIndex;
        this.direction *= -1;
        this.setFlipX(this.direction === -1);
      }
    }
  }

  // --- HELPERS ---
  _facePoint(px) {
    const newDir = px > this.x ? 1 : -1;
    if (newDir !== this.direction) {
      this.direction = newDir;
      this.setFlipX(this.direction === -1);
    }
  }

  _moveTowards(px, speed) {
    speed = speed || COP.CHASE_SPEED;
    // Respect patrol bounds and edges
    let wantFlip = false;
    if (this.x <= this.patrolLeft && this.direction === -1) wantFlip = true;
    if (this.x >= this.patrolRight && this.direction === 1) wantFlip = true;

    if (!wantFlip && this.body.blocked.down) {
      const probeX = this.x + this.direction * (this.body.halfWidth + 4);
      const probeY = this.body.bottom + 6;
      if (!this._hasGroundAt(probeX, probeY)) wantFlip = true;
    }

    if (wantFlip) {
      this.setVelocityX(0);
      return;
    }

    this.setVelocityX(speed * this.direction);
  }

  canSeePlayer(player) {
    if (!player || player.isHidden) return false;
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inFront = (this.direction === 1 && dx > 0) || (this.direction === -1 && dx < 0);
    return inFront && dist < COP.DETECTION_RANGE && dy < 80;
  }

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

  drawDetectionZone(color, alpha) {
    this.detectionCone.clear();
    const dir = this.direction;
    const startX = this.x;
    const startY = this.y;
    const range = COP.DETECTION_RANGE;

    this.detectionCone.fillStyle(color, alpha);
    this.detectionCone.fillTriangle(
      startX, startY - 20,
      startX + range * dir, startY - 40,
      startX + range * dir, startY + 20
    );

    this.detectionCone.lineStyle(1, color, alpha * 2.5);
    this.detectionCone.strokeTriangle(
      startX, startY - 20,
      startX + range * dir, startY - 40,
      startX + range * dir, startY + 20
    );
  }

  destroy() {
    this.detectionCone.destroy();
    this.alertMark.destroy();
    super.destroy();
  }
}
