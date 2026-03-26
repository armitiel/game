import Phaser from 'phaser';
import { COP } from '../config/gameConfig.js';

export default class Cop extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, patrolLeft, patrolRight) {
    super(scene, x, y, 'cop_sheet', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(4.5);

    // 1x spritesheet at COP.HEIGHT (151px), scale=1 — same approach as Player.
    // No setScale needed (default 1).
    const F = COP.HEIGHT;  // 151px frame

    // Feet at ~97% of frame (measured: pixel 146 in 151px frame).
    // Body: small hitbox in lower portion, matching Player pattern.
    // Player: frame 96x144, body 20x60, offset (38, 81), body bottom=141 (97.9%)
    // Cop:    frame 151x151, body ~52x76, offset (~50, 70), body bottom=146 (96.7%)
    const bodyW = 52;
    const bodyH = 76;
    const bodyOffX = Math.round((F - bodyW) / 2);  // ~50, centered
    const bodyOffY = 146 - bodyH;                   // 70 — body bottom at pixel 146 (feet)
    this.body.setSize(bodyW, bodyH);
    this.body.setOffset(bodyOffX, bodyOffY);
    // No manual this.y — let gravity + collider position the cop (same as Player).

    // Start walk animation
    this.play('cop_walk');

    // Patrol bounds
    this.patrolLeft = patrolLeft;
    this.patrolRight = patrolRight;
    this.direction = 1;
    this._dirCooldown = 0;

    // AI State: PATROL → SUSPICIOUS → CHASE → ALERT
    //               ↕ idle              ↓ lost sight     ↓ lost sight
    //          PATROL_IDLE          INVESTIGATE → PATROL
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.lastSeenX = 0;       // last known player X position
    this.lastSeenY = 0;
    this.chaseSeenTime = 0;   // accumulated time seeing player during chase
    this._investigateDir = 1; // direction to look during investigate
    this._investigateTurns = 0;
    this._noticePlayed = false; // true after notice anim played — reset on full return to patrol
    this._idleDuration = 0;    // how long to idle at patrol endpoint
    this._idleChance = 0.5;    // 50% chance to idle at each patrol turn
    this._patrolWalkTime = 0;  // time walking since last idle
    this._nextMidPatrolIdle = 4000 + Math.random() * 4000; // 4-8s random mid-patrol idle

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
        this.patrol(delta);
        this.drawDetectionZone(0xffff00, 0.08);
        // Post-catch cooldown — ignore player briefly after hitting
        if (this._postCatchCooldown > 0) {
          this._postCatchCooldown -= delta;
          break;
        }
        // Reset notice flag after calm patrol for a while (cop "forgets")
        if (this._noticePlayed) {
          this._patrolCalmTime = (this._patrolCalmTime || 0) + delta;
          if (this._patrolCalmTime > 3000) {
            this._noticePlayed = false;
            this._patrolCalmTime = 0;
          }
        }
        if (canSee) {
          this._patrolCalmTime = 0;
          this.enterSuspicious();
        }
        break;

      case 'PATROL_IDLE':
        // Standing still at patrol endpoint — idle animation
        this.setVelocityX(0);
        this.drawDetectionZone(0xffff00, 0.08);
        this.stateTimer += delta;
        // Reset notice flag while idling (counts as calm patrol)
        if (this._noticePlayed) {
          this._patrolCalmTime = (this._patrolCalmTime || 0) + delta;
          if (this._patrolCalmTime > 3000) {
            this._noticePlayed = false;
            this._patrolCalmTime = 0;
          }
        }
        if (canSee) {
          this._patrolCalmTime = 0;
          this.enterSuspicious();
        } else if (this.stateTimer >= this._idleDuration) {
          // Idle done — flip direction and resume patrol
          this.direction *= -1;
          this.setFlipX(this.direction === -1);
          this.state = 'PATROL';
          this.stateTimer = 0;
          this._patrolWalkTime = 0;
          this._nextMidPatrolIdle = 4000 + Math.random() * 4000;
          this.play('cop_walk');
          this.setVelocityX(COP.SPEED * this.direction);
        }
        break;

      case 'SUSPICIOUS':
        // Stop and watch — turn towards player
        this.setVelocityX(0);
        // Don't interrupt notice animation — only switch to alert stand after it completes
        if (this.anims.currentAnim?.key !== 'cop_stand' && this.anims.currentAnim?.key !== 'cop_notice') {
          this.play('cop_stand');
        }
        this._facePoint(this.lastSeenX);
        this.drawDetectionZone(0xff8800, 0.12);
        this.stateTimer += delta;

        if (canSee) {
          this._suspLostTime = 0;
          this._suspSeenTime = (this._suspSeenTime || 0) + delta;
          if (this._suspSeenTime >= COP.SUSPICIOUS_TIME) {
            this.enterChase();
          }
        } else {
          // Grace period — don't snap back instantly
          this._suspLostTime = (this._suspLostTime || 0) + delta;
          if (this._suspLostTime > 800) {
            // Lost sight — look around then return to patrol
            this.enterInvestigate();
          }
        }
        break;

      case 'CHASE':
        // Switch to baton-hit animation when very close to player
        {
          const closeDist = player ? Math.abs(player.x - this.x) : 999;
          const closeY = player ? Math.abs(player.y - this.y) : 999;
          const isClose = closeDist < 55 && closeY < 50;

          if (isClose && player) {
            // Close enough to hit — stop moving, face player with dead zone to prevent flipping
            this.setVelocityX(0);
            // Only change direction if player is clearly to one side (>10px dead zone)
            const hitDx = player.x - this.x;
            if (Math.abs(hitDx) > 10) {
              const newDir = hitDx > 0 ? 1 : -1;
              if (newDir !== this.direction) {
                this.direction = newDir;
                this.setFlipX(this.direction === -1);
              }
            }
            if (this.anims.currentAnim?.key !== 'cop_hit') this.play('cop_hit');
          } else {
            // Still chasing — run towards player
            this._facePoint(this.lastSeenX);
            this._moveTowards(this.lastSeenX);
            if (this.anims.currentAnim?.key !== 'cop_walk') this.play('cop_walk');
          }
        }
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

        // Grace period — cop is "focused on searching" and less alert
        // Don't react to player for the first 1.2s of investigation,
        // and NEVER interrupt the look animation once it starts.
        {
          const graceOver = this.stateTimer > 1200;
          const lookingAround = this._investigateArrived;
          if (canSee && graceOver && !lookingAround) {
            // Found again while walking — resume chase
            this.enterChase();
          } else if (!this._investigateArrived && this.stateTimer >= 8000) {
            // Safety timeout only while walking — never interrupt look animation
            this.returnToPatrol();
          }
        }
        // Once arrived, cop_look animationcomplete handles exit to patrol
        break;

      case 'ALERT':
        break;
    }
  }

  // --- PATROL ---
  patrol(delta) {
    // Mid-patrol idle: cop sometimes stops mid-walk to look around
    this._patrolWalkTime += delta;
    if (this._patrolWalkTime >= this._nextMidPatrolIdle) {
      this._patrolWalkTime = 0;
      this._nextMidPatrolIdle = 4000 + Math.random() * 4000;
      this.enterPatrolIdle();
      return;
    }

    let wantFlip = false;
    let atEndpoint = false;

    if (this.x <= this.patrolLeft && this.direction === -1) {
      wantFlip = true;
      atEndpoint = true;
    } else if (this.x >= this.patrolRight && this.direction === 1) {
      wantFlip = true;
      atEndpoint = true;
    }

    if (!wantFlip && this.body.blocked.down) {
      const probeX = this.x + this.direction * (this.body.halfWidth + 4);
      const probeY = this.body.bottom + 6;
      if (!this._hasGroundAt(probeX, probeY)) {
        wantFlip = true;
        atEndpoint = true;
      }
    }

    if (wantFlip && this._dirCooldown <= 0) {
      // Always idle at endpoint before turning
      this.enterPatrolIdle();
      return;
    }

    this.setVelocityX(COP.SPEED * this.direction);
    if (this.anims.currentAnim?.key !== 'cop_walk') this.play('cop_walk');
  }

  enterPatrolIdle() {
    this.state = 'PATROL_IDLE';
    this.stateTimer = 0;
    this.setVelocityX(0);

    // 40% chance to play look_P (looking around), 60% casual idle
    if (Math.random() < 0.4) {
      this.play('cop_look');
      this._idleDuration = 2200; // cop_look is 24 frames @ 12fps ≈ 2s
    } else {
      this.play('cop_idle');
      this._idleDuration = 1500 + Math.random() * 1500; // 1.5–3s
    }
  }

  // --- STATE TRANSITIONS ---
  enterSuspicious() {
    console.log('[COP] enterSuspicious, noticePlayed:', this._noticePlayed);
    this.state = 'SUSPICIOUS';
    this.stateTimer = 0;
    this._suspSeenTime = 0;
    this._suspLostTime = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('?');
    this.alertMark.setStyle({ fill: '#ffff00' });
    this.setTint(0xffaa00);
    this.setVelocityX(0);
    // Play notice reaction only once per encounter
    if (!this._noticePlayed) {
      this._noticePlayed = true;
      this.play('cop_notice');
      this.once('animationcomplete-cop_notice', () => {
        if (this.state === 'SUSPICIOUS') {
          this.play('cop_stand');
        }
      });
    } else {
      this.play('cop_stand');
    }
  }

  enterChase() {
    console.log('[COP] enterChase');
    this.state = 'CHASE';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff6600' });
    this.setTint(COP.ALERT_COLOR);
  }

  enterInvestigate() {
    console.log('[COP] enterInvestigate, lastSeenX:', this.lastSeenX, 'copX:', this.x);
    this.state = 'INVESTIGATE';
    this.stateTimer = 0;
    this._investigateTurns = 0;
    this._investigateArrived = false;
    this.alertMark.setText('?');
    this.alertMark.setStyle({ fill: '#ff8800' });
  }

  enterAlert(player) {
    this.state = 'ALERT';
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff3333' });
    this.setVelocityX(0);
    // Play baton hit animation when catching the player
    this.play('cop_hit');
    this.scene.events.emit('player-caught');
  }

  returnToPatrol() {
    console.log('[COP] returnToPatrol');
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this._patrolCalmTime = 0;
    this._patrolWalkTime = 0;
    this._nextMidPatrolIdle = 4000 + Math.random() * 4000;
    this.alertMark.setVisible(false);
    this.clearTint();
    this.play('cop_walk');
    this.setVelocityX(COP.SPEED * this.direction);
  }

  resetState() {
    // After catching player — go straight to CHASE (skip notice/suspicious).
    // Cop already knows where player is, no need to "discover" again.
    this.state = 'CHASE';
    this.stateTimer = 0;
    this.chaseSeenTime = 0;
    this._dirCooldown = 0;
    this._noticePlayed = true;   // keep notice blocked — will reset after 3s calm patrol
    this._patrolCalmTime = 0;
    this.alertMark.setVisible(true);
    this.alertMark.setText('!');
    this.alertMark.setStyle({ fill: '#ff6600' });
    this.setTint(COP.ALERT_COLOR);
    this.play('cop_walk');
  }

  // --- INVESTIGATE: walk to last known pos, play look animation, return to patrol ---
  _investigate(delta) {
    const dx = this.lastSeenX - this.x;
    const dist = Math.abs(dx);

    if (!this._investigateArrived && dist > 30) {
      // Walk towards last seen position
      this._facePoint(this.lastSeenX);
      this._moveTowards(this.lastSeenX, COP.SPEED * 0.7);
      if (this.anims.currentAnim?.key !== 'cop_walk') this.play('cop_walk');
    } else if (!this._investigateArrived) {
      // Close enough or already at position — stop and play look animation
      this._investigateArrived = true;
      console.log('[COP] Arrived at lastSeenX, playing cop_look. dist:', Math.round(dist));
      this.setVelocityX(0);
      this.play('cop_look');
      // Safety: remove any stale listeners first
      this.off('animationcomplete-cop_look');
      this.once('animationcomplete-cop_look', () => {
        console.log('[COP] cop_look COMPLETE → returnToPatrol');
        if (this.state === 'INVESTIGATE') {
          this.returnToPatrol();
        }
      });
      // Safety fallback — if animationcomplete never fires (e.g., animation issue)
      // return to patrol after 3 seconds
      this._lookFallbackTimer = 3000;
    } else {
      // Waiting for look animation to finish
      this.setVelocityX(0);
      // Ensure cop_look is still playing (not overridden)
      if (this.anims.currentAnim?.key !== 'cop_look') {
        this.play('cop_look');
      }
      // Fallback timer in case animationcomplete doesn't fire
      if (this._lookFallbackTimer !== undefined) {
        this._lookFallbackTimer -= delta;
        if (this._lookFallbackTimer <= 0) {
          console.log('[COP] cop_look FALLBACK timeout → returnToPatrol');
          this._lookFallbackTimer = undefined;
          if (this.state === 'INVESTIGATE') {
            this.returnToPatrol();
          }
        }
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
    // Normal forward detection
    if (inFront && dist < COP.DETECTION_RANGE && dy < 80) return true;
    // Behind detection — cop senses player close behind (hearing/peripheral)
    // Disabled during INVESTIGATE — cop is focused on searching the area
    if (this.state !== 'INVESTIGATE') {
      const behindRange = 80;
      if (!inFront && dist < behindRange && dy < 60) return true;
    }
    return false;
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
    // Detection cone hidden — cop still detects player, just no visual triangle
  }

  destroy() {
    this.detectionCone.destroy();
    this.alertMark.destroy();
    super.destroy();
  }
}
