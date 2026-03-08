import Phaser from 'phaser';
import { PLAYER, PAINT } from '../config/gameConfig.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, touchControls) {
    super(scene, x, y, 'player_sheet', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.touch = touchControls || null;

    this.setCollideWorldBounds(true);

    // Physics body — smaller than visual frame for tight collisions
    this.body.setSize(PLAYER.BODY_W, PLAYER.BODY_H);
    this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);

    // State
    this.isHidden = false;
    this.isClimbing = false;
    this.onLadder = false;
    this.isPainting = false;
    this.isDroppingToLadder = false;  // dropping through platform onto ladder
    this.ladderCooldown = 0;          // frames to wait before re-entering ladder
    this.isPushingLadder = false;     // grabbing and pushing a ladder left/right
    this.pushLadderInfo = null;       // reference to ladder data {visual, zone, minX, maxX, ...}
    this.pushLadderDx = 0;            // dx to move ladder this frame (consumed by GameScene)
    this.isPushingTrash = false;      // true when actively pushing a trash can with E
    this.isClimbing2 = false;         // true during ledge climb animation onto platform
    // Paint inventory: { red: 2, blue: 1, ... } — counts per color
    this.inventory = { red: 0, blue: 0, yellow: 0, green: 0 };
    this.paintedCount = 0;

    // Animation state tracking (prevents restarting same anim)
    this.currentAnim = '';

    // Climb manual frame control (ping-pong: 0→18→0→18...)
    this.climbFrameIndex = 0;        // float — fractional frame position
    this.climbTotalFrames = PLAYER.TOTAL_CLIMB_FRAMES; // 19
    this.climbAnimSpeed = PLAYER.CLIMB_ANIM_SPEED;     // frames per game-frame
    this.climbDirection = 1;         // +1 = forward, -1 = backward (ping-pong)

    // Hidden indicator
    this.hiddenIcon = scene.add.sprite(x, y - 34, 'hidden_icon')
      .setVisible(false)
      .setDepth(10);

    // Dust particles on landing
    this.wasInAir = false;
    this.fallVelocity = 0; // track velocity at moment of landing

    // Controls
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);  // paint = SPACE
    this.grabKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);          // ladder push = E
    this.wasdKeys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Start with idle animation
    this.playAnim('player_idle');
  }

  // === ANIMATION HELPER ===
  // All animations now live on a single unified spritesheet — no texture switching needed
  playAnim(key, ignoreIfPlaying = true) {
    if (this.currentAnim === key && ignoreIfPlaying) return;
    // Remove push Y shift if returning from push animation
    if (this._pushYShift) {
      this.y -= this._pushYShift;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
      this._pushYShift = 0;
    }
    this.currentAnim = key;
    this.anims.play(key, true);
  }

  playPushAnim() {
    if (this.currentAnim === 'player_push') return;
    // Shift sprite down visually but keep physics body in place
    if (!this._pushYShift) {
      this._pushYShift = 2;
      this.y += 2;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y - 2);
    }
    this.currentAnim = 'player_push';
    this.anims.play('player_push', true);
  }

  playClimb2Anim(platformTopY) {
    if (this.isClimbing2) return;
    this.isClimbing2 = true;
    // Snap hands (top of sprite content) to platform top edge
    // With 90px frame, bottom-aligned content: hands near top of content
    const handsOffset = 25;
    this._climb2StartY = platformTopY + handsOffset;  // hands touch platform top
    this.y = this._climb2StartY;
    this._climb2EndY = platformTopY - PLAYER.BODY_H / 2 - PLAYER.BODY_OFFSET_Y + 10;
    this._climb2Progress = 0;
    // Disable physics body entirely — no collision, no gravity, no sync fighting
    this.body.enable = false;
    // Remove push shift if active
    if (this._pushYShift) {
      this.y -= this._pushYShift;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
      this._pushYShift = 0;
    }
    this.currentAnim = 'player_climb2';
    this.anims.play('player_climb2', true);
    // When animation completes, re-enable body and place on platform
    this.once('animationcomplete-player_climb2', () => {
      this.isClimbing2 = false;
      this.y = this._climb2EndY;
      // Re-enable body and sync position
      this.body.enable = true;
      this.body.allowGravity = true;
      this.body.reset(this.x, this.y);
      this.currentAnim = '';
      this.playAnim('player_idle');
    });
  }

  update() {
    // === Climb2 animation playing — body disabled, only sprite moves ===
    if (this.isClimbing2) {
      // Smoothly interpolate Y from start to end over animation duration
      this._climb2Progress += 0.05;  // ~20 frames at 60fps = full animation
      if (this._climb2Progress > 1) this._climb2Progress = 1;
      // Ease-in-out for smooth motion
      const t = this._climb2Progress;
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;
      // Only travel half the distance during animation — the rest snaps at the end
      const halfwayY = this._climb2StartY + (this._climb2EndY - this._climb2StartY) * 0.5;
      this.y = this._climb2StartY + (halfwayY - this._climb2StartY) * ease;
      this.updateHiddenIcon();
      return;
    }

    // === Active painting mode — player frozen, hand moves ===
    if (this.isPainting) {
      this.setVelocity(0, 0);
      this.updatePaintingOverlay();
      this.updateHiddenIcon();
      return;
    }

    // === Ladder push mode ===
    if (this.isPushingLadder) {
      this.updateLadderPush();
      this.updateHiddenIcon();
      return;
    }

    // Tick ladder cooldown
    if (this.ladderCooldown > 0) this.ladderCooldown--;

    const t = this.touch;
    const left = this.cursors.left.isDown || this.wasdKeys.left.isDown || (t && t.left);
    const right = this.cursors.right.isDown || this.wasdKeys.right.isDown || (t && t.right);
    const up = this.cursors.up.isDown || this.wasdKeys.up.isDown || (t && t.up);
    const down = this.cursors.down.isDown || this.wasdKeys.down.isDown || (t && t.down);
    const jumpRaw = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.up) || (t && t.jumpJustPressed);
    // Don't jump with UP right after exiting a ladder (prevents unwanted jump at top)
    const jump = jumpRaw && this.ladderCooldown <= 0;

    const onGround = this.body.blocked.down;

    // === Landing detection (dust effect) ===
    if (onGround && this.wasInAir) {
      const impact = Math.min(this.fallVelocity / 400, 1); // 0-1 intensity based on fall speed
      this.spawnLandingDust(impact);
      if (this.scene.sfx) this.scene.sfx.land(impact);
    }
    if (!onGround && !this.isClimbing) {
      this.fallVelocity = Math.max(this.fallVelocity, this.body.velocity.y);
    } else {
      this.fallVelocity = 0;
    }
    this.wasInAir = !onGround && !this.isClimbing;

    // === Climb2: ledge grab — head hits side of platform while jumping ===
    // Player is in the air BESIDE a platform, head reaches platform level → grab edge
    if (!onGround && !this.isClimbing && !this.isPushingTrash && !this.isClimbing2 && this.ladderCooldown <= 0) {
      const playerHeadY = this.body.y;                   // top of player body
      const playerLeft = this.body.x;
      const playerRight = this.body.x + this.body.width;
      const platforms = this.scene.platforms ? this.scene.platforms.getChildren() : [];
      const grabRange = 15;   // how close to platform edge horizontally
      const headRange = 25;   // vertical tolerance — head near platform top

      for (const plat of platforms) {
        const platTop = plat.body.y;
        const platBottom = plat.body.y + plat.body.height;
        const platLeft = plat.body.x;
        const platRight = plat.body.x + plat.body.width;

        // Head must be near platform top (between platTop-headRange and platTop+headRange)
        const headDist = Math.abs(playerHeadY - platTop);
        if (headDist > headRange) continue;

        // Player must be BESIDE the platform, not under or on top
        // Check left edge: player is to the left of platform, close to its left edge
        const nearLeftEdge = playerRight >= platLeft - grabRange && playerRight <= platLeft + 10;
        // Check right edge: player is to the right of platform, close to its right edge
        const nearRightEdge = playerLeft <= platRight + grabRange && playerLeft >= platRight - 10;

        if (nearLeftEdge || nearRightEdge) {
          // Snap player X so hands land at platform corner (outer edge)
          if (nearLeftEdge) {
            this.x = platLeft;
          } else {
            this.x = platRight;
          }
          this.playClimb2Anim(platTop);
          this.updateHiddenIcon();
          return;
        }
      }
    }

    // === Climbing ===
    if (this.isClimbing) {
      this.body.allowGravity = false;

      // Clear drop-through flag once player has passed below the platform
      if (this.isDroppingToLadder && this.y > this.dropPlatformY + 40) {
        this.isDroppingToLadder = false;
      }

      // Use climb frames from unified sheet (frames CLIMB_FRAME_START to CLIMB_FRAME_START+18)
      if (this.currentAnim !== '_climb_manual') {
        this.anims.stop();
        this.setFrame(PLAYER.CLIMB_FRAME_START + Math.floor(this.climbFrameIndex));
        this.currentAnim = '_climb_manual';
      }

      // Snap to ladder center smoothly
      const dx = this.ladderX - this.x;
      if (Math.abs(dx) > 1) {
        this.setVelocityX(dx * 8);
      } else {
        this.x = this.ladderX;
        this.setVelocityX(0);
      }

      // Manual frame control — synced with keyboard
      // UP = frames forward (climb up faster), DOWN = frames backward
      const maxFrame = this.climbTotalFrames - 1;
      const CLIMB_UP_SPEED = PLAYER.CLIMB_SPEED * 1.5;  // 50% faster going up
      if (up) {
        this.setVelocityY(-CLIMB_UP_SPEED);
        this.climbFrameIndex += this.climbAnimSpeed * 1.5;
        if (this.climbFrameIndex > maxFrame) this.climbFrameIndex = 0;
      } else if (down) {
        this.setVelocityY(PLAYER.CLIMB_SPEED);
        this.climbFrameIndex -= this.climbAnimSpeed;
        if (this.climbFrameIndex < 0) this.climbFrameIndex = maxFrame;
      } else {
        this.setVelocityY(0);
      }

      // Apply current frame to sprite (offset by CLIMB_FRAME_START)
      this.setFrame(PLAYER.CLIMB_FRAME_START + Math.floor(this.climbFrameIndex));

      // Jump off ladder only with SPACE (not UP — UP continues climbing)
      const spaceJump = Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        (this.touch && this.touch.jumpJustPressed);
      if (spaceJump) {
        this.exitLadder();
        this.setVelocityY(PLAYER.JUMP_VELOCITY);
        this.playAnim('player_jump');
        this.spawnJumpDust();
        this.updateHiddenIcon();
        return;
      }

      // Left/right to dismount ladder
      if (left && !up && !down) {
        this.exitLadder();
        this.setVelocityX(-PLAYER.SPEED);
        this.setFlipX(true);
      } else if (right && !up && !down) {
        this.exitLadder();
        this.setVelocityX(PLAYER.SPEED);
        this.setFlipX(false);
      }

      // Auto-dismount at top: when player's feet are well above the ladder top
      // ladderTopY is where the platform sits, so feet must clear the platform (32px thick)
      const playerFeetY = this.y + PLAYER.BODY_H / 2;
      const clearanceAbovePlatform = 36; // platform thickness + margin
      if (up && this.ladderTopY && playerFeetY <= this.ladderTopY - clearanceAbovePlatform) {
        // Position player precisely on the platform surface
        this.y = this.ladderTopY - PLAYER.BODY_H / 2 - PLAYER.BODY_OFFSET_Y;
        this.exitLadder();
        this.setVelocityY(0);
        this.setVelocityX(0);
        this.playAnim('player_idle');
        this.updateHiddenIcon();
        return;
      }

      // Auto-dismount at bottom: reached ground while climbing down
      if (this.body.blocked.down && down) {
        this.exitLadder();
        this.playAnim('player_idle');
      }

      this.updateHiddenIcon();
      return;
    }

    // === Normal movement ===
    this.body.allowGravity = true;

    // === Enter ladder: UP while near ladder ===
    // Works from ground OR mid-air (grab ladder while jumping/falling)
    // Don't grab ladder with UP if standing on the platform at the top of the ladder
    const playerFeetAtTop = this.ladderTopY && (this.y + PLAYER.BODY_H / 2) <= this.ladderTopY + 10;
    if (this.onLadder && up && this.ladderCooldown <= 0 && !playerFeetAtTop) {
      this.isClimbing = true;
      this.climbFrameIndex = 0;
      this.body.allowGravity = false;
      this.setVelocityX(0);
      this.setVelocityY(-PLAYER.CLIMB_SPEED);
      this.setFlipX(false);
      this.anims.stop();
      this.setFrame(PLAYER.CLIMB_FRAME_START);
      this.currentAnim = '_climb_manual';
      this.updateHiddenIcon();
      return;
    }

    // === Enter ladder: DOWN while near ladder ===
    if (this.onLadder && down && onGround && this.ladderCooldown <= 0) {
      this.isClimbing = true;
      this.isDroppingToLadder = true;  // disable platform collision until below platform
      this.dropPlatformY = this.y;     // remember platform Y to know when we're past it
      this.climbFrameIndex = this.climbTotalFrames - 1;
      this.climbDirection = -1;  // start in reverse for descending
      this.body.allowGravity = false;
      this.setVelocityX(0);
      this.setVelocityY(PLAYER.CLIMB_SPEED);
      this.setFlipX(false);
      this.anims.stop();
      this.setFrame(PLAYER.CLIMB_FRAME_START + Math.floor(this.climbFrameIndex));
      this.currentAnim = '_climb_manual';
      this.updateHiddenIcon();
      return;
    }

    // === Movement with inertia ===
    const accel = this.isPushingTrash ? 600 : 1200;
    const maxSpd = this.isPushingTrash ? PLAYER.SPEED * 0.4 : PLAYER.SPEED;
    const friction = 800;
    const vx = this.body.velocity.x;

    if (left) {
      this.body.setAccelerationX(-accel);
      this.body.setMaxVelocityX(maxSpd);
      this.setFlipX(true);
      if (onGround) {
        if (this.isPushingTrash) {
          this.playPushAnim();
        } else if (vx > 30) {
          this.playAnim('player_idle');
        } else {
          this.playAnim('player_walk');
        }
      }
    } else if (right) {
      this.body.setAccelerationX(accel);
      this.body.setMaxVelocityX(maxSpd);
      this.setFlipX(false);
      if (onGround) {
        if (this.isPushingTrash) {
          this.playPushAnim();
        } else if (vx < -30) {
          this.playAnim('player_idle');
        } else {
          this.playAnim('player_walk');
        }
      }
    } else {
      // No input — apply friction to slow down
      this.body.setAccelerationX(0);
      if (onGround) {
        if (Math.abs(vx) > 10) {
          this.body.setDragX(friction);
        } else {
          this.setVelocityX(0);
          this.body.setDragX(0);
        }
        if (this.isPushingTrash) {
          this.playPushAnim();
        } else {
          this.playAnim('player_idle');
        }
      }
    }

    // === Ladder push grab is now handled by GameScene (unified E key logic) ===

    // === Jump ===
    if (jump && onGround) {
      this.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.playAnim('player_jump');
      this.spawnJumpDust();
      if (this.scene.sfx) this.scene.sfx.jump();
    }

    // === Air animations ===
    if (!onGround && !this.isPushingTrash && this.ladderCooldown <= 0) {
      if (this.body.velocity.y < 0) {
        this.playAnim('player_jump');
      } else if (this.body.velocity.y > 50) {
        this.playAnim('player_fall');
      }
    }

    this.updateHiddenIcon();
  }

  // === PARTICLE EFFECTS ===

  spawnJumpDust() {
    const feetY = this.y + this.body.halfHeight;
    for (let i = 0; i < 3; i++) {
      const dust = this.scene.add.circle(
        this.x + Phaser.Math.Between(-8, 8),
        feetY,
        Phaser.Math.Between(2, 4),
        0x888899, 0.5
      ).setDepth(4);

      this.scene.tweens.add({
        targets: dust,
        y: dust.y + Phaser.Math.Between(5, 15),
        x: dust.x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 400,
        onComplete: () => dust.destroy()
      });
    }
  }

  spawnLandingDust(impact = 0.3) {
    const count = Math.floor(3 + impact * 12); // 3-15 particles based on impact
    const spread = 10 + impact * 20;           // wider spread on hard landing
    const maxSize = 3 + impact * 5;            // bigger particles on hard landing

    const feetY = this.body.y + this.body.height; // actual bottom edge of physics body
    for (let i = 0; i < count; i++) {
      const dust = this.scene.add.circle(
        this.x + Phaser.Math.Between(-spread, spread),
        feetY,
        Phaser.Math.Between(2, maxSize),
        0x888899, 0.4 + impact * 0.4
      ).setDepth(4);

      this.scene.tweens.add({
        targets: dust,
        y: dust.y - Phaser.Math.Between(3, 8 + impact * 15),
        x: dust.x + Phaser.Math.Between(-spread, spread),
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 400 + impact * 300,
        onComplete: () => dust.destroy()
      });
    }
  }

  // === ACTIVE PAINT SYSTEM ===

  startActivePainting(spotBounds, paintColor, onComplete, onCancel) {
    this.isPainting = true;
    this.paintBounds = spotBounds;
    this.paintColor = paintColor || 0xff3344;
    this.paintOnComplete = onComplete;
    this.paintOnCancel = onCancel;
    this.paintParticleTimer = 0;

    // Freeze player: stop movement, disable gravity, play paint loop
    this.setVelocity(0, 0);
    this.body.setAccelerationX(0);
    this.body.allowGravity = false;
    this.currentAnim = 'player_paint_loop';
    this.anims.play('player_paint_loop', true);
  }

  // Called from update() — in paint mode, player is frozen, only hand moves
  updatePaintingOverlay() {
    if (!this.isPainting) return;

    // Cancel painting with SPACE or touch ACT
    const cancelPressed = Phaser.Input.Keyboard.JustDown(this.interactKey) ||
      (this.touch && this.touch.actionJustPressed);
    if (cancelPressed) {
      const cb = this.paintOnCancel;
      this.stopPainting();
      if (cb) cb();
      return;
    }

    // Hand movement is handled by PaintArm in GameScene
    // PaintArm emits 'paint-move' events with hand position
  }

  spawnPaintSpray(x, y) {
    const color = this.paintColor;
    const px = x + Phaser.Math.Between(-4, 4);
    const py = y + Phaser.Math.Between(-4, 4);
    const size = Phaser.Math.Between(1, 3);
    const dot = this.scene.add.circle(px, py, size, color, 0.7).setDepth(3.5);

    this.scene.tweens.add({
      targets: dot,
      x: dot.x + Phaser.Math.Between(-8, 8),
      y: dot.y + Phaser.Math.Between(-8, 8),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(200, 400),
      onComplete: () => dot.destroy()
    });
  }

  finishPainting() {
    const cb = this.paintOnComplete;
    this.stopPainting();
    if (cb) cb();
  }

  stopPainting() {
    this.isPainting = false;
    this.paintBounds = null;
    this.paintOnComplete = null;
    this.paintOnCancel = null;
    // Restore physics
    this.body.allowGravity = true;
    this.currentAnim = '';
    this.playAnim('player_idle');
  }

  // === LADDER PUSH ===

  startLadderPush() {
    this.isPushingLadder = true;
    this.pushLadderInfo = this.nearbyLadderInfo;
    this.pushLadderDx = 0;

    // Stop movement, stay on ground
    this.setVelocity(0, 0);
    this.body.setAccelerationX(0);

    // Show first frame of paint/turn animation (grabbing pose)
    this.anims.stop();
    this.setFrame(PLAYER.TURN_FRAME_START);
    this.currentAnim = '';
  }

  updateLadderPush() {
    const t = this.touch;
    const left = this.cursors.left.isDown || this.wasdKeys.left.isDown || (t && t.left);
    const right = this.cursors.right.isDown || this.wasdKeys.right.isDown || (t && t.right);
    const release = Phaser.Input.Keyboard.JustDown(this.grabKey) || (t && t.eJustPressed);

    // Release ladder with E
    if (release) {
      this.stopLadderPush();
      return;
    }

    // Push ladder left/right
    const pushSpeed = 60; // px/s — slower than walking
    const dt = this.scene.game.loop.delta / 1000;
    if (left) {
      this.pushLadderDx = -pushSpeed * dt;
      this.setFlipX(true);
    } else if (right) {
      this.pushLadderDx = pushSpeed * dt;
      this.setFlipX(false);
    } else {
      this.pushLadderDx = 0;
    }

    // Keep player grounded
    this.setVelocityX(0);
  }

  stopLadderPush() {
    this.isPushingLadder = false;
    this.pushLadderInfo = null;
    this.pushLadderDx = 0;
    this.currentAnim = '';
    this.anims.resume();
    this.playAnim('player_idle');
  }

  // === LADDER ===

  exitLadder() {
    this.isClimbing = false;
    this.isDroppingToLadder = false;
    this.ladderCooldown = 15;  // ignore ladder for 15 frames after dismount
    this.body.allowGravity = true;
    this.currentAnim = ''; // force anim refresh
    this.anims.resume();
  }

  // === STATE ===

  updateHiddenIcon() {
    this.hiddenIcon.setPosition(this.x, this.y - 34);
    this.hiddenIcon.setVisible(this.isHidden);

    if (this.isHidden) {
      this.setAlpha(0.4);
      this.setTint(0x334455);
    } else {
      this.setAlpha(1);
      this.clearTint();
    }
  }

  setOnLadder(isOn, ladderCenterX, ladderTopY, ladderInfo) {
    const wasOnLadder = this.onLadder;
    this.onLadder = isOn;

    if (isOn) {
      this.ladderX = ladderCenterX;
      this.ladderTopY = ladderTopY;
      this.nearbyLadderInfo = ladderInfo || null;
      this.ladderGraceFrames = 0;
    }

    // When climbing but no longer overlapping ladder zone,
    // use a grace period to avoid flickering exits.
    // Don't force-exit here — let the auto-dismount in update() handle
    // clean exits at top/bottom. Grace just keeps onLadder=true temporarily.
    if (!isOn && this.isClimbing) {
      this.ladderGraceFrames = (this.ladderGraceFrames || 0) + 1;
      if (this.ladderGraceFrames > 8) {
        // Only force-exit if we've been off the ladder for many frames
        // (e.g. pushed off by something unusual)
        this.exitLadder();
      } else {
        // Keep climbing during grace period
        this.onLadder = true;
      }
    }
  }

  setHidden(hidden) {
    this.isHidden = hidden;
  }

  collectPaint(colorName) {
    const key = colorName.toLowerCase();
    this.inventory[key] = (this.inventory[key] || 0) + 1;
  }

  hasPaint(colorName) {
    return (this.inventory[colorName.toLowerCase()] || 0) > 0;
  }

  hasAllColors(colorList) {
    return colorList.every(c => this.hasPaint(c));
  }

  usePaint(colorName) {
    const key = colorName.toLowerCase();
    if ((this.inventory[key] || 0) > 0) {
      this.inventory[key]--;
      this.paintedCount++;
      return true;
    }
    return false;
  }

  useColors(colorList) {
    colorList.forEach(c => this.usePaint(c));
  }

  getPaintCount(colorName) {
    return this.inventory[colorName.toLowerCase()] || 0;
  }

  die(checkpointX, checkpointY) {
    this.scene.cameras.main.shake(200, 0.01);
    this.scene.cameras.main.flash(300, 255, 50, 50);
    this.setPosition(checkpointX, checkpointY);
    this.setVelocity(0, 0);
    this.isClimbing = false;
    this.isDroppingToLadder = false;
    this.isPainting = false;
    this.isPushingLadder = false;
    this.pushLadderInfo = null;
    this.isPushingTrash = false;
    this.isClimbing2 = false;
    this._pushYShift = 0;
    this.body.allowGravity = true;
    this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
    this.playAnim('player_idle');
  }
}
