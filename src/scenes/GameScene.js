import Phaser from 'phaser';
import { GAME, PLAYER, PAINT, SHADOW } from '../config/gameConfig.js';
import Player from '../entities/Player.js';
import Cop from '../entities/Cop.js';
import PaintCan from '../entities/PaintCan.js';
import Trash from '../entities/Trash.js';
import PaintArm from '../entities/PaintArm.js';
import PaintByNumbers from '../entities/PaintByNumbers.js';
import SynthSFX from '../utils/SynthSFX.js';
import TouchControls from '../utils/TouchControls.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.sfx = new SynthSFX();

    this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
    this.cameras.main.setZoom(1.3);
    this.cameras.main.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);

    // === World bounds ===
    this.physics.world.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT);

    // === Checkpoint ===
    this.checkpointX = 60;
    this.checkpointY = GAME.HEIGHT - 80;

    // Track painted spots
    this.totalSpots = 0;
    this.paintedSpots = 0;

    // === Build Level ===
    this.createBackground();
    this.createPlatforms();
    this.createLadders();
    this.createShadowZones();
    this.createPaintSpots();
    this.createPaintCans();
    this.createForeground();

    // === Trash cans (pushable) ===
    this.trashCans = [];
    this.createTrashCans();

    // === Player ===
    this.player = new Player(this, this.checkpointX, this.checkpointY, this.touch);
    this.player.setDepth(5);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // === Paint arm (hand + rope for active painting) ===
    this.paintArm = new PaintArm(this);

    // === Cop ===
    this.cops = [];
    this.createCops();

    // === Collisions ===
    // Player vs ground — always solid, never pass-through
    this.physics.add.collider(this.player, this.ground);

    // Player vs platforms — disabled when climbing a ladder (pass-through)
    this.physics.add.collider(this.player, this.platforms, null, (player, platform) => {
      if (player.isClimbing || player.isDroppingToLadder || player.isClimbing2) return false;
      return true;
    });
    this.cops.forEach(cop => {
      this.physics.add.collider(cop, this.platforms);
      this.physics.add.collider(cop, this.ground);
    });

    // Trash cans: collide with ground, platforms, and player
    this.trashCans.forEach(trash => {
      this.physics.add.collider(trash, this.ground);
      this.physics.add.collider(trash, this.platforms);
    });
    // Trash vs trash (they don't overlap each other)
    if (this.trashCans.length > 1) {
      for (let i = 0; i < this.trashCans.length; i++) {
        for (let j = i + 1; j < this.trashCans.length; j++) {
          this.physics.add.collider(this.trashCans[i], this.trashCans[j]);
        }
      }
    }
    // Player vs trash — pass-through normally, SOLID when in push mode or landing on top
    this.nearbyTrash = null;
    this.collidingTrash = null;  // set by collider each frame
    this.trashCans.forEach(trash => {
      this.physics.add.collider(this.player, trash, (player, t) => {
        // Track contact
        this.collidingTrash = t;
        this.nearbyTrash = t;
      }, (player, t) => {
        // In push mode: trash stays immovable (wall), we move it manually in update
        if (this.player.isPushingTrash) {
          t.body.immovable = true;
          t.isBeingPushed = true;
          return true;  // solid wall — player can't walk through
        }
        t.isBeingPushed = false;
        // Only solid when falling onto top
        const playerBottom = player.body.y + player.body.height;
        const trashTop = t.body.y;
        const falling = player.body.velocity.y >= 0;
        return falling && playerBottom <= trashTop + 8;
      });
      // Overlap — detect proximity for HUD hint and push activation
      // Use a wider invisible zone so player can enter push mode earlier
      const proximityZone = this.add.zone(trash.x, trash.y, 80, 60);
      this.physics.add.existing(proximityZone, false);
      proximityZone.body.setAllowGravity(false);
      proximityZone.body.setImmovable(true);
      // Keep zone position synced with trash
      trash._proximityZone = proximityZone;
      this.physics.add.overlap(this.player, proximityZone, () => {
        this.nearbyTrash = trash;
      });
    });
    // Cops vs trash — pass through (no collision)

    // Ladder overlap — sets flag per frame, resolved in update()
    this.playerOnLadderThisFrame = false;
    this.ladderCenterX = 0;
    this.ladderTopY = 0;
    this.currentLadderInfo = null; // reference to ladderInfo for pushing
    this.physics.add.overlap(this.player, this.ladderZones, (player, ladder) => {
      this.playerOnLadderThisFrame = true;
      this.ladderCenterX = ladder.x + ladder.width / 2;
      this.ladderTopY = ladder.getData('ladderTopY');
      this.currentLadderInfo = ladder.getData('ladderInfo');
    });

    // Shadow overlap
    this.physics.add.overlap(this.player, this.shadowZones, () => {
      this.playerInShadow = true;
    });

    // Paint can pickup
    this.physics.add.overlap(this.player, this.paintCans, (player, can) => {
      can.collect(player);
      this.sfx.collectPaint();
    });

    // Paint spot interaction
    this.interactablePaintSpot = null;
    this.physics.add.overlap(this.player, this.paintSpotZones, (player, spot) => {
      if (!spot.getData('painted')) {
        this.interactablePaintSpot = spot;
      }
    });

    // === Touch controls (mobile) ===
    this.touch = new TouchControls(this);

    // === HUD ===
    this.createHUD();

    // === Events ===
    this.events.on('player-caught', () => {
      this.sfx.caught();
      this.player.die(this.checkpointX, this.checkpointY);
      this.cops.forEach(cop => cop.resetState());
    });

    // Paint input key (SPACE)
    this.paintKeySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.playerInShadow = false;

    // Stop music when scene shuts down (prevents duplicate playback on restart)
    this.events.on('shutdown', () => {
      if (this.bgm) this.bgm.stop();
    });
  }

  // === LEVEL BUILDING ===

  createBackground() {
    const bg = this.add.graphics();
    bg.setDepth(0);

    // Night sky gradient
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

    // Stars
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, GAME.WIDTH);
      const sy = Phaser.Math.Between(0, GAME.HEIGHT / 3);
      const size = Math.random() > 0.8 ? 2 : 1;
      bg.fillStyle(0xffffff, Math.random() * 0.5 + 0.2);
      bg.fillRect(sx, sy, size, size);
    }

    // Distant buildings (parallax feel)
    bg.fillStyle(0x0d0d20, 1);
    for (let i = 0; i < 8; i++) {
      const bw = Phaser.Math.Between(50, 100);
      const bh = Phaser.Math.Between(80, 250);
      bg.fillRect(i * 110 - 20, GAME.HEIGHT - bh, bw, bh);
      // Windows
      bg.fillStyle(0x223344, 0.4);
      for (let wy = GAME.HEIGHT - bh + 15; wy < GAME.HEIGHT - 10; wy += 25) {
        for (let wx = i * 110 - 10; wx < i * 110 - 20 + bw - 10; wx += 18) {
          if (Math.random() > 0.3) {
            bg.fillRect(wx, wy, 8, 12);
          }
        }
      }
      bg.fillStyle(0x0d0d20, 1);
    }

    // Moon
    bg.fillStyle(0xddeeff, 0.8);
    bg.fillCircle(680, 60, 25);
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillCircle(690, 55, 22); // crescent effect
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    this.ground = this.physics.add.staticGroup();

    const BLOCK_H = 32; // display height for platform collision

    // Helper: create a TileSprite platform with blok.png texture + static physics
    const addPlatform = (group, x, y, width) => {
      const tile = this.add.tileSprite(x + width / 2, y + BLOCK_H / 2, width, BLOCK_H, 'platform_block');
      tile.setDepth(3);
      this.physics.add.existing(tile, true);
      group.add(tile);
    };

    // Ground floor (separate group — always solid, never pass-through)
    addPlatform(this.ground, 0, GAME.HEIGHT - 32, GAME.WIDTH);

    // Platform 1 (low-left)
    addPlatform(this.platforms, 0, GAME.HEIGHT - 156, 256);

    // Platform 2 (mid-right)
    addPlatform(this.platforms, 300, GAME.HEIGHT - 286, 300);

    // Platform 3 (top-left)
    addPlatform(this.platforms, 50, GAME.HEIGHT - 416, 300);

    // Small platform (high-right)
    addPlatform(this.platforms, 600, GAME.HEIGHT - 436, 170);
  }

  createLadders() {
    this.ladderZones = this.physics.add.staticGroup();
    this.ladderVisuals = this.add.group();
    this.ladderData = []; // array of {visual, zone, topY, bottomY, height, minX, maxX}

    const LADDER_DISPLAY_W = 34; // display width of ladder
    const ZONE_WIDTH = 36;
    const ZONE_EXTEND_TOP = 40;
    const ZONE_EXTEND_BOTTOM = 16;

    const addLadder = (x, topY, bottomY, minX, maxX) => {
      const height = bottomY - topY;

      // TileSprite tiling drabinka.png vertically, scaled to LADDER_DISPLAY_W
      // Image is 51x21; scale X to fit width, tile height uses same scale for proper proportions
      const ladderScale = LADDER_DISPLAY_W / 51;
      const tileH = height / ladderScale; // tile height in source pixels so display = height
      const visual = this.add.tileSprite(x, topY + height / 2, 51, tileH, 'ladder_tile');
      visual.setScale(ladderScale);
      visual.setDepth(4);
      this.ladderVisuals.add(visual);

      // Collider zone
      const zone = this.add.zone(
        x - ZONE_WIDTH / 2,
        topY - ZONE_EXTEND_TOP,
        ZONE_WIDTH,
        height + ZONE_EXTEND_TOP + ZONE_EXTEND_BOTTOM
      ).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      zone.setData('ladderTopY', topY);
      this.ladderZones.add(zone);

      // Store paired data for ladder pushing
      const ladderInfo = { visual, zone, topY, bottomY, height, minX: minX || 40, maxX: maxX || GAME.WIDTH - 40 };
      zone.setData('ladderInfo', ladderInfo);
      this.ladderData.push(ladderInfo);
    };

    // Ladder 1: ground to platform 1 (can slide within platform width)
    addLadder(200, GAME.HEIGHT - 140, GAME.HEIGHT - 32, 30, 240);

    // Ladder 2: platform 2 to platform 3
    addLadder(340, GAME.HEIGHT - 400, GAME.HEIGHT - 270, 310, 590);

    // Ladder 3: ground to platform 2 (right side)
    addLadder(500, GAME.HEIGHT - 270, GAME.HEIGHT - 32, 310, 590);
  }

  createShadowZones() {
    this.shadowZones = this.physics.add.staticGroup();
    this.shadowVisuals = this.add.group();

    const addShadow = (x, y, w, h) => {
      // Visual (dark overlay)
      const visual = this.add.graphics();
      visual.fillStyle(SHADOW.COLOR, SHADOW.ALPHA);
      visual.fillRect(x, y, w, h);
      // Subtle edge glow
      visual.lineStyle(1, 0x001122, 0.3);
      visual.strokeRect(x, y, w, h);
      visual.setDepth(2);
      this.shadowVisuals.add(visual);

      // Collider zone
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      this.shadowZones.add(zone);
    };

    // Shadow 1: under platform 1 (alcove)
    addShadow(80, GAME.HEIGHT - 135, 60, 100);

    // Shadow 2: corner on platform 2
    addShadow(540, GAME.HEIGHT - 310, 50, 40);
  }

  createPaintCans() {
    this.paintCans = this.physics.add.group();

    // Red paint can on platform 1
    const can1 = new PaintCan(this, 120, GAME.HEIGHT - 170, 'red');
    this.paintCans.add(can1);

    // Blue paint can on platform 3
    const can2 = new PaintCan(this, 250, GAME.HEIGHT - 430, 'blue');
    this.paintCans.add(can2);

    // Yellow paint can on platform 2 (right side)
    const can3 = new PaintCan(this, 550, GAME.HEIGHT - 300, 'yellow');
    this.paintCans.add(can3);

    // Green paint can on high-right platform
    const can4 = new PaintCan(this, 650, GAME.HEIGHT - 450, 'green');
    this.paintCans.add(can4);
  }

  createPaintSpots() {
    this.paintSpotZones = this.physics.add.staticGroup();

    const addSpot = (x, y, w, h, paintingKey) => {
      // Paint-by-numbers spot — uses JSON grid data
      const visual = this.add.graphics().setDepth(2);
      // Draw brick wall placeholder
      visual.fillStyle(0x555566, 1);
      visual.fillRect(x - w / 2, y - h / 2, w, h);
      // Brick pattern
      const brickW = 14, brickH = 8, gap = 1;
      for (let row = 0; row < Math.ceil(h / (brickH + gap)); row++) {
        const offsetX = (row % 2) * (brickW / 2 + gap);
        for (let col = -1; col < Math.ceil(w / (brickW + gap)) + 1; col++) {
          const bx = x - w / 2 + col * (brickW + gap) + offsetX;
          const by = y - h / 2 + row * (brickH + gap);
          visual.fillStyle(0x443344 + (((row * 7 + col * 3) % 5) * 0x050505), 1);
          visual.fillRect(bx, by, brickW, brickH);
        }
      }
      // Colored border hint
      visual.lineStyle(2, 0xffdd33, 0.6);
      visual.strokeRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4);

      // Interaction zone
      const zone = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      zone.setData('painted', false);
      zone.setData('visual', visual);
      zone.setData('spotW', w);
      zone.setData('spotH', h);
      zone.setData('paintingKey', paintingKey);
      zone.setData('spotX', x);
      zone.setData('spotY', y);
      this.paintSpotZones.add(zone);
      this.totalSpots++;
    };

    // Heart mural on platform 2 wall
    addSpot(450, GAME.HEIGHT - 175, 140, 190, 'painting_heart');

    // Star mural on high-right platform wall
    addSpot(700, GAME.HEIGHT - 240, 140, 200, 'painting_star');
  }

  createTrashCans() {
    // Trash cans on the ground floor — player can push and jump on them
    const addTrash = (x, y) => {
      const trash = new Trash(this, x, y);
      this.trashCans.push(trash);
    };

    // Two trash cans on ground level (spawned above ground — gravity drops them)
    addTrash(170, GAME.HEIGHT - 32 - 18);   // left side — in front of ladder 1
    addTrash(850, GAME.HEIGHT - 32 - 18);   // right side
  }

  createCops() {
    // Cop patrolling ground floor
    const cop1 = new Cop(this, 400, GAME.HEIGHT - 55,
      300, GAME.WIDTH - 40);
    this.cops.push(cop1);
  }

  createForeground() {
    const fg = this.add.graphics();
    fg.setDepth(8); // above player

    // Wire/cable
    fg.lineStyle(1, 0x334455, 0.4);
    fg.lineBetween(0, GAME.HEIGHT - 350, GAME.WIDTH, GAME.HEIGHT - 380);
  }

  // === HUD ===

  createHUD() {
    // HUD uses a dedicated scene overlay to avoid zoom issues
    // We add a second camera just for UI, with zoom=1
    this.uiCam = this.cameras.add(0, 0, GAME.WIDTH, GAME.HEIGHT);
    this.uiCam.setZoom(1);
    this.uiCam.setScroll(0, 0);
    this.uiCam.setName('ui');

    // Paint inventory — 4 fixed slots with grey outline cans + count labels
    const slotColors = ['red', 'blue', 'yellow', 'green'];
    const slotStartX = 22;
    const slotY = 26;
    const slotSpacing = 32;
    this.hudBg = this.add.rectangle(6, 8, slotColors.length * slotSpacing + 12, 40, 0x000000, 0.6)
      .setDepth(100).setScrollFactor(0).setOrigin(0, 0);

    this.hudSlots = [];
    for (let i = 0; i < slotColors.length; i++) {
      const sx = slotStartX + i * slotSpacing;
      // Grey empty can (always visible as background)
      const empty = this.add.image(sx, slotY, 'hud_can_empty')
        .setDepth(100.5).setScrollFactor(0);
      // Colored filled can (hidden until collected)
      const filled = this.add.image(sx, slotY, `hud_can_${slotColors[i]}`)
        .setDepth(101).setScrollFactor(0).setVisible(false);
      // Count label below
      const count = this.add.text(sx, slotY + 17, '', {
        font: 'bold 8px monospace',
        fill: '#ffffff'
      }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setAlpha(0);

      this.hudSlots.push({ color: slotColors[i], empty, filled, count });
    }

    // Painted spots counter (after the slots)
    const counterX = slotStartX + slotColors.length * slotSpacing + 8;
    this.hudCountText = this.add.text(counterX, slotY, '', {
      font: 'bold 10px monospace',
      fill: '#00ff88'
    }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

    // Status text
    this.statusText = this.add.text(GAME.WIDTH / 2, 10, '', {
      font: '12px monospace',
      fill: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 }
    }).setOrigin(0.5, 0).setDepth(100).setScrollFactor(0);

    // Music toggle button (speaker icon)
    this.musicOn = true;
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.15 });
    this.bgm.play();

    this.muteBtn = this.add.text(GAME.WIDTH - 40, 10, '\u266B', {
      font: 'bold 20px monospace',
      fill: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 }
    }).setDepth(100).setScrollFactor(0).setInteractive({ useHandCursor: true });

    this.muteBtn.on('pointerdown', () => {
      this.musicOn = !this.musicOn;
      if (this.musicOn) {
        this.bgm.resume();
        this.muteBtn.setText('\u266B');
        this.muteBtn.setStyle({ fill: '#00ff88' });
      } else {
        this.bgm.pause();
        this.muteBtn.setText('\u266C');
        this.muteBtn.setStyle({ fill: '#ff6666' });
      }
    });

    // Collect all HUD elements for camera management
    const slotElements = [];
    this.hudSlots.forEach(s => slotElements.push(s.empty, s.filled, s.count));

    // Main camera ignores HUD + touch controls, UI camera ignores everything else
    const hudElements = [this.hudBg, this.hudCountText, this.statusText, this.muteBtn,
      ...slotElements, ...this.touch.getElements()];
    this.cameras.main.ignore(hudElements);

    // Ignore all existing world objects on UI cam
    this.children.list.forEach(child => {
      if (!hudElements.includes(child)) {
        this.uiCam.ignore(child);
      }
    });

    // Auto-ignore any future objects added to the scene
    this.events.on('addedtoscene', (obj) => {
      if (this.uiCam && !hudElements.includes(obj)) {
        this.uiCam.ignore(obj);
      }
    });
  }

  updateHUD() {
    // Update each paint slot: show filled can + count if player has that color
    for (let i = 0; i < this.hudSlots.length; i++) {
      const slot = this.hudSlots[i];
      const qty = this.player.getPaintCount(slot.color);
      if (qty > 0) {
        slot.filled.setVisible(true);
        slot.count.setText(String(qty)).setAlpha(1);
      } else {
        slot.filled.setVisible(false);
        slot.count.setAlpha(0);
      }
    }

    // Painted spots counter
    this.hudCountText.setText(`${this.paintedSpots}/${this.totalSpots}`);

    if (this.player.isPainting) {
      const colorInfo = this.pbn ? ` | Kolor: ${this.pbn.getSelectedColorName()} (1-4)` : '';
      this.statusText.setText(`[ MALOWANIE${colorInfo} — SPACE anuluj ]`);
      this.statusText.setStyle({ fill: '#ffdd33' });
    } else if (this.player.isPushingLadder) {
      this.statusText.setText('[ PRZESUWANIE DRABINY — E puść ]');
      this.statusText.setStyle({ fill: '#ffaa33' });
    } else if (this.player.isPushingTrash) {
      this.statusText.setText('[ PRZESUWANIE KOSZA — E puść ]');
      this.statusText.setStyle({ fill: '#ffaa33' });
    } else {
      // Build context hints
      const hints = [];
      let paintHint = false;

      if (this.player.isHidden) {
        hints.push('UKRYTY');
      }

      // Paint spot nearby
      if (this.interactablePaintSpot && !this.interactablePaintSpot.getData('painted')) {
        const paintingKey = this.interactablePaintSpot.getData('paintingKey');
        if (paintingKey) {
          const gridData = this.cache.json.get(paintingKey);
          const reqColors = gridData ? gridData.colors : [];
          const hasAny = reqColors.some(c => this.player.hasPaint(c.toLowerCase()));
          if (hasAny) {
            hints.push('SPACE: maluj mural');
            paintHint = true;
          } else {
            hints.push(`brak farb: ${reqColors.join(', ')}`);
            paintHint = true;
          }
        }
      }

      // E key hint — show only one based on priority (ladder > trash)
      const onGround = this.player.body.blocked.down || this.player.body.touching.down;
      let nearLadderBottom = false;
      if (onGround && this.playerOnLadderThisFrame && this.currentLadderInfo) {
        const playerFeetY = this.player.y + 16;
        nearLadderBottom = playerFeetY >= this.currentLadderInfo.bottomY - 40;
      }

      if (nearLadderBottom) {
        hints.push('E: przesuń drabinę');
      } else if (this.nearbyTrash) {
        hints.push('E: przesuń kosz');
      }

      if (hints.length > 0) {
        this.statusText.setText(`[ ${hints.join('  |  ')} ]`);
        this.statusText.setStyle({ fill: paintHint ? '#ffdd33' : '#00ff88' });
      } else {
        this.statusText.setText('');
      }
    }
  }

  // === ACTIVE PAINT-BY-NUMBERS SYSTEM ===

  tryPaint() {
    if (!this.interactablePaintSpot) return;

    const spot = this.interactablePaintSpot;
    const paintingKey = spot.getData('paintingKey');
    if (!paintingKey) return;

    const gridData = this.cache.json.get(paintingKey);
    if (!gridData) return;

    // Check if player has at least one required paint color
    const requiredColors = gridData.colors || [];
    const hasAny = requiredColors.some(c => this.player.hasPaint(c.toLowerCase()));
    if (!hasAny) {
      const hint = this.add.text(this.player.x, this.player.y - 40,
        `Potrzebujesz farb: ${requiredColors.join(', ')}`, {
          font: '11px monospace',
          fill: '#ff6666',
          backgroundColor: '#000000aa',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5).setDepth(15);

      this.tweens.add({
        targets: hint,
        y: hint.y - 20,
        alpha: 0,
        duration: 1500,
        onComplete: () => hint.destroy()
      });
      return;
    }

    const spotW = spot.getData('spotW');
    const spotH = spot.getData('spotH');
    const bounds = {
      x: spot.x,
      y: spot.y,
      w: spotW,
      h: spotH
    };

    this.activePaintSpot = spot;

    // Reuse existing PBN instance (saved on cancel) or create new one
    const savedPBN = spot.getData('pbnInstance');
    if (savedPBN) {
      this.pbn = savedPBN;
      this.pbn.show(); // re-show template + numbers
    } else {
      this.pbn = new PaintByNumbers(this, bounds, gridData);
    }

    // Set initial selected color to first available paint the player has
    const colorNames = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
    for (let i = 0; i < colorNames.length; i++) {
      if (this.player.hasPaint(colorNames[i].toLowerCase())) {
        this.pbn.setSelectedColor(i);
        break;
      }
    }

    // Paint progress HUD text
    const progress = this.pbn.getProgress();
    this.paintProgressText = this.add.text(
      bounds.x + bounds.w / 2,
      bounds.y - 14,
      `${Math.round(progress * 100)}%`,
      { font: 'bold 11px monospace', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 } }
    ).setOrigin(0.5).setDepth(15);

    // Color selector HUD
    this.createColorSelector(bounds);

    // Color switch keys (1-4)
    this.colorKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
    ];

    // Create touch color buttons if mobile
    if (this.touch && this.touch.createColorButtons) {
      this.touch.createColorButtons(this, (colorIdx) => {
        if (this.pbn) {
          this.pbn.setSelectedColor(colorIdx);
          this.player.paintColor = this.pbn.getSelectedColorHex();
          this.updateColorSelectorHighlight();
        }
      });
    }

    // Start paint arm (hand + rope)
    this.paintArm.start(this.player.x, this.player.y, this.player.flipX, bounds);

    // Start active painting on player
    const paintHex = this.pbn.getSelectedColorHex();
    this.player.startActivePainting(bounds, paintHex, () => {
      this.completePainting();
    }, () => {
      this.cancelPainting();
    });
  }

  createColorSelector(bounds) {
    this.colorSelectorElements = [];
    const colorNames = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
    const colorHexes = [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88];
    const selectorY = bounds.y + bounds.h + 12;
    const selectorStartX = bounds.x + bounds.w / 2 - (colorNames.length * 18) / 2;

    for (let i = 0; i < colorNames.length; i++) {
      const sx = selectorStartX + i * 18;
      const hasColor = this.player.hasPaint(colorNames[i].toLowerCase());
      const alpha = hasColor ? 0.9 : 0.2;

      const box = this.add.rectangle(sx + 7, selectorY + 7, 14, 14, colorHexes[i], alpha)
        .setDepth(15).setStrokeStyle(1, 0xffffff, 0.5);
      const num = this.add.text(sx + 7, selectorY + 7, String(i + 1), {
        font: 'bold 7px monospace', fill: '#000000'
      }).setOrigin(0.5).setDepth(15.1).setAlpha(hasColor ? 1 : 0.3);

      this.colorSelectorElements.push(box, num);
    }

    this.updateColorSelectorHighlight();
  }

  updateColorSelectorHighlight() {
    if (!this.colorSelectorElements || !this.pbn) return;
    const sel = this.pbn.selectedColorIndex;
    for (let i = 0; i < 4; i++) {
      const box = this.colorSelectorElements[i * 2];
      if (!box) continue;
      if (i === sel) {
        box.setStrokeStyle(2, 0xffffff, 1);
      } else {
        box.setStrokeStyle(1, 0xffffff, 0.3);
      }
    }
  }

  onPaintMove(handX, handY) {
    if (!this.pbn) return;

    const result = this.pbn.tryFillCell(handX, handY);

    if (result === true) {
      // Correctly painted — update spray color to match selected
      this.player.paintColor = this.pbn.getSelectedColorHex();
    }

    // Update progress
    const progress = this.pbn.getProgress();
    if (this.paintProgressText) {
      this.paintProgressText.setText(`${Math.round(progress * 100)}%`);
    }

    // Check if threshold reached
    if (this.pbn.isComplete()) {
      this.pbn.fillRemaining();
      this.player.finishPainting();
    }
  }

  completePainting() {
    const spot = this.activePaintSpot;

    // Consume all required paint colors
    if (this.pbn) {
      const usedColors = this.pbn.usedColors;
      usedColors.forEach(colorName => {
        this.player.usePaint(colorName.toLowerCase());
      });
    }

    spot.setData('painted', true);
    spot.setData('pbnInstance', null);
    this.paintedSpots++;

    // Keep brick wall visible behind the painted mural
    // Hide only the template grid overlay
    if (this.pbn) {
      this.pbn.templateGfx.setVisible(false);
      this.pbn.numberTexts.forEach(t => t.text.setVisible(false));
    }

    // Paint splash effect
    this.sfx.paintWall();
    this.cameras.main.flash(200, 100, 200, 100, false);
    const spotX = spot.getData('spotX') || spot.x;
    const spotY = spot.getData('spotY') || spot.y;
    const splash = this.add.text(spotX, spotY, 'TAGGED!', {
      font: 'bold 16px monospace',
      fill: '#00ff88'
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: splash,
      y: splash.y - 30,
      alpha: 0,
      duration: 1000,
      onComplete: () => splash.destroy()
    });

    this.cleanupPaintState(false);

    // Check win
    if (this.paintedSpots >= this.totalSpots) {
      this.time.delayedCall(1000, () => {
        this.scene.start('WinScene');
      });
    }
  }

  cancelPainting() {
    if (this.activePaintSpot && this.pbn) {
      // Save PBN instance on the spot — paintGfx stays visible on the wall
      this.activePaintSpot.setData('pbnInstance', this.pbn);
      this.pbn.hide(); // hides template+numbers, keeps painted cells visible
    }
    this.cleanupPaintState(false); // don't destroy PBN — it's saved on the spot
  }

  cleanupPaintState(destroyPBN = true) {
    this.paintArm.stop();

    if (this.paintProgressText) {
      this.paintProgressText.destroy();
      this.paintProgressText = null;
    }

    if (this.colorSelectorElements) {
      this.colorSelectorElements.forEach(e => e.destroy());
      this.colorSelectorElements = null;
    }

    if (this.colorKeys) {
      this.colorKeys.forEach(k => this.input.keyboard.removeKey(k));
      this.colorKeys = null;
    }

    if (this.touch && this.touch.destroyColorButtons) {
      this.touch.destroyColorButtons();
    }

    if (destroyPBN && this.pbn) {
      this.pbn.destroy();
    }
    this.pbn = null;
    this.activePaintSpot = null;
  }

  // === TRASH PUSH HELPER ===

  exitTrashPush() {
    this.player.isPushingTrash = false;
    this.trashCans.forEach(t => {
      t.body.immovable = true;
      t.body.setVelocityX(0);
      t.isBeingPushed = false;
    });
  }

  // === LADDER PUSH SYSTEM ===

  moveLadder(ladderInfo, dx) {
    if (!ladderInfo) return;
    const newX = Phaser.Math.Clamp(
      ladderInfo.visual.x + dx,
      ladderInfo.minX,
      ladderInfo.maxX
    );
    const actualDx = newX - ladderInfo.visual.x;
    if (Math.abs(actualDx) < 0.1) return 0;

    // Move visual
    ladderInfo.visual.x = newX;

    // Move zone (origin 0,0, so x = center - half width)
    const zoneW = ladderInfo.zone.width;
    ladderInfo.zone.x = newX - zoneW / 2;
    ladderInfo.zone.body.reset(ladderInfo.zone.x, ladderInfo.zone.y);

    return actualDx;
  }

  // === UPDATE ===

  update(time, delta) {
    // Overlap callbacks fired BEFORE this update() call (during physics step).
    // So playerOnLadderThisFrame / playerInShadow already hold this frame's results.

    // 1. Apply overlap results to player state
    this.player.setOnLadder(this.playerOnLadderThisFrame, this.ladderCenterX, this.ladderTopY, this.currentLadderInfo);
    this.player.setHidden(this.playerInShadow);

    // 2. Check paint input (SPACE or touch ACT) — player must physically touch the spot
    if (this.interactablePaintSpot && !this.player.isPainting && !this.player.isPushingLadder) {
      const paintPressed = Phaser.Input.Keyboard.JustDown(this.paintKeySpace) ||
        (this.touch && this.touch.actionJustPressed);
      if (paintPressed) {
        this.tryPaint();
      }
    }

    // 2b. E key — unified: ladder push OR trash push based on what's nearby
    const eJustPressed = Phaser.Input.Keyboard.JustDown(this.player.grabKey);
    if (eJustPressed && !this.player.isPainting) {
      if (this.player.isPushingTrash) {
        // Already pushing trash → exit
        this.exitTrashPush();
      } else if (this.player.isPushingLadder) {
        // Already pushing ladder → exit directly (JustDown already consumed here)
        this.player.stopLadderPush();
      } else {
        // Not in any push mode — check what's nearby
        // Priority: ladder first, then trash
        const onGround = this.player.body.blocked.down || this.player.body.touching.down;
        let grabbedLadder = false;
        if (onGround && this.playerOnLadderThisFrame && this.currentLadderInfo) {
          const playerFeetY = this.player.y + 16;
          const nearBottom = playerFeetY >= this.currentLadderInfo.bottomY - 40;
          if (nearBottom) {
            this.player.nearbyLadderInfo = this.currentLadderInfo;
            this.player.startLadderPush();
            grabbedLadder = true;
          }
        }
        if (!grabbedLadder && this.nearbyTrash) {
          // Enter trash push mode
          this.player.isPushingTrash = true;
        }
      }
    }
    // Auto-exit push mode only when player walks AWAY from the trash
    if (this.player.isPushingTrash) {
      const touching = this.collidingTrash || this.nearbyTrash;
      if (!touching) {
        // Not touching or overlapping any trash — check if moving away
        // Find closest trash to determine direction
        let closest = null;
        let closestDist = Infinity;
        this.trashCans.forEach(t => {
          const dist = Math.abs(this.player.x - t.x);
          if (dist < closestDist) { closestDist = dist; closest = t; }
        });
        if (closest) {
          const trashIsRight = closest.x > this.player.x;
          const playerMovingAway = (trashIsRight && this.player.body.velocity.x < -10)
            || (!trashIsRight && this.player.body.velocity.x > 10);
          if (playerMovingAway || closestDist > 60) {
            this.exitTrashPush();
          }
        } else {
          this.exitTrashPush();
        }
      }
    }

    // 2c. Ladder push: move ladder visual+zone when player pushes
    if (this.player.isPushingLadder && this.player.pushLadderInfo) {
      const dx = this.player.pushLadderDx;
      if (dx !== 0) {
        const moved = this.moveLadder(this.player.pushLadderInfo, dx);
        // Sync player position with ladder
        if (moved) {
          this.player.x += moved;
        }
        this.player.pushLadderDx = 0; // consumed
      }
    }

    // 3. Player movement & input (uses ladder/shadow state)
    this.player.update();

    // 3a. Paint arm update — drive hand movement and rope simulation
    if (this.player.isPainting && this.paintArm.active) {
      // Color switching (keys 1-4)
      if (this.colorKeys && this.pbn) {
        for (let i = 0; i < this.colorKeys.length; i++) {
          if (Phaser.Input.Keyboard.JustDown(this.colorKeys[i])) {
            this.pbn.setSelectedColor(i);
            this.player.paintColor = this.pbn.getSelectedColorHex();
            this.updateColorSelectorHighlight();
          }
        }
      }

      const cursors = this.player.cursors;
      const wasd = this.player.wasdKeys;
      const t = this.touch;
      const input = {
        left:  cursors.left.isDown  || wasd.left.isDown  || (t && t.left),
        right: cursors.right.isDown || wasd.right.isDown || (t && t.right),
        up:    cursors.up.isDown    || wasd.up.isDown    || (t && t.up),
        down:  cursors.down.isDown  || wasd.down.isDown  || (t && t.down),
      };
      const handPos = this.paintArm.update(delta, input, this.player.x, this.player.y);
      if (handPos) {
        this.onPaintMove(handPos.x, handPos.y);
        this.player.spawnPaintSpray(handPos.x, handPos.y);
      }
    }

    // 3b. Move trash when player is pushing into it
    if (this.player.isPushingTrash && this.collidingTrash) {
      const t = this.collidingTrash;
      // Use input direction, not velocity (velocity is 0 because collider blocks player)
      const left = this.player.cursors.left.isDown || this.player.wasdKeys.left.isDown;
      const right = this.player.cursors.right.isDown || this.player.wasdKeys.right.isDown;
      const trashIsRight = t.x > this.player.x;
      const pushingToward = (trashIsRight && right) || (!trashIsRight && left);
      if (pushingToward) {
        const pushSpeed = 35; // px/s — slow to convey weight
        const dir = right ? 1 : -1;
        const dx = dir * pushSpeed * (delta / 1000);
        // Move trash — keep sprite and body in sync
        t.body.position.x += dx;
        t.body.prev.x += dx;
        t.x += dx;
        // Move player body along (sprite syncs automatically via preUpdate)
        this.player.body.position.x += dx;
        this.player.body.prev.x += dx;
      }
    }

    // Sync trash proximity zones with trash positions
    this.trashCans.forEach(t => {
      if (t._proximityZone) {
        t._proximityZone.x = t.x;
        t._proximityZone.y = t.y;
        t._proximityZone.body.x = t.x - 40;
        t._proximityZone.body.y = t.y - 30;
      }
    });

    // 4. Cops AI
    this.cops.forEach(cop => cop.update(time, delta, this.player));

    // 5. HUD (uses interactablePaintSpot, ladder info)
    this.updateHUD();

    // 6. Reset flags AFTER use — next frame's physics step will set them again
    this.playerInShadow = false;
    this.playerOnLadderThisFrame = false;
    this.interactablePaintSpot = null;
    this.currentLadderInfo = null;
    this.nearbyTrash = null;
    this.collidingTrash = null;
  }
}
