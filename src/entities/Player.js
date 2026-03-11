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
    this.nearPaintSpot = false;       // set by GameScene when near interactable paint spot
    this.isDroppingToLadder = false;  // dropping through platform onto ladder
    this.ladderCooldown = 0;          // frames to wait before re-entering ladder
    this._ladderDownHoldFrames = 0;   // frames DOWN held near ladder — require deliberate hold to enter
    this.isPushingLadder = false;     // grabbing and pushing a ladder left/right
    this.pushLadderInfo = null;       // reference to ladder data {visual, zone, minX, maxX, ...}
    this.pushLadderDx = 0;            // dx to move ladder this frame (consumed by GameScene)
    this._droppingThroughBridge = false; // true briefly when dropping through a bridge plank
    this.isPushingTrash = false;      // true when actively pushing a trash can with E
    this.isClimbing2 = false;         // true during ledge climb animation onto platform
    this.isHiding = false;            // true when actively crouching in shadow zone
    this.isUnhiding = false;          // true during stand-up reverse animation
    this.inShadowZone = false;        // set by GameScene — player overlaps shadow zone this frame
    // Health
    this.hp = PLAYER.MAX_HP;
    this.maxHp = PLAYER.MAX_HP;
    this._invincibleUntil = 0; // timestamp — immune to damage until this time

    // Paint inventory: { red: 2, blue: 1, ... } — counts per color
    this.inventory = { red: 0, blue: 0, yellow: 0, green: 0 };
    this.paintedCount = 0;

    // Animation state tracking (prevents restarting same anim)
    this.currentAnim = '';

    // Idle twist timer — plays twist animation after IDLE_TWIST_DELAY ms of no input
    this.idleTimer = 0;
    this.isTwisting = false;

    // Climb manual frame control (ping-pong: 0→18→0→18...)
    this.climbFrameIndex = 0;        // float — fractional frame position
    this.climbTotalFrames = PLAYER.TOTAL_CLIMB_FRAMES; // 19
    this.climbAnimSpeed = PLAYER.CLIMB_ANIM_SPEED;     // frames per game-frame
    this.climbDirection = 1;         // +1 = forward, -1 = backward (ping-pong)

    // Hidden indicator (disabled — no icon above player)
    this.hiddenIcon = { setPosition() {}, setVisible() {}, setAlpha() {}, destroy() {} };

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
    // Remove walk adjustments if leaving walk animation
    if (this._walkYShift && key !== 'player_walk') {
      this.y -= this._walkYShift;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
      this.setScale(1);
      this._walkYShift = 0;
    }
    // Apply walk adjustments — nudge down + scale up 1.5%
    if (key === 'player_walk' && !this._walkYShift) {
      this._walkYShift = 2;
      this.y += 2;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y - 2);
      this.setScale(1.015);
    }
    // Any non-idle/non-twist animation resets the idle twist timer
    if (key !== 'player_idle' && key !== 'player_twist') {
      this.idleTimer = 0;
      this.isTwisting = false;
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
    // Snap hands (top of content) to platform edge/corner
    // Content top at Y=35 in frame, frame center at 72 → offset = 72-35 = 37
    const handsOffset = 37;
    this._climb2StartY = platformTopY + handsOffset;  // hands grab platform edge
    this.y = this._climb2StartY;
    // End position: body bottom 2px above platform — gravity settles it down
    this._climb2EndY = platformTopY - PLAYER.BODY_OFFSET_Y - PLAYER.BODY_H + PLAYER.FRAME_H / 2 - 2;
    this._climb2Progress = 0;
    // Disable physics body entirely — no collision, no gravity, no sync fighting
    this.body.enable = false;
    // Remove push shift if active
    if (this._pushYShift) {
      this.y -= this._pushYShift;
      this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
      this._pushYShift = 0;
    }
    // Save start X for smooth X slide onto platform
    this._climb2StartX = this.x;
    this._climb2EndX = this.x + (this._climb2Dir || 1) * (PLAYER.BODY_W / 2 + 5);
    this.currentAnim = 'player_climb2';
    this.anims.play('player_climb2', true);
    // When animation completes, re-enable body and place on platform
    this.once('animationcomplete-player_climb2', () => {
      this.isClimbing2 = false;
      this.y = this._climb2EndY;
      this.x = this._climb2EndX;
      // Re-enable body and sync position
      this.body.enable = true;
      this.body.allowGravity = true;
      this.body.reset(this.x, this.y);
      // Cooldown prevents immediately re-triggering climb2
      this._climb2Cooldown = 30;
      this.currentAnim = '';
      this.playAnim('player_idle');
    });
  }

  update() {
    // Climb2 cooldown tick
    if (this._climb2Cooldown > 0) this._climb2Cooldown--;

    // === Climb2 animation playing — body disabled, only sprite moves ===
    if (this.isClimbing2) {
      // Smoothly interpolate Y from start to end over animation duration
      this._climb2Progress += 0.05;  // ~20 frames at 60fps = full animation
      if (this._climb2Progress > 1) this._climb2Progress = 1;
      // Ease-in-out for smooth motion
      const t = this._climb2Progress;
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) / 2;
      // Travel full distance during animation — no snap at the end
      this.y = this._climb2StartY + (this._climb2EndY - this._climb2StartY) * ease;
      // Slide X onto platform in last 30% of animation for smooth landing
      if (t > 0.7) {
        const xBlend = (t - 0.7) / 0.3;  // 0→1 over last 30%
        this.x = this._climb2StartX + (this._climb2EndX - this._climb2StartX) * xBlend;
      }
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

    // === Hiding in shadow mode ===
    if (this.isHiding) {
      this.updateHiding();
      this.updateHiddenIcon();
      return;
    }

    // === Unhiding (standing up from crouch) — frozen until animation completes ===
    if (this.isUnhiding) {
      this.setVelocity(0, 0);
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
    const anyInput = left || right || up || down || jump;

    // Cancel twist animation if any input detected
    if (this.isTwisting && anyInput) {
      this.isTwisting = false;
      this.idleTimer = 0;
      this.off('animationcomplete-player_twist');  // remove pending callback
      this.playAnim('player_idle', false);
    }

    // Reset idle timer when any input is pressed
    if (anyInput) {
      this.idleTimer = 0;
    }

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
    if (!onGround && !this.isClimbing && !this.isPushingTrash && !this.isClimbing2 && this.ladderCooldown <= 0 && (this._climb2Cooldown || 0) <= 0) {
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
            this._climb2Dir = 1;   // climbing from left → move right onto platform
          } else {
            this.x = platRight;
            this._climb2Dir = -1;  // climbing from right → move left onto platform
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

      // Jump off ladder — multiple options:
      // 1. SPACE (when not near paint spot) = jump UP off ladder
      // 2. LEFT/RIGHT + SPACE = side jump off ladder (works even near paint spot)
      // 3. DOWN + SPACE = drop down off ladder (works even near paint spot)
      const spaceJump = Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        (this.touch && this.touch.jumpJustPressed);

      if (spaceJump) {
        if (down) {
          // DOWN + SPACE = drop down from ladder
          this.exitLadder('drop-down');
          this.setVelocityY(PLAYER.CLIMB_SPEED * 2);  // fast drop
          this.setVelocityX(0);
          this.playAnim('player_jump');
          this.updateHiddenIcon();
          return;
        } else if (left) {
          // LEFT + SPACE = side jump left
          this.exitLadder('side-jump-left');
          this.setVelocityY(PLAYER.JUMP_VELOCITY * 0.7);
          this.setVelocityX(-PLAYER.SPEED);
          this.setFlipX(true);
          this.playAnim('player_jump');
          this.spawnJumpDust();
          this.updateHiddenIcon();
          return;
        } else if (right) {
          // RIGHT + SPACE = side jump right
          this.exitLadder('side-jump-right');
          this.setVelocityY(PLAYER.JUMP_VELOCITY * 0.7);
          this.setVelocityX(PLAYER.SPEED);
          this.setFlipX(false);
          this.playAnim('player_jump');
          this.spawnJumpDust();
          this.updateHiddenIcon();
          return;
        } else if (!this.nearPaintSpot) {
          // SPACE alone (no direction) = jump UP off ladder
          this.exitLadder('space-jump');
          this.setVelocityY(PLAYER.JUMP_VELOCITY);
          this.playAnim('player_jump');
          this.spawnJumpDust();
          this.updateHiddenIcon();
          return;
        }
      }

      // Left/right without SPACE = gentle dismount (walk off)
      if (left && !up && !down) {
        this.exitLadder('move-left');
        this.setVelocityX(-PLAYER.SPEED);
        this.setFlipX(true);
      } else if (right && !up && !down) {
        this.exitLadder('move-right');
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
        this.exitLadder('top-clearance');
        this.setVelocityY(0);
        this.setVelocityX(0);
        this.playAnim('player_idle');
        this.updateHiddenIcon();
        return;
      }

      // Auto-dismount onto platform: when descending, detect platform edges.
      // Platform collision is disabled during climbing, so we manually check feet vs platform tops.
      // Skip the platform we just dropped FROM (isDroppingToLadder handles that).
      // Also skip platform at ladder top (that's where we entered from).
      if (down && !this.isDroppingToLadder && this.scene.platforms) {
        const feetY = this.body.y + this.body.height;
        const bodyLeft = this.body.x;
        const bodyRight = this.body.x + this.body.width;
        // Check both platforms and ground blocks for landing
        const platforms = [
          ...this.scene.platforms.getChildren(),
          ...(this.scene.ground ? this.scene.ground.getChildren() : [])
        ];
        for (const plat of platforms) {
          const platTop = plat.body.y;
          const platLeft = plat.body.x;
          const platRight = platLeft + plat.body.width;
          // Skip platform at ladder top (the one we started descending from)
          if (this.ladderTopY && Math.abs(platTop - this.ladderTopY) < 5) continue;
          // Player must be horizontally over the platform
          if (bodyRight < platLeft + 4 || bodyLeft > platRight - 4) continue;
          // Feet reached or passed the platform top (generous range to catch fast movement)
          if (feetY >= platTop - 4 && feetY <= platTop + 20) {
            // Snap body bottom to platform top
            const snapY = platTop - PLAYER.BODY_H + PLAYER.FRAME_H / 2 - PLAYER.BODY_OFFSET_Y;
            this.y = snapY;
            this.exitLadder('platform-edge-descend');
            this.setVelocityY(0);
            this.setVelocityX(0);
            this.playAnim('player_idle');
            this.updateHiddenIcon();
            return;
          }
        }
      }

      // Auto-dismount at ladder bottom: stop climbing when feet reach ladder's bottomY
      if (down && this.ladderBottomY) {
        const feetY = this.body.y + this.body.height;
        if (feetY >= this.ladderBottomY) {
          // Snap to ladder bottom
          const snapY = this.ladderBottomY - PLAYER.BODY_H + PLAYER.FRAME_H / 2 - PLAYER.BODY_OFFSET_Y;
          this.y = snapY;
          this.exitLadder('ladder-bottom');
          this.setVelocityY(0);
          this.setVelocityX(0);
          this.playAnim('player_idle');
          this.updateHiddenIcon();
          return;
        }
      }

      // Auto-dismount at bottom: reached ground while climbing down
      if (this.body.blocked.down) {
        this.exitLadder('ground-contact');
        this.setVelocityY(0);
        this.playAnim('player_idle');
      }

      this.updateHiddenIcon();
      return;
    }

    // === Normal movement ===
    this.body.allowGravity = true;

    // === Hide in shadow: DOWN while stopped on ground in shadow zone (not on ladder) ===
    if (down && !left && !right && !up && onGround && this.inShadowZone && !this.onLadder && Math.abs(this.body.velocity.x) < 10) {
      this.startHiding();
      this.updateHiddenIcon();
      return;
    }

    // === Jump has HIGHEST priority — works regardless of d-pad direction ===
    if (jump && onGround) {
      this._ladderDownHoldFrames = 0;  // reset ladder hold counter
      this.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.playAnim('player_jump');
      this.spawnJumpDust();
      if (this.scene.sfx) this.scene.sfx.jump();
      this.updateHiddenIcon();
      return;
    }

    // === Enter ladder: UP while near ladder ===
    // Requires slow speed or stopped — prevents accidental grabs while running past
    // Mid-air grabs still allowed (falling onto ladder)
    // Don't grab ladder with UP if standing on the platform at the top of the ladder
    const playerFeetAtTop = this.ladderTopY && (this.y + PLAYER.BODY_H / 2) <= this.ladderTopY + 10;
    const absVxUp = Math.abs(this.body.velocity.x);
    const canGrabLadder = !onGround || absVxUp < PLAYER.SPEED * 0.6; // mid-air always OK, ground needs slow speed
    if (this.onLadder && up && this.ladderCooldown <= 0 && !playerFeetAtTop && canGrabLadder) {
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
    // Allow descent when walking slowly or stopped — block only while sprinting
    const absVx = Math.abs(this.body.velocity.x);
    const isWalking = absVx < PLAYER.SPEED * 0.6;  // under 60% max speed = walking/stopped
    if (this.onLadder && down && onGround && isWalking && this.ladderCooldown <= 0) {
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
        } else if (!this.isTwisting) {
          // Increment idle timer (roughly 1 per frame ≈ 16.7ms at 60fps)
          this.idleTimer++;
          const delayFrames = Math.round((PLAYER.IDLE_TWIST_DELAY || 5000) / 16.67);
          if (this.idleTimer >= delayFrames && this.currentAnim === 'player_idle') {
            this.isTwisting = true;
            this.playAnim('player_twist', false);
            this.once('animationcomplete-player_twist', () => {
              this.isTwisting = false;
              this.idleTimer = 0;
              this.playAnim('player_idle', false);
            });
          } else if (this.currentAnim !== 'player_idle') {
            this.playAnim('player_idle');
          }
        }
        // isTwisting — let twist animation play out, don't interrupt with idle
      }
    }

    // === Ladder push grab is now handled by GameScene (unified E key logic) ===

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
    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      const px = x + Phaser.Math.Between(-8, 8);
      const py = y + Phaser.Math.Between(-8, 8);
      const size = Phaser.Math.Between(1, 4);
      const dot = this.scene.add.circle(px, py, size, color, 0.8).setDepth(3.5);

      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-14, 14),
        y: dot.y + Phaser.Math.Between(-14, 14),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(250, 500),
        onComplete: () => dot.destroy()
      });
    }
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

    // Side idle: holding ladder, not moving yet
    this.currentAnim = '';
    this.playAnim('player_side_idle', false);
    console.log('startLadderPush → player_side_idle, frame:', PLAYER.SIDE_FRAME_START);
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
      if (this.currentAnim !== 'player_side_walk') console.log('push LEFT → player_side_walk');
      this.playAnim('player_side_walk');
    } else if (right) {
      this.pushLadderDx = pushSpeed * dt;
      this.setFlipX(false);
      if (this.currentAnim !== 'player_side_walk') console.log('push RIGHT → player_side_walk');
      this.playAnim('player_side_walk');
    } else {
      this.pushLadderDx = 0;
      this.playAnim('player_side_idle');
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

  exitLadder(reason) {
    console.log('exitLadder called, reason:', reason || 'unknown', 'y:', this.y, 'feetY:', this.body.y + this.body.height);
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
    // Alpha/tint handled by tweens in startHiding/stopHiding — no snap changes here
  }

  /** Gradually darken player when entering hide */
  _tweenDarken() {
    if (this._hideTween) this._hideTween.destroy();
    this._hideTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.4,
      duration: 400,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        // Interpolate tint from white (0xffffff) to dark (0x334455)
        const t = tween.progress;
        const r = Math.round(0xff + (0x33 - 0xff) * t);
        const g = Math.round(0xff + (0x44 - 0xff) * t);
        const b = Math.round(0xff + (0x55 - 0xff) * t);
        this.setTint((r << 16) | (g << 8) | b);
      }
    });
  }

  /** Gradually brighten player when exiting hide */
  _tweenBrighten() {
    if (this._hideTween) this._hideTween.destroy();
    // Get current alpha as starting point (in case interrupted mid-darken)
    const startAlpha = this.alpha;
    // Get current tint components
    const curTint = this.tintTopLeft || 0xffffff;
    const startR = (curTint >> 16) & 0xff;
    const startG = (curTint >> 8) & 0xff;
    const startB = curTint & 0xff;

    this._hideTween = this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 350,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.progress;
        const r = Math.round(startR + (0xff - startR) * t);
        const g = Math.round(startG + (0xff - startG) * t);
        const b = Math.round(startB + (0xff - startB) * t);
        this.setTint((r << 16) | (g << 8) | b);
      },
      onComplete: () => {
        this.clearTint();
        this.setAlpha(1);
      }
    });
  }

  setOnLadder(isOn, ladderCenterX, ladderTopY, ladderInfo) {
    const wasOnLadder = this.onLadder;
    this.onLadder = isOn;

    if (isOn) {
      this.ladderX = ladderCenterX;
      this.ladderTopY = ladderTopY;
      this.ladderBottomY = (ladderInfo && ladderInfo.bottomY) || null;
      this.nearbyLadderInfo = ladderInfo || null;
      this.ladderGraceFrames = 0;
    }

    // When climbing but no longer overlapping ladder zone,
    // DON'T force-exit — let the auto-dismount in update() handle clean exits
    // at top (feet above platform) or bottom (feet reach platform/ground).
    // Just keep onLadder=true so climbing continues smoothly until a platform is hit.
    if (!isOn && this.isClimbing) {
      // Keep climbing — auto-dismount in update() will detect platform edges
      this.onLadder = true;
      // No forced exit — player stays on ladder until:
      // 1. Feet reach a platform (platform-edge detection in update)
      // 2. Feet hit ground (body.blocked.down)
      // 3. Player jumps off (SPACE)
      // 4. Player moves left/right off ladder
      // 5. Player reaches top of ladder
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

  // === HIDING IN SHADOW ===

  startHiding() {
    this.isHiding = true;
    this.isHidden = true;
    this.setVelocity(0, 0);
    this.body.setAccelerationX(0);

    // Gradually darken
    this._tweenDarken();

    // Play transition animation, then hold last frame
    this.currentAnim = '';
    this.playAnim('player_hide', false);
    this.once('animationcomplete-player_hide', () => {
      if (this.isHiding) {
        this.playAnim('player_hide_idle', false);
      }
    });
  }

  updateHiding() {
    const t = this.touch;
    const left = this.cursors.left.isDown || this.wasdKeys.left.isDown || (t && t.left);
    const right = this.cursors.right.isDown || this.wasdKeys.right.isDown || (t && t.right);
    const up = this.cursors.up.isDown || this.wasdKeys.up.isDown || (t && t.up);
    const down = this.cursors.down.isDown || this.wasdKeys.down.isDown || (t && t.down);
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasdKeys.up) || (t && t.jumpJustPressed);

    // Keep player frozen
    this.setVelocity(0, 0);

    // Exit hiding if: any movement key (left/right/up), jump, or player leaves shadow zone
    if (left || right || up || jump || !this.inShadowZone) {
      // Determine exit direction for flip
      let exitDir = 0; // 0 = neutral, -1 = left, 1 = right
      if (left) exitDir = -1;
      else if (right) exitDir = 1;
      this.stopHiding(exitDir);
      return;
    }
  }

  stopHiding(exitDir = 0) {
    this.isHiding = false;
    this.isHidden = false;
    this.isUnhiding = true;  // block input during stand-up animation
    this._unhideExitDir = exitDir;  // remember direction to move after standing up
    this.off('animationcomplete-player_hide');  // remove pending callback

    // Set flip based on exit direction:
    // right (exitDir=1) → normal (flipX=false), left (exitDir=-1) → flipped
    if (exitDir === -1) this.setFlipX(true);
    else if (exitDir === 1) this.setFlipX(false);

    // Gradually brighten
    this._tweenBrighten();

    // Play reverse animation (standing up from crouch)
    this.currentAnim = '';
    this.playAnim('player_hide_reverse', false);
    this.once('animationcomplete-player_hide_reverse', () => {
      this.isUnhiding = false;
      this._unhideExitDir = 0;
      this.currentAnim = '';
      this.playAnim('player_idle');
    });
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
    this.isHiding = false;
    this.isHidden = false;
    this.isUnhiding = false;
    this.off('animationcomplete-player_hide_reverse');
    if (this._hideTween) { this._hideTween.destroy(); this._hideTween = null; }
    this.clearTint();
    this.setAlpha(1);
    this._pushYShift = 0;
    this.body.allowGravity = true;
    this.body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
    this.playAnim('player_idle');
  }

  // === HEALTH ===

  get isInvincible() {
    return this.scene.time.now < this._invincibleUntil;
  }

  takeDamage(amount = 1) {
    if (this.isInvincible || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this._invincibleUntil = this.scene.time.now + PLAYER.INVINCIBLE_MS;

    // Visual feedback — flash red + blink
    this.setTint(0xff0000);
    this.scene.cameras.main.shake(150, 0.008);
    this._blinkTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 1 },
      duration: 120,
      repeat: Math.floor(PLAYER.INVINCIBLE_MS / 240),
      yoyo: true,
      onComplete: () => {
        this.clearTint();
        this.setAlpha(1);
      }
    });

    // Knockback — small push away from cop
    this.setVelocityY(-150);

    if (this.hp <= 0) {
      this.scene.events.emit('player-died');
    }
    return true;
  }

  heal(amount = 1) {
    if (this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    // Green flash feedback
    this.setTint(0x00ff88);
    this.scene.time.delayedCall(200, () => this.clearTint());
    return true;
  }
}
