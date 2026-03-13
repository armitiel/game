import Phaser from 'phaser';
import { GAME, PLAYER, PAINT, SHADOW } from '../config/gameConfig.js';
import { LEVELS } from '../config/levels.js';
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

  init(data) {
    this.levelIndex = (data && data.levelIndex != null) ? data.levelIndex : 0;
    this.levelData = LEVELS[this.levelIndex] || LEVELS[0];
    this.mode = this.levelData.mode || 'stealth'; // 'stealth' | 'puzzle' | 'tower'
  }

  create() {
    this.sfx = new SynthSFX();

    const ld = this.levelData;
    this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.cameras.main.setZoom(isMobile ? 2.7 : 1.95);
    this._baseZoom = this.cameras.main.zoom;  // remember base zoom for paint restore
    this.cameras.main.setBounds(0, 0, ld.worldWidth, ld.worldHeight);

    // === World bounds ===
    this.physics.world.setBounds(0, 0, ld.worldWidth, ld.worldHeight);

    // === Checkpoint ===
    this.checkpointX = ld.checkpoint.x;
    this.checkpointY = ld.checkpoint.y;

    // Track painted spots
    this.totalSpots = 0;
    this.paintedSpots = 0;

    // === Derive colors from paintings ===
    this.deriveLevelColors();

    // === Build Level ===
    this.createBackground();
    this.createPlatforms();
    this.createFillWalls();
    this.createLadders();
    this.createShadowZones();
    this.createPaintSpots();
    this.createPaintCans();
    this.createForeground();
    this.createLamps();

    // === High-depth layer for bridge/falling-ladder visuals ===
    // Using a Layer guarantees everything inside renders ABOVE platforms,
    // regardless of when objects are created during gameplay.
    this._bridgeLayer = this.add.layer();
    this._bridgeLayer.setDepth(50);
    this._bridgeBodies = []; // track all bridge collider bodies for step-up logic

    // === Trash cans (pushable) ===
    this.trashCans = [];
    this.createTrashCans();

    // === Touch controls (mobile) — must be created before Player ===
    this.touch = new TouchControls(this);

    // === Player ===
    this.player = new Player(this, this.checkpointX, this.checkpointY, this.touch);
    this.player.setDepth(5);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // === Paint arm (hand + rope for active painting) ===
    this.paintArm = new PaintArm(this);

    // === Cop ===
    this.cops = [];
    this.createCops();

    // === Heart pickups (must be after player creation for overlap) ===
    this.createHeartPickups();

    // === Collisions ===
    // Player vs ground — always solid, never pass-through
    this.physics.add.collider(this.player, this.ground);

    // Player vs platforms — disabled when climbing a ladder
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
        // Detect landing on top — player's bottom touching trash's top
        if (player.body.touching.down && t.body.touching.up) {
          t.onPlayerOnTop();
        }
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
      const info = ladder.getData('ladderInfo');
      // Skip fallen/destroyed ladders — can't climb a bridge
      if (info && (info.isFalling || info.isBridge || info.destroyed)) return;
      this.playerOnLadderThisFrame = true;
      this.ladderCenterX = ladder.x + ladder.width / 2;
      this.ladderTopY = ladder.getData('ladderTopY');
      this.currentLadderInfo = info;
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

    // === HUD ===
    this.createHUD();

    // === Tower mode: timer + color gates ===
    if (this.mode === 'tower') {
      this.setupTowerMode();
    }

    // === Wind leaves effect ===
    this.createLeafEffect();

    // === Events ===
    this.events.on('player-caught', () => {
      // Deal damage instead of instant death
      const took = this.player.takeDamage(1);
      if (!took) return; // invincible — ignore
      // Clean up active states — cancel painting (saves progress) instead of destroying
      if (this.player.isPainting) {
        this.player.stopPainting();
        this.cancelPainting();
      }
      if (this.player.isPushingLadder) this.player.stopLadderPush();
      if (this.player.isHiding) this.player.stopHiding();
      this.sfx.caught();
      this.cops.forEach(cop => cop.resetState());
    });

    // Full death — all hearts lost → respawn at checkpoint with full HP
    this.events.on('player-died', () => {
      this.player.hp = this.player.maxHp;
      this.player.die(this.checkpointX, this.checkpointY);
      this.cops.forEach(cop => cop.resetState());
    });

    // Paint input key (SPACE)
    this.paintKeySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.playerInShadow = false;

    // Stop music when scene shuts down (prevents duplicate playback on restart)
    this.events.on('shutdown', () => {
      if (this.bgm) this.bgm.stop();
      if (this._leafTimer) this._leafTimer.remove();
    });
  }

  // === LEVEL BUILDING ===

  /**
   * Auto-derive required colors from level's painting JSONs.
   * No need to manually specify colors per level — they come from the paintings.
   */
  deriveLevelColors() {
    const colorSet = new Set();
    const paintings = this.levelData.paintings || [];
    paintings.forEach(key => {
      const data = this.cache.json.get(key);
      if (data && data.colors) {
        data.colors.forEach(c => colorSet.add(c.toLowerCase()));
      }
    });
    // Fallback if no paintings found
    this.levelColors = colorSet.size > 0
      ? [...colorSet]
      : (this.levelData.colors || ['red', 'blue', 'yellow']);
  }

  createBackground() {
    const ld = this.levelData;
    const ww = ld.worldWidth;
    const wh = ld.worldHeight;
    const bg = this.add.graphics();
    bg.setDepth(0);

    // Night sky — vertical gradient (deep navy top → blue-indigo bottom)
    const gradientSteps = 64;
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / (gradientSteps - 1);
      // Top: #080820 → Bottom: #1a1a50
      const r = Math.round(8 + t * 18);
      const g = Math.round(8 + t * 18);
      const b = Math.round(32 + t * 48);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      const sy = Math.floor(wh * i / gradientSteps);
      const sh = Math.ceil(wh / gradientSteps) + 1;
      bg.fillRect(0, sy, ww, sh);
    }

    // Stars
    const starCount = Math.floor(40 * (wh / GAME.HEIGHT));
    for (let i = 0; i < starCount; i++) {
      const sx = Phaser.Math.Between(0, ww);
      const sy = Phaser.Math.Between(0, wh / 3);
      const size = Math.random() > 0.8 ? 2 : 1;
      bg.fillStyle(0xffffff, Math.random() * 0.5 + 0.2);
      bg.fillRect(sx, sy, size, size);
    }

    // Distant buildings — stylized with gradients and warm windows
    const buildingCount = Math.ceil(ww / 100) + 2;
    const buildingColors = [
      [0x0f1028, 0x1a1e3a], // dark navy
      [0x121430, 0x1e2240], // deep blue
      [0x0e1025, 0x181c35], // darker
      [0x141838, 0x222848], // medium blue
    ];

    for (let i = 0; i < buildingCount; i++) {
      const seed = (i * 7 + 3) % 17;
      const bw = 45 + (seed * 4) % 55;
      const bh = 80 + (seed * 13) % Math.min(Math.round(wh * 0.35), 320);
      const bx = i * 95 - 30 + ((seed * 5) % 20);
      const by = wh - bh;
      const colors = buildingColors[i % buildingColors.length];

      // Building body with vertical gradient
      const gradSteps = 8;
      for (let gs = 0; gs < gradSteps; gs++) {
        const t = gs / (gradSteps - 1);
        const c0r = (colors[0] >> 16) & 0xff, c0g = (colors[0] >> 8) & 0xff, c0b = colors[0] & 0xff;
        const c1r = (colors[1] >> 16) & 0xff, c1g = (colors[1] >> 8) & 0xff, c1b = colors[1] & 0xff;
        const gr = Math.round(c0r + (c1r - c0r) * t);
        const gg = Math.round(c0g + (c1g - c0g) * t);
        const gb = Math.round(c0b + (c1b - c0b) * t);
        bg.fillStyle((gr << 16) | (gg << 8) | gb, 1);
        const sy = by + Math.floor(bh * gs / gradSteps);
        const sh = Math.ceil(bh / gradSteps) + 1;
        bg.fillRect(bx, sy, bw, sh);
      }

      // Subtle lighter edge on left side
      bg.fillStyle(0xffffff, 0.04);
      bg.fillRect(bx, by, 3, bh);

      // Subtle darker edge on right side
      bg.fillStyle(0x000000, 0.15);
      bg.fillRect(bx + bw - 3, by, 3, bh);

      // Roof cap — slightly wider, darker
      bg.fillStyle(0x0a0c1e, 1);
      bg.fillRect(bx - 2, by, bw + 4, 5);
      bg.fillStyle(0xffffff, 0.05);
      bg.fillRect(bx - 2, by, bw + 4, 2);

      // Windows — warm orange/yellow glow
      const winW = 8, winH = 11, winGapX = 17, winGapY = 22;
      const winPadX = 8, winPadY = 14;
      for (let wy = by + winPadY; wy + winH < wh - 5; wy += winGapY) {
        for (let wx = bx + winPadX; wx + winW < bx + bw - 5; wx += winGapX) {
          const lit = ((wx * 7 + wy * 3 + i) % 10) > 3; // deterministic random
          if (lit) {
            // Window glow (outer)
            bg.fillStyle(0xffaa44, 0.12);
            bg.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
            // Window fill
            bg.fillStyle(0xffbb55, 0.55);
            bg.fillRect(wx, wy, winW, winH);
            // Brighter center
            bg.fillStyle(0xffdd88, 0.35);
            bg.fillRect(wx + 1, wy + 1, winW - 2, winH - 2);
          } else {
            // Dark window
            bg.fillStyle(0x0a0c18, 0.7);
            bg.fillRect(wx, wy, winW, winH);
          }
        }
      }
    }

    // Moon
    bg.fillStyle(0xddeeff, 0.8);
    bg.fillCircle(ww - 100, 60, 25);
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillCircle(ww - 90, 55, 22);
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    this.ground = this.physics.add.staticGroup();

    const BLOCK_H = 32;
    const CORNER_R = 4;
    const srcImg = this.textures.get('platform_block').getSourceImage();

    const addPlatform = (group, x, y, width, depth) => {
      const rtKey = '__plat_' + x + '_' + y + '_' + width;

      // Use offscreen canvas with rounded-rect clip for true pixel rounding
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = BLOCK_H;
      const ctx = canvas.getContext('2d');

      // Clip to rounded rectangle
      ctx.beginPath();
      ctx.moveTo(CORNER_R, 0);
      ctx.lineTo(width - CORNER_R, 0);
      ctx.quadraticCurveTo(width, 0, width, CORNER_R);
      ctx.lineTo(width, BLOCK_H - CORNER_R);
      ctx.quadraticCurveTo(width, BLOCK_H, width - CORNER_R, BLOCK_H);
      ctx.lineTo(CORNER_R, BLOCK_H);
      ctx.quadraticCurveTo(0, BLOCK_H, 0, BLOCK_H - CORNER_R);
      ctx.lineTo(0, CORNER_R);
      ctx.quadraticCurveTo(0, 0, CORNER_R, 0);
      ctx.closePath();
      ctx.clip();

      // Tile the source image across the clipped area
      const srcW = srcImg.width;
      for (let tx = 0; tx < width; tx += srcW) {
        ctx.drawImage(srcImg, tx, 0);
      }

      this.textures.addCanvas(rtKey, canvas);

      const tile = this.add.image(x + width / 2, y + BLOCK_H / 2, rtKey);
      tile.setDepth(depth ?? 3);
      this.physics.add.existing(tile, true);
      group.add(tile);
    };

    const ld = this.levelData;
    ld.ground.forEach(g => addPlatform(this.ground, g.x, g.y, g.w, g.depth));
    ld.platforms.forEach(p => {
      addPlatform(this.platforms, p.x, p.y, p.w, p.depth);
      // Cast shadow below platform
      this._addPlatformShadow(p.x, p.y + BLOCK_H, p.w);
    });
  }

  /**
   * Add a soft drop-shadow beneath a platform.
   * Uses a gradient that fades out vertically.
   */
  _addPlatformShadow(x, y, width) {
    const shadowH = 40;
    const steps = 8;
    const gfx = this.add.graphics();
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = 0.45 * (1 - t);
      const sliceH = shadowH / steps;
      gfx.fillStyle(0x000000, alpha);
      gfx.fillRect(x, y + t * shadowH, width, sliceH);
    }
    gfx.setDepth(2.5); // between shadows (2) and platforms (3)
  }

  /**
   * Create fill walls under platforms down to the next surface below.
   * Walls use tiled bricks in #2c284c / #48374d on a #1b1d40 background.
   * No jagged side edges. Placed behind murals (depth 1.5).
   */
  createFillWalls() {
    const ld = this.levelData;

    // Render explicit fillWalls from level data (no auto-generation)
    if (ld.fillWalls && ld.fillWalls.length > 0) {
      ld.fillWalls.forEach(fw => {
        this._createFillWall(fw.x, fw.y, fw.w, fw.h, fw.depth);
      });
    }
  }

  _createFillWall(wx, wy, w, h, depth) {
    const bw = 24, bh = 12, gap = 2;
    const color1 = '#2c284c';
    const color2 = '#48374d';
    const bgColor = '#1b1d40';

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Background fill
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Tile bricks — no jagged edges, straight rectangle
    const cols = Math.ceil(w / (bw + gap));
    const rows = Math.ceil(h / (bh + gap));

    for (let r = 0; r < rows; r++) {
      const rowOffset = (r % 2) * Math.round((bw + gap) / 2);
      const by = r * (bh + gap);
      if (by >= h) break;
      const brickH = Math.min(bh, h - by);

      for (let c = -1; c <= cols; c++) {
        const bx = c * (bw + gap) + rowOffset;
        if (bx + bw <= 0 || bx >= w) continue;

        // Clamp to wall bounds
        const drawX = Math.max(0, bx);
        const drawW = Math.min(bx + bw, w) - drawX;
        if (drawW <= 0) continue;

        // Alternate colors — rounded rect for each brick
        const cr = 2;
        ctx.fillStyle = (r + c) % 3 === 0 ? color2 : color1;
        this._canvasRoundRect(ctx, drawX, by, drawW, brickH, cr);
        ctx.fill();

        // Subtle mortar highlight on top edge
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(drawX + cr, by, drawW - cr * 2, 1);
      }
    }

    const rtKey = '__fillwall_' + wx + '_' + wy;
    this.textures.addCanvas(rtKey, canvas);

    const img = this.add.image(wx + w / 2, wy + h / 2, rtKey);
    img.setDepth(depth ?? 1.5); // behind murals (2) and shadows (2)
  }

  /**
   * Build a brick wall for mural spots using canvas-based procedural bricks.
   * - Background/mortar: #5a2e2a
   * - Brick colors: #8f3833 / #a34538
   * - Each brick has a small shadow and rounded corners
   * - Edge bricks alternate notch indentation for organic look
   */
  _createBrickWall(wx, wy, w, h, depth) {
    const bw = 24, bh = 12, gap = 2;
    const cr = 2; // corner radius
    const notch = 4;
    const color1 = '#8f3833';
    const color2 = '#a34538';
    const mortarColor = '#5a2e2a';
    const shadowOx = 2, shadowOy = 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Mortar background
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, w, h);

    const totalRows = Math.ceil(h / (bh + gap));

    for (let row = 0; row < totalRows; row++) {
      const by = row * (bh + gap);
      if (by >= h) break;
      const brickH = Math.min(bh, h - by);
      const rowOffset = (row % 2) * Math.round(bw / 2 + gap);

      // Alternating notch on edges
      const leftIndent = (row % 2 === 0) ? 0 : notch;
      const rightIndent = (row % 2 === 0) ? notch : 0;
      const rowLeft = leftIndent;
      const rowRight = w - rightIndent;

      const colStart = Math.floor(-rowOffset / (bw + gap)) - 1;
      const colEnd = Math.ceil((rowRight - rowOffset) / (bw + gap)) + 1;

      for (let col = colStart; col <= colEnd; col++) {
        const bx = col * (bw + gap) + rowOffset;
        if (bx + bw <= rowLeft || bx >= rowRight) continue;

        const drawX = Math.max(rowLeft, bx);
        const drawW = Math.min(bx + bw, rowRight) - drawX;
        if (drawW <= 0) continue;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this._canvasRoundRect(ctx, drawX + shadowOx, by + shadowOy, drawW, brickH, cr);
        ctx.fill();

        // Brick
        ctx.fillStyle = (row + col) % 3 === 0 ? color2 : color1;
        this._canvasRoundRect(ctx, drawX, by, drawW, brickH, cr);
        ctx.fill();

        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(drawX + cr, by, drawW - cr * 2, 1);
      }
    }

    const rtKey = '__muralwall_' + wx + '_' + wy;
    this.textures.addCanvas(rtKey, canvas);

    const img = this.add.image(wx + w / 2, wy + h / 2, rtKey);
    img.setOrigin(0.5, 0.5);
    img.setDepth(depth);
    return img;
  }

  /** Helper: begin a rounded-rect path on a canvas context. */
  _canvasRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  createLadders() {
    this.ladderZones = this.physics.add.staticGroup();
    this.ladderVisuals = this.add.group();
    this.ladderData = [];

    const LADDER_DISPLAY_W = 34;
    const ZONE_WIDTH = 36;
    const ZONE_EXTEND_TOP = 40;
    const ZONE_EXTEND_BOTTOM = 16;
    const ld = this.levelData;

    const addLadder = (x, topY, bottomY, minX, maxX, ladderDepth) => {
      const height = bottomY - topY;
      const ladderScale = LADDER_DISPLAY_W / 51;
      const tileH = height / ladderScale;

      // Convert tileSprite → canvas with inner outline along transparency edges
      const snapW = Math.ceil(51 * ladderScale);
      const snapH = Math.ceil(height);
      const rtKey = '__ladder_' + x + '_' + topY;

      // Draw tiled ladder onto offscreen canvas
      const srcImg = this.textures.get('ladder_tile').getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = snapW;
      canvas.height = snapH;
      const ctx = canvas.getContext('2d');
      // Tile the source image scaled
      const tileW = Math.ceil(srcImg.width * ladderScale);
      const tileH2 = Math.ceil(srcImg.height * ladderScale);
      for (let ty = 0; ty < snapH; ty += tileH2) {
        ctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height, 0, ty, tileW, tileH2);
      }

      // Add inner outline along transparency boundary
      const imgData = ctx.getImageData(0, 0, snapW, snapH);
      const d = imgData.data;
      const outR = 0x1a, outG = 0x23, outB = 0x30;
      const edgePixels = [];
      for (let py = 0; py < snapH; py++) {
        for (let px = 0; px < snapW; px++) {
          const i = (py * snapW + px) * 4;
          if (d[i + 3] < 128) continue; // skip transparent
          // Check if any neighbor is transparent → this is an edge pixel
          let isEdge = false;
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = px + dx, ny = py + dy;
              if (nx < 0 || nx >= snapW || ny < 0 || ny >= snapH) { isEdge = true; continue; }
              const ni = (ny * snapW + nx) * 4;
              if (d[ni + 3] < 128) isEdge = true;
            }
          }
          if (isEdge) edgePixels.push(i);
        }
      }
      // Paint edge pixels
      for (const i of edgePixels) {
        d[i] = outR; d[i + 1] = outG; d[i + 2] = outB; d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      this.textures.addCanvas(rtKey, canvas);

      const visual = this.add.image(x, topY + height / 2, rtKey);
      visual.setDepth(ladderDepth ?? 4);
      this.ladderVisuals.add(visual);

      // Cast shape-accurate shadow using the ladder's own texture
      // Crop bottom so shadow doesn't spill onto the platform beneath
      const ladShadow = this.add.image(x + 5, topY + height / 2 + 4, rtKey);
      ladShadow.setTint(0x000000);
      ladShadow.setAlpha(0.45);
      ladShadow.setCrop(0, 0, snapW, snapH - 8);
      ladShadow.setDepth((ladderDepth ?? 4) - 0.1);

      const zone = this.add.zone(
        x - ZONE_WIDTH / 2, topY - ZONE_EXTEND_TOP,
        ZONE_WIDTH, height + ZONE_EXTEND_TOP + ZONE_EXTEND_BOTTOM
      ).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      zone.setData('ladderTopY', topY);
      this.ladderZones.add(zone);

      const ladderInfo = {
        visual, shadow: ladShadow, zone, topY, bottomY, height,
        minX: minX || 40, maxX: maxX || ld.worldWidth - 40,
        isFalling: false, isBridge: false, destroyed: false, bridgeBody: null
      };
      zone.setData('ladderInfo', ladderInfo);
      this.ladderData.push(ladderInfo);
    };

    ld.ladders.forEach(l => addLadder(l.x, l.topY, l.bottomY, l.minX, l.maxX, l.depth));
  }

  createShadowZones() {
    this.shadowZones = this.physics.add.staticGroup();
    this.shadowVisuals = this.add.group();
    this._shadowArrows = [];   // down-arrow hints per shadow

    const addShadow = (x, y, w, h, shadowDepth) => {
      // Use shadow.png image stretched to fill the shadow zone
      const visual = this.add.image(x + w / 2, y + h / 2, 'shadow_img');
      visual.setDisplaySize(w, h);
      visual.setDepth(shadowDepth ?? 2);
      this.shadowVisuals.add(visual);

      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0);
      this.physics.add.existing(zone, true);
      this.shadowZones.add(zone);

      // Down-arrow indicator (shown when player is in this shadow)
      const arrowX = x + w / 2;
      const arrowY = y + 6;
      const arrow = this.add.text(arrowX, arrowY, '\u25BC', {
        font: 'bold 14px ChangaOne, monospace',
        fill: '#88bbff',
      }).setOrigin(0.5, 0).setDepth((shadowDepth ?? 2) + 0.1).setAlpha(0).setVisible(false);
      this._shadowArrows.push({ arrow, x, y, w, h });
    };

    this.levelData.shadows.forEach(s => addShadow(s.x, s.y, s.w, s.h, s.depth));
  }

  _updateShadowArrows() {
    if (!this._shadowArrows) return;
    const px = this.player.x;
    const py = this.player.y;
    const hiding = this.player.isHiding;
    const PROXIMITY = 50; // horizontal proximity to show arrow

    for (const sa of this._shadowArrows) {
      const inX = px >= sa.x - PROXIMITY && px <= sa.x + sa.w + PROXIMITY;
      const inY = py >= sa.y - 20 && py <= sa.y + sa.h + 10;
      const shouldShow = inX && inY && !hiding;

      if (shouldShow && !sa.arrow.visible) {
        sa.arrow.setVisible(true);
        // Bobbing tween
        if (!sa._tween) {
          sa.arrow.setAlpha(0.85);
          sa._tween = this.tweens.add({
            targets: sa.arrow,
            y: sa.arrow.y + 5,
            alpha: 0.4,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else {
          sa._tween.resume();
        }
      } else if (!shouldShow && sa.arrow.visible) {
        sa.arrow.setVisible(false);
        sa.arrow.setAlpha(0);
        if (sa._tween) sa._tween.pause();
      }
    }
  }

  createPaintCans() {
    this.paintCans = this.physics.add.group();
    const colors = this.levelColors;
    this.levelData.paintCans.forEach((c, i) => {
      // Use explicit color if specified, otherwise auto-assign round-robin from painting colors
      const color = c.color || colors[i % colors.length];
      const can = new PaintCan(this, c.x, c.y, color);
      this.paintCans.add(can);
    });
  }

  createHeartPickups() {
    this.heartPickups = this.physics.add.group();
    const hearts = this.levelData.hearts || [];
    hearts.forEach(h => {
      // Draw a heart using graphics — small red heart with glow
      const gfx = this.add.graphics();
      // Pulsing heart shape
      gfx.fillStyle(0xff2255, 1);
      gfx.fillCircle(-5, -3, 6);
      gfx.fillCircle(5, -3, 6);
      gfx.fillTriangle(-11, 0, 11, 0, 0, 12);
      // Render to texture
      const rtKey = `__heart_${h.x}_${h.y}`;
      const rt = this.add.renderTexture(0, 0, 24, 20);
      rt.draw(gfx, 12, 8);
      rt.saveTexture(rtKey);
      gfx.destroy();
      rt.destroy();

      const heart = this.add.image(h.x, h.y, rtKey).setDepth(5);
      this.physics.add.existing(heart, true);
      this.heartPickups.add(heart);

      // Floating animation
      this.tweens.add({
        targets: heart,
        y: h.y - 6,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // Overlap: player touches heart → heal
    this.physics.add.overlap(this.player, this.heartPickups, (player, heart) => {
      if (player.hp >= player.maxHp) return; // already full
      player.heal(1);
      // Pop effect
      this.tweens.add({
        targets: heart,
        scaleX: 1.5, scaleY: 1.5, alpha: 0,
        duration: 300,
        onComplete: () => heart.destroy()
      });
    });
  }

  createPaintSpots() {
    this.paintSpotZones = this.physics.add.staticGroup();
    this._muralGlows = [];

    const addSpot = (x, y, w, h, paintingKey, spotDepth) => {
      const depth = spotDepth ?? 2;
      // Subtle outline marking the mural area — background fill wall shows through
      const visual = this.add.graphics();
      visual.lineStyle(1, 0xffffff, 0.15);
      visual.strokeRect(x - w / 2, y - h / 2, w, h);
      visual.setDepth(depth);

      // Glow border (animated when player is nearby)
      const glowG = this.add.graphics();
      glowG.setDepth(depth + 0.1);

      // Star particles travelling the perimeter
      const NUM_STARS = 6;
      const stars = [];
      for (let i = 0; i < NUM_STARS; i++) {
        const sg = this.add.graphics();
        sg.setDepth(depth + 0.2);
        stars.push({ g: sg, t: i / NUM_STARS, speed: 0.00018 + Math.random() * 0.00008 });
      }

      // Interaction zone — slightly wider than visual for comfortable reach
      const interactPad = 10;  // small extra reach on each side
      const zone = this.add.zone(x - w / 2 - interactPad, y - h / 2, w + interactPad * 2, h).setOrigin(0, 0);
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

      this._muralGlows.push({ zone, glowG, stars, glowT: 0, rx: x - w / 2, ry: y - h / 2, rw: w, rh: h });
    };

    this.levelData.paintSpots.forEach(s => addSpot(s.x, s.y, s.w, s.h, s.paintingKey, s.depth));
  }

  _perimeterPos(t, rx, ry, rw, rh) {
    const perim = 2 * (rw + rh);
    let d = ((t % 1) + 1) % 1 * perim;
    if (d < rw)        return { x: rx + d,       y: ry };
    d -= rw;
    if (d < rh)        return { x: rx + rw,       y: ry + d };
    d -= rh;
    if (d < rw)        return { x: rx + rw - d,   y: ry + rh };
    d -= rw;
                       return { x: rx,             y: ry + rh - d };
  }

  _updateMuralGlow(time, delta) {
    if (!this._muralGlows) return;
    const activeSpot = this.interactablePaintSpot;

    this._muralGlows.forEach(entry => {
      if (entry.zone.getData('painted')) {
        entry.glowG.clear();
        entry.stars.forEach(s => s.g.clear());
        return;
      }

      const isActive = (entry.zone === activeSpot);
      entry.glowT += ((isActive ? 1 : 0) - entry.glowT) * 0.08;
      const gt = entry.glowT;

      const { rx, ry, rw, rh } = entry;

      // --- Glow border ---
      entry.glowG.clear();
      if (gt > 0.01) {
        const pulse = 0.75 + 0.25 * Math.sin(time * 0.004);
        const layers = [
          { lw: 8, alpha: 0.04 },
          { lw: 5, alpha: 0.09 },
          { lw: 3, alpha: 0.18 },
          { lw: 1, alpha: 0.55 },
        ];
        layers.forEach(l => {
          entry.glowG.lineStyle(l.lw, 0xffd080, l.alpha * gt * pulse);
          entry.glowG.strokeRect(rx, ry, rw, rh);
        });
      }

      // --- Star particles ---
      entry.stars.forEach(star => {
        star.g.clear();
        if (gt < 0.01) return;
        star.t = (star.t + star.speed * delta) % 1;
        const pos = this._perimeterPos(star.t, rx, ry, rw, rh);
        const starPulse = 0.4 + 0.6 * Math.sin(time * 0.006 + star.t * Math.PI * 6);
        const a = gt * starPulse;
        const sz = 1.5;
        // Cross sparkle
        star.g.fillStyle(0xffffff, a * 0.85);
        star.g.fillRect(pos.x - sz * 0.5, pos.y - sz * 2,   sz,      sz * 4);
        star.g.fillRect(pos.x - sz * 2,   pos.y - sz * 0.5, sz * 4,  sz);
        // Bright center
        star.g.fillStyle(0xffe090, a);
        star.g.fillCircle(pos.x, pos.y, 1.8);
      });
    });
  }

  createTrashCans() {
    this.levelData.trashCans.forEach(t => {
      const trash = new Trash(this, t.x, t.y);
      this.trashCans.push(trash);
    });
  }

  createCops() {
    if (this.mode !== 'stealth') return; // no cops in puzzle/tower modes
    this.levelData.cops.forEach(c => {
      const cop = new Cop(this, c.x, c.y, c.minX, c.maxX);
      this.cops.push(cop);
    });
  }

  createForeground() {
    const fg = this.add.graphics();
    fg.setDepth(8);
    (this.levelData.foregroundWires || []).forEach(w => {
      fg.lineStyle(1, 0x334455, 0.4);
      fg.lineBetween(w.x1, w.y1, w.x2, w.y2);
    });
  }

  createLamps() {
    (this.levelData.lamps || []).forEach(lm => {
      const x = lm.x, y = lm.y;
      const radius = lm.radius || 120;
      const intensity = lm.intensity || 0.35;
      const lampDepth = lm.depth ?? 6;  // above player (depth 5)

      // Lamp post image — 426x1071 source, preserve aspect ratio at height 202 → width 80
      const post = this.add.image(x, y, 'lamp_img').setOrigin(0.5, 1).setDepth(lampDepth);
      post.setDisplaySize(80, 202);

      // Light cone — simple trapezoid, linear gradient, in front of lamp
      const bulbX  = x + 16;
      const bulbY  = y - post.displayHeight + 16; // bulb head center in world
      const bulbR  = 15;
      const coneY  = bulbY - bulbR + 8;            // cone starts slightly below bulb top — trimmed
      const coneH  = Math.max(10, y - coneY);
      const botW   = radius;
      const topW   = 4;                           // very narrow top — blends into bulb

      const texKey = `_lamp_cone_${Math.round(bulbX)}_${Math.round(bulbY)}`;
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
      const texW = botW * 2 + 4;
      const texH = Math.round(coneH) + 4;
      const ct   = this.textures.createCanvas(texKey, texW, texH);
      const cc   = ct.getContext();
      const cx   = texW / 2;

      // Linear gradient: bright at top, transparent at bottom (guaranteed coverage)
      const grad = cc.createLinearGradient(0, 0, 0, texH);
      grad.addColorStop(0,    `rgba(255,220,120,${intensity})`);
      grad.addColorStop(0.45, `rgba(255,200,80,${intensity * 0.45})`);
      grad.addColorStop(0.85, `rgba(255,180,60,${intensity * 0.1})`);
      grad.addColorStop(1,    'rgba(255,180,60,0)');

      // Clip to trapezoid
      cc.beginPath();
      cc.moveTo(cx - topW, 0);
      cc.lineTo(cx + topW, 0);
      cc.lineTo(cx + botW, texH);
      cc.lineTo(cx - botW, texH);
      cc.closePath();
      cc.clip();
      cc.fillStyle = grad;
      cc.fillRect(0, 0, texW, texH);
      ct.refresh();

      // Place cone at coneY — top of cone aligns with bottom of bulb circle
      const cone = this.add.image(bulbX, coneY, texKey).setOrigin(0.5, 0).setDepth(lampDepth + 0.5);
      cone.setBlendMode(Phaser.BlendModes.ADD);

      // Central soft glow at bulb — radial gradient canvas texture
      const glowR  = 28;
      const glowKey = `_lamp_glow_${Math.round(bulbX)}_${Math.round(bulbY)}`;
      const glowSize = glowR * 2 + 2;
      const gt = this.textures.createCanvas(glowKey, glowSize, glowSize);
      const gc = gt.getContext();
      const ggrad = gc.createRadialGradient(glowR + 1, glowR + 1, 0, glowR + 1, glowR + 1, glowR);
      ggrad.addColorStop(0,    `rgba(255,255,220,${intensity * 0.9})`);
      ggrad.addColorStop(0.25, `rgba(255,230,140,${intensity * 0.6})`);
      ggrad.addColorStop(0.6,  `rgba(255,200,80,${intensity * 0.25})`);
      ggrad.addColorStop(1,    'rgba(255,180,60,0)');
      gc.fillStyle = ggrad;
      gc.fillRect(0, 0, glowSize, glowSize);
      gt.refresh();
      this.add.image(bulbX, bulbY, glowKey)
        .setOrigin(0.5, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(lampDepth + 0.6); // in front of lamp post
    });
  }

  // === TOWER MODE ===

  setupTowerMode() {
    const tc = this.levelData.timer || { startSeconds: 120, bonusPerMural: 30, warningAt: 20 };
    this._towerTimeLeft = tc.startSeconds;
    this._towerBonus = tc.bonusPerMural;
    this._towerWarningAt = tc.warningAt;
    this._towerMuralsDone = 0;
    this._towerGameOver = false;

    // Timer HUD text (on UI camera)
    this._addingHud = true;
    const gw = this.sys.game.config.width;
    this._towerTimerText = this.add.text(gw / 2, 32, '', {
      fontFamily: 'ChangaOne', fontSize: '36px', fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#003322', strokeThickness: 6
    }).setOrigin(0.5, 0).setDepth(300);
    this._addingHud = false;
    this.cameras.main.ignore(this._towerTimerText);

    // Color gates — physical barriers
    this._colorGates = [];
    (this.levelData.colorGates || []).forEach(g => {
      const gate = this.add.rectangle(g.x + g.w / 2, g.y, g.w, 8, 0xff4444, 0.7)
        .setDepth(10);
      this.physics.add.existing(gate, true); // static

      // Message text floating above gate
      const msg = this.add.text(g.x + g.w / 2, g.y - 16, g.message || '', {
        font: 'bold 10px ChangaOne, monospace', fill: '#ff6666',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5, 1).setDepth(10.1);
      gate.msgText = msg;
      gate.gateData = g;

      // Collider — blocks player until they have the required color
      this.physics.add.collider(this.player, gate, null, () => {
        const hasColor = this.player.hasPaint(g.requiredColor.toLowerCase());
        if (hasColor) {
          this.cameras.main.flash(200, 50, 255, 50);
          msg.destroy();
          gate.destroy();
          this._colorGates = this._colorGates.filter(x => x !== gate);
          return false;
        }
        return true;
      });

      this._colorGates.push(gate);
    });
  }

  updateTowerTimer(delta) {
    if (!this._towerTimerText || this._towerGameOver) return;

    this._towerTimeLeft -= delta / 1000;
    if (this._towerTimeLeft <= 0) {
      this._towerTimeLeft = 0;
      this._towerGameOver = true;
      this._towerTimerText.setText('CZAS MINĄŁ!').setFill('#ff3333');
      this.player.setVelocity(0, 0);
      this.player.body.allowGravity = false;
      this.time.delayedCall(2000, () => {
        this.scene.start('LevelSelectScene');
      });
      return;
    }

    const secs = Math.ceil(this._towerTimeLeft);
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    this._towerTimerText.setText(`${min}:${String(sec).padStart(2, '0')}`);

    if (secs <= this._towerWarningAt) {
      this._towerTimerText.setFill('#ff3333');
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
      this._towerTimerText.setScale(1 + pulse * 0.15);
    } else {
      this._towerTimerText.setFill('#00ff88');
      this._towerTimerText.setScale(1);
    }
  }

  onTowerMuralComplete() {
    if (this.mode !== 'tower') return;
    this._towerMuralsDone++;

    // Time bonus
    this._towerTimeLeft += this._towerBonus;

    // Flash bonus text on UI cam
    this._addingHud = true;
    const gw = this.sys.game.config.width;
    const bonusText = this.add.text(gw / 2, 42, `+${this._towerBonus}s`, {
      font: 'bold 18px ChangaOne, monospace', fill: '#ffdd33',
      stroke: '#332200', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(301);
    this._addingHud = false;
    this.cameras.main.ignore(bonusText);
    this.tweens.add({
      targets: bonusText, y: bonusText.y - 30, alpha: 0,
      duration: 1200, onComplete: () => bonusText.destroy()
    });

    // Color unlock
    const unlocks = this.levelData.colorUnlocks || [];
    const muralIdx = this._towerMuralsDone - 1;
    if (unlocks[muralIdx]) {
      const colorName = unlocks[muralIdx].toLowerCase();
      if (!this.player.hasPaint(colorName)) {
        this.player.collectPaint(colorName);
        this._addingHud = true;
        const unlockText = this.add.text(gw / 2, 70,
          `NOWY KOLOR: ${unlocks[muralIdx]}!`, {
          font: 'bold 14px ChangaOne, monospace', fill: '#33ff88',
          stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(301);
        this._addingHud = false;
        this.cameras.main.ignore(unlockText);
        this.tweens.add({
          targets: unlockText, y: unlockText.y - 40, alpha: 0,
          duration: 2500, onComplete: () => unlockText.destroy()
        });
      }
    }
  }

  // === HUD ===

  createHUD() {
    // HUD uses a dedicated scene overlay to avoid zoom issues
    // We add a second camera just for UI, with zoom=1
    const gw = this.sys.game.config.width;
    const gh = this.sys.game.config.height;
    this.uiCam = this.cameras.add(0, 0, gw, gh);
    this.uiCam.setZoom(1);
    this.uiCam.setScroll(0, 0);
    this.uiCam.setName('ui');

    // Paint inventory — slots auto-derived from level's paintings
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const uiScale = isMobile ? 1.8 : 1;
    const slotColors = this.levelColors;
    // Can display: 102x72 scaled to 28px tall → tighter spacing
    const slotSpacing = Math.round(26 * uiScale);
    const slotStartX = Math.round(28 * uiScale);
    const slotY = Math.round(26 * uiScale);
    this.hudBg = this.add.rectangle(Math.round(6 * uiScale), Math.round(6 * uiScale), slotColors.length * slotSpacing + Math.round(12 * uiScale), Math.round(42 * uiScale), 0x000000, 0.6)
      .setDepth(100).setScrollFactor(0).setOrigin(0, 0);

    this.hudSlots = [];
    for (let i = 0; i < slotColors.length; i++) {
      const sx = slotStartX + i * slotSpacing;
      // Both textures are native 102x72 from can.png — scale to ~28px tall
      const canScale = uiScale * 28 / 72;
      // Grey empty can (always visible as background)
      const empty = this.add.image(sx, slotY, 'hud_can_empty')
        .setDepth(100.5).setScrollFactor(0).setScale(canScale);
      // Colored filled can (hidden until collected)
      const filled = this.add.image(sx, slotY, `hud_can_${slotColors[i]}`)
        .setDepth(101).setScrollFactor(0).setVisible(false).setScale(canScale);
      // Count label below
      const count = this.add.text(sx, slotY + Math.round(17 * uiScale), '', {
        font: `bold ${Math.round(8 * uiScale)}px ChangaOne, monospace`,
        fill: '#ffffff',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setAlpha(0);

      this.hudSlots.push({ color: slotColors[i], empty, filled, count });
    }

    // Painted spots counter (after the slots)
    const counterX = slotStartX + slotColors.length * slotSpacing + Math.round(8 * uiScale);
    this.hudCountText = this.add.text(counterX, slotY, '', {
      font: `bold ${Math.round(10 * uiScale)}px ChangaOne, monospace`,
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

    // Status text (desktop only — mobile has no text hints)
    if (!isMobile) {
      this.statusText = this.add.text(gw / 2, 10, '', {
        font: `${Math.round(12 * uiScale)}px ChangaOne, monospace`,
        fill: '#00ff88',
        padding: { x: Math.round(6 * uiScale), y: Math.round(4 * uiScale) }
      }).setOrigin(0.5, 0).setDepth(100).setScrollFactor(0).setVisible(false);
    }

    // Music toggle button (speaker icon)
    this.musicOn = true;
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.07 });

    // === iOS audio unlock strategy ===
    // iOS Safari blocks ALL audio until a user gesture resumes the AudioContext.
    // We use multiple strategies to ensure music plays:
    // 1. Phaser's built-in 'unlocked' event
    // 2. Direct AudioContext resume + synchronous play in gesture handler
    // 3. Retry on every tap until music starts
    // 4. Delayed retry after scene starts (catches cases where unlock happened before scene)

    const tryPlayBgm = () => {
      if (!this.musicOn || !this.bgm) return;
      try {
        const ctx = this.sound.context;
        // Resume AudioContext if suspended (iOS requirement)
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(e => console.warn('AudioContext resume failed:', e));
        }
        // Play synchronously in the same call stack as the gesture
        if (!this.bgm.isPlaying) {
          this.bgm.play();
          console.log('BGM play called, context state:', ctx ? ctx.state : 'no-ctx');
        }
      } catch (e) {
        console.warn('BGM play failed:', e);
      }
    };

    // Strategy 1: Phaser's built-in sound unlock
    if (this.sound.locked) {
      console.log('Sound is locked, waiting for unlock...');
      this.sound.once('unlocked', () => {
        console.log('Phaser sound unlocked!');
        tryPlayBgm();
      });
    } else {
      tryPlayBgm();
    }

    // Strategy 2: retry on EVERY tap/touch until music starts
    this.input.on('pointerdown', () => {
      if (this.musicOn && this.bgm && !this.bgm.isPlaying) {
        tryPlayBgm();
      }
    });

    // Strategy 3: global document touch listener (catches taps outside Phaser canvas)
    const docTouchHandler = () => {
      if (this.musicOn && this.bgm && !this.bgm.isPlaying) {
        tryPlayBgm();
      }
    };
    document.addEventListener('touchstart', docTouchHandler);
    document.addEventListener('click', docTouchHandler);
    // Clean up when scene shuts down
    this.events.on('shutdown', () => {
      document.removeEventListener('touchstart', docTouchHandler);
      document.removeEventListener('click', docTouchHandler);
    });

    // Strategy 4: delayed retry — if context was already unlocked by main.js handler
    this.time.delayedCall(500, tryPlayBgm);
    this.time.delayedCall(2000, tryPlayBgm);

    // Menu button — return to main menu
    const menuBtnX = gw - Math.round(110 * uiScale);
    const menuBtnY = Math.round(18 * uiScale);
    const menuBtnSize = Math.round(64 * uiScale);
    this.menuBtnHit = this.add.rectangle(menuBtnX + menuBtnSize / 2 - 4, menuBtnY + menuBtnSize / 2 - 8, menuBtnSize, menuBtnSize, 0x000000, 0)
      .setDepth(99).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.menuBtn = this.add.text(menuBtnX, menuBtnY, '\u2302', {
      font: `bold ${Math.round(20 * uiScale)}px ChangaOne, monospace`,
      fill: '#aabbcc',
      backgroundColor: '#000000aa',
      padding: { x: Math.round(6 * uiScale), y: Math.round(4 * uiScale) }
    }).setDepth(100).setScrollFactor(0);

    this.menuBtnHit.on('pointerdown', () => {
      if (this.bgm) this.bgm.stop();
      this.scene.start('MenuScene');
    });

    const muteBtnSize = Math.round(64 * uiScale);
    const muteBtnX = gw - Math.round(55 * uiScale);
    const muteBtnY = Math.round(18 * uiScale);
    // Invisible hit area for easier tapping on mobile
    this.muteBtnHit = this.add.rectangle(muteBtnX + muteBtnSize / 2 - 4, muteBtnY + muteBtnSize / 2 - 8, muteBtnSize, muteBtnSize, 0x000000, 0)
      .setDepth(99).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.muteBtn = this.add.text(muteBtnX, muteBtnY, '\u266B', {
      font: `bold ${Math.round(20 * uiScale)}px ChangaOne, monospace`,
      fill: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: Math.round(6 * uiScale), y: Math.round(4 * uiScale) }
    }).setDepth(100).setScrollFactor(0);

    this.muteBtnHit.on('pointerdown', () => {
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

    // === HEART HUD (stealth mode only) — on same line as paint cans, to the right ===
    this.hudHearts = [];
    if (this.mode === 'stealth') {
      this._addingHud = true;
      // Place hearts after counter text, on the same Y as paint slots
      const heartScale = uiScale * 28 / 40; // 40px source → ~28px display
      const heartSpacing = Math.round(34 * uiScale);
      const heartStartX = counterX + Math.round(50 * uiScale);
      for (let i = 0; i < this.player.maxHp; i++) {
        const hx = heartStartX + i * heartSpacing;
        const full = this.add.image(hx, slotY, 'heart_icon')
          .setDepth(101).setScrollFactor(0).setScale(heartScale);
        const empty = this.add.image(hx, slotY, 'heart_icon')
          .setDepth(100.5).setScrollFactor(0).setScale(heartScale)
          .setTint(0x331111).setAlpha(0.5);
        this.hudHearts.push({ full, empty });
      }
      this._addingHud = false;
    }

    // Resize HUD background to cover hearts too
    if (this.hudHearts.length > 0) {
      const lastHeart = this.hudHearts[this.hudHearts.length - 1];
      const bgRight = lastHeart.full.x + Math.round(14 * uiScale);
      this.hudBg.width = bgRight - this.hudBg.x;
    }

    // Collect all HUD elements for camera management
    const slotElements = [];
    this.hudSlots.forEach(s => slotElements.push(s.empty, s.filled, s.count));
    const heartElements = [];
    this.hudHearts.forEach(h => heartElements.push(h.full, h.empty));

    // Main camera ignores HUD + touch controls, UI camera ignores everything else
    const hudElements = [this.hudBg, this.hudCountText, this.statusText, this.menuBtn, this.menuBtnHit, this.muteBtn, this.muteBtnHit,
      ...slotElements, ...heartElements, ...this.touch.getElements()].filter(Boolean);
    this.cameras.main.ignore(hudElements);

    // Ignore all existing world objects on UI cam
    this.children.list.forEach(child => {
      if (!hudElements.includes(child)) {
        this.uiCam.ignore(child);
      }
    });

    // Track HUD elements set for camera routing
    this._hudElements = new Set(hudElements);

    // Auto-ignore any future objects added to the scene (unless marked as HUD)
    this.events.on('addedtoscene', (obj) => {
      if (this._addingHud) return; // skip when adding HUD elements
      if (this.uiCam && !this._hudElements.has(obj)) {
        this.uiCam.ignore(obj);
      }
    });
  }

  updateHearts() {
    for (let i = 0; i < this.hudHearts.length; i++) {
      this.hudHearts[i].full.setVisible(i < this.player.hp);
    }
  }

  updateHUD() {
    this.updateHearts();
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

    const isMob = !!(this.touch && this.touch.enabled);

    if (!isMob && this.statusText) {
      let msg = '';
      let color = '#00ff88';

      if (this.player.isPainting) {
        const colorInfo = this.pbn ? ` | Kolor: ${this.pbn.getSelectedColorName()} (1-${this.pbn.colorMap.length})` : '';
        msg = `[ MALOWANIE${colorInfo} — SPACE anuluj ]`;
        color = '#ffdd33';
      } else if (this.player.isPushingLadder) {
        msg = '[ PRZESUWANIE DRABINY — E puść ]';
        color = '#ffaa33';
      } else if (this.player.isPushingTrash) {
        msg = '[ PRZESUWANIE KOSZA — E puść ]';
        color = '#ffaa33';
      } else {
        // Build context hints
        const hints = [];
        let paintHint = false;

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

        if (hints.length > 0) {
          msg = `[ ${hints.join('  |  ')} ]`;
          color = paintHint ? '#ffdd33' : '#00ff88';
        }
      }

      if (msg) {
        this.statusText.setText(msg);
        this.statusText.setStyle({ fill: color, backgroundColor: '#000000aa' });
        this.statusText.setVisible(true);
      } else {
        this.statusText.setText('');
        this.statusText.setStyle({ backgroundColor: '' });
        this.statusText.setVisible(false);
      }
    }
  }

  // === ACTIVE PAINT-BY-NUMBERS SYSTEM ===

  tryPaint() {
    if (!this.interactablePaintSpot) return;

    // Player must be standing on something or on a ladder to paint (not mid-air)
    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    const onLadder = this.player.isClimbing || this.player.onLadder;
    if (!onGround && !onLadder) return;

    // Remember if player was on ladder before painting
    this._paintedFromLadder = this.player.isClimbing || this.player.onLadder;

    // Exit climbing state now that we confirmed painting is valid
    if (this.player.isClimbing) {
      this.player.isClimbing = false;
      this.player.onLadder = false;
      this.player.body.allowGravity = false; // keep floating while painting
      this.player.setVelocity(0, 0);
    }

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
          font: '11px ChangaOne, monospace',
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
    const spotX = spot.getData('spotX');  // center X of mural
    const spotY = spot.getData('spotY');  // center Y of mural
    const bounds = {
      x: spotX - spotW / 2,   // top-left X
      y: spotY - spotH / 2,   // top-left Y
      w: spotW,
      h: spotH
    };

    this.activePaintSpot = spot;

    // Auto-flip player to face the mural (center of paint area)
    const muralCenterX = bounds.x + bounds.w / 2;
    if (muralCenterX < this.player.x) {
      this.player.setFlipX(true);   // mural is to the left
    } else {
      this.player.setFlipX(false);  // mural is to the right
    }

    // Reuse existing PBN instance (saved on cancel) or create new one
    const savedPBN = spot.getData('pbnInstance');
    if (savedPBN) {
      this.pbn = savedPBN;
      this.pbn.show(); // re-show template + numbers
    } else {
      this.pbn = new PaintByNumbers(this, bounds, gridData);
    }

    // Restore last selected color if player still has it, otherwise pick first available
    const paintingColors = gridData.colors || ['RED', 'BLUE', 'YELLOW'];
    let restored = false;
    if (this._lastPaintColorIndex != null && this._lastPaintColorIndex < paintingColors.length) {
      const lastColorName = paintingColors[this._lastPaintColorIndex];
      if (lastColorName && this.player.hasPaint(lastColorName.toLowerCase())) {
        this.pbn.setSelectedColor(this._lastPaintColorIndex);
        restored = true;
      }
    }
    if (!restored) {
      for (let i = 0; i < paintingColors.length; i++) {
        if (this.player.hasPaint(paintingColors[i].toLowerCase())) {
          this.pbn.setSelectedColor(i);
          break;
        }
      }
    }

    // Paint progress HUD text
    const progress = this.pbn.getProgress();
    const isMob = !!(this.touch && this.touch.enabled);
    if (isMob) {
      // On mobile: fixed to screen on HUD line (same Y as paint cans / hearts)
      const gw = this.sys.game.config.width;
      const hudY = Math.round(26 * 1.8); // matches slotY on mobile
      this._addingHud = true;
      this.paintProgressText = this.add.text(
        gw / 2, hudY,
        `${Math.round(progress * 100)}%`,
        { fontFamily: 'ChangaOne, monospace', fontSize: '48px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 6, padding: { x: 4, y: 2 } }
      ).setOrigin(0.5).setDepth(200).setScrollFactor(0);
      this.cameras.main.ignore(this.paintProgressText);
      this._addingHud = false;
    } else {
      // Desktop: fixed to top-center of screen on UI camera
      const gw = this.sys.game.config.width;
      const progressY = (this.levelData && this.levelData.mode === 'tower') ? 95 : 60;
      this._addingHud = true;
      this.paintProgressText = this.add.text(
        gw / 2, progressY,
        `${Math.round(progress * 100)}%`,
        { fontFamily: 'ChangaOne, monospace', fontSize: '48px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 6, padding: { x: 4, y: 2 } }
      ).setOrigin(0.5).setDepth(200).setScrollFactor(0);
      this.cameras.main.ignore(this.paintProgressText);
      this._addingHud = false;
    }

    // Color selector HUD — touch buttons on mobile, world-space boxes on desktop
    const isMobileDevice = this.touch && this.touch.enabled;
    if (isMobileDevice) {
      // Flag prevents addedtoscene handler from ignoring these on uiCam
      this._addingHud = true;
      this.touch.createColorButtons(this, (colorIdx) => {
        if (this.pbn) {
          this.pbn.setSelectedColor(colorIdx);
          this.player.paintColor = this.pbn.getSelectedColorHex();
          this.paintArm.setCanColor(this.pbn.getSelectedColorName());
          this.updateTouchColorHighlight();
        }
      }, this.pbn.colorMap, () => {
        if (this.player.isPainting) {
          this.player.stopPainting();
          this.cancelPainting();
        }
      });
      this._addingHud = false;
      // Hide from main cam (they render on uiCam only)
      if (this.touch.colorButtons) {
        const allColorEls = [];
        this.touch.colorButtons.forEach(btn => {
          allColorEls.push(btn.bg, btn.text);
          if (this._hudElements) {
            this._hudElements.add(btn.bg);
            this._hudElements.add(btn.text);
          }
        });
        this.cameras.main.ignore(allColorEls);
      }
    } else {
      this.createColorSelector(bounds);
    }

    // Color switch keys (1-3 or 1-4 depending on painting colors)
    const keyCodes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE,
    ];
    const numPaintColors = this.pbn.colorMap.length;
    this.colorKeys = keyCodes.slice(0, numPaintColors).map(k => this.input.keyboard.addKey(k));

    // --- Camera zoom into paint area (keep following player) ---
    const cam = this.cameras.main;
    const isMobile = !!(this.touch && this.touch.enabled);
    // Only capture base zoom if not already saved (avoid capturing mid-animation value)
    if (this._preZoom == null) {
      this._preZoom = this._baseZoom || cam.zoom;
    }

    const targetZoom = isMobile ? 4.2 : 3.3;

    // Keep following the player — just zoom in smoothly.
    // Camera stays centered on player so we always see what's happening,
    // even on large murals where the center is far from the player.
    cam.zoomTo(targetZoom, 400, 'Sine.easeInOut');

    // Start paint arm (hand + rope + spray can)
    const startColor = this.pbn ? this.pbn.getSelectedColorName() : null;
    this.paintArm.start(this.player.x, this.player.y, this.player.flipX, bounds, startColor);
    if (this.touch) this.touch.setPaintMode(true);

    // --- Paint SFX ---
    this.sfxSpray = this.sound.add('sfx_spray', { loop: true, volume: 0.135 });
    this._paintIdleTimer = 0;
    this._nextShakeDelay = Phaser.Math.Between(3000, 7000);
    this._sprayPlaying = false;

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
    this._colorSelectorBounds = bounds;
    const colorNames = this.pbn.colorMap;
    const boxSize = 28;   // screen-space pixels (UI camera, zoom=1)
    const gap = 6;
    this._cselBoxSize = boxSize;
    this._cselGap = gap;

    // Create on UI camera so they're always visible regardless of world zoom
    this._addingHud = true;
    for (let i = 0; i < colorNames.length; i++) {
      const hex = PAINT.COLORS[colorNames[i]] || 0xffffff;
      const hasColor = this.player.hasPaint(colorNames[i].toLowerCase());
      const alpha = hasColor ? 0.9 : 0.25;

      const box = this.add.rectangle(0, 0, boxSize, boxSize, hex, alpha)
        .setDepth(200).setStrokeStyle(1, 0xffffff, 0.5);
      const num = this.add.text(0, 0, String(i + 1), {
        font: 'bold 11px ChangaOne, monospace', fill: '#000000'
      }).setOrigin(0.5).setDepth(200.1).setAlpha(hasColor ? 1 : 0.3);

      this.colorSelectorElements.push(box, num);
    }
    this._addingHud = false;

    // Hide from main camera — they live on uiCam only
    this.cameras.main.ignore(this.colorSelectorElements);

    this.updateColorSelectorPosition();
    this.updateColorSelectorHighlight();
  }

  updateColorSelectorPosition() {
    if (!this.colorSelectorElements || this.colorSelectorElements.length === 0) return;

    const numColors = this.colorSelectorElements.length / 2;
    const boxSize = this._cselBoxSize || 28;
    const gap = this._cselGap || 6;
    const totalH = numColors * (boxSize + gap) - gap;

    // Elements live on uiCam (zoom=1, scroll=0) — use screen coordinates
    const cam = this.cameras.main;
    const gw = this.sys.game.config.width;
    const gh = this.sys.game.config.height;
    const margin = 14;

    // Decide side based on player position relative to the MURAL center
    // so the selector stays on one side consistently while painting
    const wv = cam.worldView;
    const playerScreenY = ((this.player.y - wv.y) / wv.height) * gh;

    const b = this._colorSelectorBounds;
    const muralCenterX = b ? (b.x + b.w / 2) : this.player.x;
    const playerOnLeftOfMural = this.player.x < muralCenterX;
    const baseX = playerOnLeftOfMural
      ? margin + boxSize / 2                   // left edge
      : gw - margin - boxSize / 2;             // right edge

    // Vertically centred on player's screen Y, clamped to viewport
    const clampedY = Phaser.Math.Clamp(
      playerScreenY - totalH / 2,
      margin,
      gh - totalH - margin
    );

    for (let i = 0; i < numColors; i++) {
      const box = this.colorSelectorElements[i * 2];
      const num = this.colorSelectorElements[i * 2 + 1];
      const cy = clampedY + i * (boxSize + gap) + boxSize / 2;
      box.setPosition(baseX, cy);
      num.setPosition(baseX, cy);
    }
  }

  updateColorSelectorHighlight() {
    // Desktop world-space selector
    if (this.colorSelectorElements && this.pbn) {
      const sel = this.pbn.selectedColorIndex;
      const numColors = this.pbn.colorMap.length;
      for (let i = 0; i < numColors; i++) {
        const box = this.colorSelectorElements[i * 2];
        if (!box) continue;
        if (i === sel) {
          box.setStrokeStyle(2, 0xffffff, 1);
        } else {
          box.setStrokeStyle(1, 0xffffff, 0.3);
        }
      }
    }
    // Mobile touch color buttons
    this.updateTouchColorHighlight();
  }

  updateTouchColorHighlight() {
    if (!this.touch || !this.touch.colorButtons || !this.pbn) return;
    const sel = this.pbn.selectedColorIndex;
    this.touch.colorButtons.forEach((btn, idx) => {
      btn.bg.setStrokeStyle(idx === sel ? 3 : 2, 0xffffff, idx === sel ? 1 : 0.3);
    });
  }

  onPaintMove(handX, handY) {
    if (!this.pbn) return;

    // Block painting if player doesn't have the selected color
    const selectedColorName = this.pbn.getSelectedColorName().toLowerCase();
    if (!this.player.hasPaint(selectedColorName)) return;

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
      const usedColors = this.pbn.colorMap;
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
      this.pbn.hide();
    }

    // Paint splash effect
    this.sfx.paintWall();
    this.cameras.main.flash(200, 100, 200, 100, false);
    const spotX = spot.getData('spotX') || spot.x;
    const spotY = spot.getData('spotY') || spot.y;
    const splash = this.add.text(spotX, spotY, 'TAGGED!', {
      font: 'bold 16px ChangaOne, monospace',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 3
    }).setOrigin(0.5).setDepth(15);

    this.tweens.add({
      targets: splash,
      y: splash.y - 30,
      alpha: 0,
      duration: 1000,
      onComplete: () => splash.destroy()
    });

    this.cleanupPaintState(false);

    // Tower mode: time bonus + color unlock
    this.onTowerMuralComplete();

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

    // Restore ladder state if player was painting from a ladder
    if (this._paintedFromLadder) {
      this.player.isClimbing = true;
      this.player.onLadder = true;
      this.player.body.allowGravity = false;
      this.player.setVelocity(0, 0);
      this._paintedFromLadder = false;
    }
  }

  cleanupPaintState(destroyPBN = true) {
    // Remember last selected color for next paint session
    if (this.pbn) {
      this._lastPaintColorIndex = this.pbn.selectedColorIndex;
    }
    // --- Camera zoom out (camera still follows player, just restore zoom) ---
    if (this._preZoom != null) {
      // Always restore to the reliable base zoom, not a possibly mid-animation value
      const restoreZoom = this._baseZoom || this._preZoom;
      this.cameras.main.zoomTo(restoreZoom, 350, 'Sine.easeInOut');
      this._preZoom = null;
    }

    // Stop paint SFX
    if (this.sfxSpray) {
      this.sfxSpray.stop();
      this.sfxSpray.destroy();
      this.sfxSpray = null;
    }
    this._sprayPlaying = false;
    this._paintIdleTimer = 0;

    this.paintArm.stop();
    if (this.touch) this.touch.setPaintMode(false);

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

  // === WIND LEAVES EFFECT ===

  createLeafEffect() {
    const LEAF_TINTS = [0xe8c830, 0xd4a820, 0xf0d840, 0xc89028, 0xb87820];
    const mapW = this.levelData.mapWidth  || 1400;
    const mapH = this.levelData.mapHeight || 600;

    // Spawn a leaf in world-space — independent of camera
    const spawnLeaf = () => {
      // Start from right edge of the map (+ margin) at random height
      const startX    = mapW + Phaser.Math.Between(20, 80);
      const startY    = Phaser.Math.Between(10, mapH - 10);
      const endX      = -80;
      const driftY    = Phaser.Math.Between(-90, 90);
      const waves     = Phaser.Math.FloatBetween(1.5, 3.5);
      const waveAmp   = Phaser.Math.Between(20, 55);
      const speedPx   = Phaser.Math.Between(50, 120);
      const duration  = ((startX - endX) / speedPx) * 1000;
      const startAngle = Phaser.Math.Between(0, 360);
      const totalRot  = Phaser.Math.Between(200, 500) * (Math.random() < 0.5 ? 1 : -1);

      const leaf = this.add.image(startX, startY, 'leaf_tex')
        .setScale(Phaser.Math.FloatBetween(0.8, 1.4))
        .setAngle(startAngle)
        .setAlpha(0.88)
        .setDepth(50)
        .setTint(LEAF_TINTS[Phaser.Math.Between(0, LEAF_TINTS.length - 1)]);

      const prog = { t: 0 };
      this.tweens.add({
        targets: prog, t: 1, duration,
        onUpdate: () => {
          const t = prog.t;
          leaf.x     = startX + (endX - startX) * t;
          leaf.y     = startY + driftY * t + Math.sin(t * waves * Math.PI * 2) * waveAmp;
          leaf.angle = startAngle + totalRot * t;
          leaf.alpha = t > 0.8 ? 0.88 * (1 - (t - 0.8) / 0.2) : 0.88;
        },
        onComplete: () => leaf.destroy(),
      });
    };

    // Schedule recurring spawns
    const schedule = () => {
      const delay = Phaser.Math.Between(2500, 6000);
      this._leafTimer = this.time.delayedCall(delay, () => {
        spawnLeaf();
        if (Math.random() < 0.3) {
          const n = Phaser.Math.Between(1, 2);
          for (let i = 1; i <= n; i++) {
            this.time.delayedCall(i * Phaser.Math.Between(300, 700), () => spawnLeaf());
          }
        }
        schedule();
      });
    };

    // Initial spawn + start scheduling
    spawnLeaf();
    schedule();
  }

  // === TRASH PUSH HELPER ===

  exitTrashPush() {
    this.player.isPushingTrash = false;
    this.trashCans.forEach(t => {
      if (!t.body) return;
      t.body.immovable = true;
      t.body.setVelocityX(0);
      t.isBeingPushed = false;
    });
  }

  // === LADDER PUSH SYSTEM ===

  moveLadder(ladderInfo, dx) {
    if (!ladderInfo || ladderInfo.isFalling || ladderInfo.isBridge) return 0;

    let minX = ladderInfo.minX;
    let maxX = ladderInfo.maxX;

    // Extend allowed range to cover any existing bridges so ladder can cross them
    for (const l of this.ladderData) {
      if (!l.isBridge || !l.bridgeBody || !l.bridgeBody.body) continue;
      const bb = l.bridgeBody.body;
      minX = Math.min(minX, bb.x + 10);
      maxX = Math.max(maxX, bb.x + bb.width - 10);
    }

    const newX = Phaser.Math.Clamp(ladderInfo.visual.x + dx, minX, maxX);
    const actualDx = newX - ladderInfo.visual.x;
    if (Math.abs(actualDx) < 0.1) return 0;

    // Move visual and shadow
    ladderInfo.visual.x = newX;
    if (ladderInfo.shadow) ladderInfo.shadow.x = newX + 5;

    // Move zone (origin 0,0, so x = center - half width)
    const zoneW = ladderInfo.zone.width;
    ladderInfo.zone.x = newX - zoneW / 2;
    ladderInfo.zone.body.reset(ladderInfo.zone.x, ladderInfo.zone.y);

    // --- Check if ladder base went past platform edge → trigger fall ---
    this._checkLadderEdgeFall(ladderInfo, dx);

    return actualDx;
  }

  /**
   * Check if the ladder's base is past the edge of its supporting platform.
   * If so, trigger the falling/rotation animation.
   */
  _checkLadderEdgeFall(ladderInfo, pushDx) {
    if (ladderInfo.isFalling || ladderInfo.isBridge) return;

    const ladderX = ladderInfo.visual.x;
    const ladderBottomY = ladderInfo.bottomY;

    // Find the platform the ladder is standing on
    const supportPlatform = this._findSupportingPlatform(ladderX, ladderBottomY);
    if (!supportPlatform) return;

    const platLeft = supportPlatform.x - supportPlatform.width / 2;
    const platRight = supportPlatform.x + supportPlatform.width / 2;

    // Direction: which way was the ladder pushed?
    let fallDir = 0;
    if (ladderX <= platLeft + 8) fallDir = -1;
    else if (ladderX >= platRight - 8) fallDir = 1;

    if (fallDir === 0) return;

    // If a bridge exists under the ladder at this position, don't fall — ride the bridge
    if (this._isOnBridge(ladderX, ladderBottomY)) return;

    console.log('[LADDER FALL] Edge detected! dir:', fallDir, 'ladderX:', ladderX, 'plat:', platLeft, '-', platRight);
    this._triggerLadderFall(ladderInfo, fallDir, supportPlatform);
  }

  /**
   * Check if a given position is horizontally over a bridge collider.
   */
  _isOnBridge(x, bottomY) {
    const TOLERANCE = 20;
    for (const bridge of this._bridgeBodies) {
      if (!bridge.body) continue;
      const bb = bridge.body;
      if (x >= bb.x && x <= bb.x + bb.width && Math.abs(bottomY - bb.y) < TOLERANCE) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the platform (or ground) directly below a given X,Y position.
   */
  _findSupportingPlatform(x, bottomY) {
    const TOLERANCE = 12;
    let best = null;
    let bestDist = Infinity;

    const checkGroup = (group) => {
      group.getChildren().forEach(plat => {
        const pTop = plat.y - plat.height / 2;
        const pLeft = plat.x - plat.width / 2;
        const pRight = plat.x + plat.width / 2;
        const distY = Math.abs(bottomY - pTop);
        if (distY < TOLERANCE && x >= pLeft - 20 && x <= pRight + 20 && distY < bestDist) {
          bestDist = distY;
          best = plat;
        }
      });
    };

    checkGroup(this.platforms);
    checkGroup(this.ground);
    return best;
  }

  /**
   * Trigger ladder fall: rotate 90° around its base pivot, check for landing platform.
   * @param {object} ladderInfo
   * @param {number} dir — -1 (fall left) or +1 (fall right)
   * @param {Phaser.GameObjects.TileSprite} sourcePlatform — the platform it was standing on
   */
  _triggerLadderFall(ladderInfo, dir, sourcePlatform) {
    ladderInfo.isFalling = true;

    // Force player to release ladder
    if (this.player.isPushingLadder && this.player.pushLadderInfo === ladderInfo) {
      this.player.stopLadderPush();
    }

    // Disable climb zone immediately
    ladderInfo.zone.body.enable = false;

    // Hide shadow — it won't follow the rotation
    if (ladderInfo.shadow) { ladderInfo.shadow.destroy(); ladderInfo.shadow = null; }

    const visual = ladderInfo.visual;
    const ladderHeight = ladderInfo.height;

    // Pivot point: the base of the ladder on the platform edge
    const pivotX = visual.x;
    const pivotY = ladderInfo.bottomY;

    // ── APPROACH: Move the ORIGINAL tileSprite into the bridge layer ──
    // Instead of creating copies via RenderTexture (which can produce empty textures),
    // we simply reparent the existing visual into the high-depth layer.
    // The Layer (depth 50) guarantees it renders above all platforms (depth 3).
    visual.setOrigin(0.5, 1.0);
    // After changing origin, we must reposition so the bottom-center is at the pivot
    visual.setPosition(pivotX, pivotY);
    // Move from scene display list → bridge layer display list
    this.children.remove(visual);
    this._bridgeLayer.add(visual);

    // Target rotation: 90° in fall direction
    const targetAngle = dir * (Math.PI / 2);

    // Check if there's a landing platform within ladder reach
    const landingPlatform = this._findLandingPlatform(pivotX, pivotY, ladderHeight, dir, sourcePlatform);

    let finalAngle = targetAngle;

    if (landingPlatform) {
      const landPlatTop = landingPlatform.y - landingPlatform.height / 2;
      const landPlatEdge = dir === 1
        ? (landingPlatform.x - landingPlatform.width / 2)
        : (landingPlatform.x + landingPlatform.width / 2);
      const dy = pivotY - landPlatTop;
      const dxToEdge = Math.abs(landPlatEdge - pivotX);
      if (dxToEdge <= ladderHeight && dy >= 0 && dy <= ladderHeight) {
        const angle = Math.acos(Phaser.Math.Clamp(dy / ladderHeight, -1, 1));
        finalAngle = dir * angle;
      }
      console.log('[LADDER FALL] Landing platform found!');
    } else {
      console.log('[LADDER FALL] No landing platform — ladder will fall off.');
    }

    // === PHASE 1: Rotation — ladder tips over ===
    this.tweens.add({
      targets: visual,
      rotation: finalAngle,
      duration: 600,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        if (!landingPlatform) {
          // No platform: fall off screen
          this.tweens.add({
            targets: visual,
            y: visual.y + 500,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeIn',
            onComplete: () => {
              visual.destroy();
              ladderInfo.destroyed = true;
              ladderInfo.isFalling = false;
            }
          });
          return;
        }

        // === PHASE 2: Squeeze width to 0 — "collapse" the old ladder visual ===
        this.tweens.add({
          targets: visual,
          scaleX: 0,
          duration: 300,
          ease: 'Quad.easeIn',
          onComplete: () => {
            visual.destroy();

            // === PHASE 3: Create new plank (drabinka2) ===
            this._createLadderBridge(ladderInfo, pivotX, pivotY, ladderHeight, dir, landingPlatform);
          }
        });
      }
    });
  }

  /**
   * Find a platform that can catch the falling ladder.
   * Search in the fall direction within ladder-height distance.
   */
  _findLandingPlatform(pivotX, pivotY, ladderHeight, dir, sourcePlatform) {
    const SEARCH_TOLERANCE_Y = 60; // platform can be up to 60px higher or lower
    let best = null;
    let bestDist = Infinity;

    const checkGroup = (group) => {
      group.getChildren().forEach(plat => {
        if (plat === sourcePlatform) return; // skip the platform the ladder was standing on
        const pTop = plat.y - plat.height / 2;
        const pLeft = plat.x - plat.width / 2;
        const pRight = plat.x + plat.width / 2;

        // Platform top must be near the pivot Y (within tolerance)
        if (Math.abs(pTop - pivotY) > SEARCH_TOLERANCE_Y) return;

        // Platform must be in the fall direction
        if (dir === 1) {
          // Falling right: platform's left edge should be reachable
          const distToLeftEdge = pLeft - pivotX;
          if (distToLeftEdge > 0 && distToLeftEdge <= ladderHeight + 10 && distToLeftEdge < bestDist) {
            bestDist = distToLeftEdge;
            best = plat;
          }
        } else {
          // Falling left: platform's right edge should be reachable
          const distToRightEdge = pivotX - pRight;
          if (distToRightEdge > 0 && distToRightEdge <= ladderHeight + 10 && distToRightEdge < bestDist) {
            bestDist = distToRightEdge;
            best = plat;
          }
        }
      });
    };

    checkGroup(this.platforms);
    checkGroup(this.ground);
    return best;
  }

  /**
   * Convert a fallen ladder into a walkable bridge (static physics body).
   */
  _createLadderBridge(ladderInfo, pivotX, pivotY, ladderHeight, dir, landingPlatform) {
    ladderInfo.isBridge = true;
    ladderInfo.isFalling = false;

    const landPlatTop = landingPlatform.y - landingPlatform.height / 2;

    // Bridge spans from pivot point to landing platform edge
    const bridgeStartX = pivotX;
    const bridgeEndX = dir === 1
      ? (landingPlatform.x - landingPlatform.width / 2)
      : (landingPlatform.x + landingPlatform.width / 2);

    const bridgeWidth = Math.abs(bridgeEndX - bridgeStartX);
    const bridgeCenterX = (bridgeStartX + bridgeEndX) / 2;

    // === Plank visual: plain Image stretched to ladder height (no tiling) ===
    // drabinka2.png is 10×31 — stretch length to match ladder, keep original thickness.
    const PLANK_TEX_W = 10;  // original texture width (thickness)
    const plankDisplayLength = ladderHeight;  // same length as original ladder
    const plankDisplayThick = PLANK_TEX_W * 0.8;  // 80% of original thickness

    // Position: plank rests on top of platform edges
    const avgPlatTop = (pivotY + landPlatTop) / 2;
    const bridgeCenterY = avgPlatTop - 4;

    // Plank center: halfway along its full length from pivot
    const plankCenterX = pivotX + dir * (plankDisplayLength / 2);

    // Create as plain Image (no tiling), stretch to match ladder size
    const plankVisual = this.add.image(plankCenterX, bridgeCenterY, 'ladder_plank');
    plankVisual.setDisplaySize(plankDisplayThick, plankDisplayLength); // width=10px thick, height=ladderHeight long
    plankVisual.setAngle(dir * 90); // rotate to lay flat
    // When falling left, flip so asset top faces up
    if (dir === -1) plankVisual.setFlipY(true);
    // Move to bridge layer (depth 50, renders above platforms)
    this.children.remove(plankVisual);
    this._bridgeLayer.add(plankVisual);

    // Quick fade-in
    plankVisual.setAlpha(0);
    this.tweens.add({
      targets: plankVisual,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut'
    });

    // === Physics collider — spans FULL plank length (including parts over platforms) ===
    const BRIDGE_H = 16;
    const colliderY = bridgeCenterY - plankDisplayThick / 2 + BRIDGE_H / 2;
    const bridge = this.add.rectangle(plankCenterX, colliderY, plankDisplayLength, BRIDGE_H, 0x000000, 0);
    this.physics.add.existing(bridge, true);
    bridge.body.checkCollision.down = false;
    bridge.body.checkCollision.left = false;
    bridge.body.checkCollision.right = false;

    // Mark bridge so we can identify it in collider callbacks
    bridge.setData('isBridgePlank', true);

    // Dedicated collider for player — NOT in platforms group to avoid double-collision jitter
    this.physics.add.collider(this.player, bridge, null, (player) => {
      if (player.isClimbing || player.isDroppingToLadder || player.isClimbing2) return false;
      // DROP-THROUGH: pressing DOWN while on bridge → fall through
      if (player._droppingThroughBridge) return false;
      const down = player.cursors.down.isDown || player.wasdKeys.down.isDown
        || (player.touch && player.touch.down);
      if (down && player.body.blocked.down) {
        player._droppingThroughBridge = true;
        // Re-enable collision after player drops past the bridge
        this.time.delayedCall(300, () => { player._droppingThroughBridge = false; });
        return false;
      }
      return true;
    });
    // Cops can also walk on bridge
    this.cops.forEach(cop => {
      this.physics.add.collider(cop, bridge);
    });

    ladderInfo.bridgeBody = bridge;
    ladderInfo.bridgeVisual = plankVisual;
    this._bridgeBodies.push(bridge);
  }

  /**
   * Auto step-up: if the player is horizontally over a bridge and their feet
   * are slightly below the bridge top, nudge them up so they walk onto it.
   */
  _bridgeStepUp(player) {
    const MAX_STEP = player.isPushingLadder ? 18 : 12; // wider range during push
    const pb = player.body;
    if (!pb) return;
    const playerBottom = pb.y + pb.height;
    const playerLeft = pb.x;
    const playerRight = pb.x + pb.width;

    for (const bridge of this._bridgeBodies) {
      if (!bridge.body) continue;
      const bb = bridge.body;
      const bridgeTop = bb.y;
      const bridgeLeft = bb.x;
      const bridgeRight = bb.x + bb.width;

      // Player must horizontally overlap the bridge
      if (playerRight < bridgeLeft || playerLeft > bridgeRight) continue;

      // Player feet must be slightly below bridge top (within step-up range)
      const diff = playerBottom - bridgeTop;
      if (diff > 0 && diff <= MAX_STEP) {
        // Nudge player up to bridge level
        player.y -= diff;
        pb.y -= diff;
        pb.velocity.y = 0;
        break;
      }
    }
  }

  // === UPDATE ===

  update(time, delta) {
    // Overlap callbacks fired BEFORE this update() call (during physics step).
    // So playerOnLadderThisFrame / playerInShadow already hold this frame's results.

    // 1. Apply overlap results to player state
    this.player.setOnLadder(this.playerOnLadderThisFrame, this.ladderCenterX, this.ladderTopY, this.currentLadderInfo);
    // Shadow zone: tell player whether they're in shadow (for hide mechanic availability)
    // isHidden is now managed by Player — only true when actively hiding (DOWN + stopped + in shadow)
    this.player.inShadowZone = this.playerInShadow;
    // Tell touch controls to bias down-diagonals as pure down near shadows
    if (this.touch && this.touch.enabled) {
      this.touch.shadowBias = this.playerInShadow;
    }
    // Update shadow down-arrow indicators
    this._updateShadowArrows();
    // Animate mural glow & star particles
    this._updateMuralGlow(time, delta);

    // 2. Check paint input (SPACE or touch ACT)
    // Allowed when: on solid ground OR on ladder (not mid-air)
    const onSolidGround = this.player.body.blocked.down;
    const onLadder = this.player.isClimbing || this.player.onLadder;
    const canPaint = (onSolidGround || onLadder);

    // On ladder: ALWAYS check distance to paint spots (physics overlap may not reach)
    if (onLadder) {
      const px = this.player.x;
      const py = this.player.y;
      const LADDER_PAINT_RANGE = 80;
      let bestDist = Infinity;
      let bestSpot = null;
      this.paintSpotZones.getChildren().forEach(spot => {
        if (spot.getData('painted')) return;
        const sx = spot.getData('spotX');
        const sy = spot.getData('spotY');
        const sw = spot.getData('spotW');
        const sh = spot.getData('spotH');
        const dx = Math.abs(px - sx);
        const inRangeX = dx < sw / 2 + LADDER_PAINT_RANGE;
        const inRangeY = py > sy - sh / 2 - 60 && py < sy + sh / 2 + 60;
        if (inRangeX && inRangeY && dx < bestDist) {
          bestDist = dx;
          bestSpot = spot;
        }
      });
      if (bestSpot) {
        this.interactablePaintSpot = bestSpot;
      }
    }

    // Tell player if near paint spot (so ladder SPACE doesn't jump but paints instead)
    this.player.nearPaintSpot = !!(this.interactablePaintSpot && canPaint);

    if (this.interactablePaintSpot && !this.player.isPainting && !this.player.isPushingLadder && canPaint) {
      const paintPressed = Phaser.Input.Keyboard.JustDown(this.paintKeySpace) ||
        (this.touch && this.touch.actionJustPressed);
      if (paintPressed) {
        // DON'T clear isClimbing/onLadder here — tryPaint() needs them
        // to pass its own onLadder check. tryPaint() handles the exit internally.
        this.tryPaint();
      }
    }

    // CRITICAL: After paint check, consume SPACE from player's cursors too.
    // paintKeySpace and cursors.space may be separate Phaser Key objects for the same
    // physical key — both get _justDown independently. We must consume the player's
    // copy so Player.update() doesn't also process SPACE as a ladder jump-off.
    if (this.player.nearPaintSpot) {
      if (this.player.cursors.space !== this.paintKeySpace) {
        // Different Key objects — consume player's copy separately
        Phaser.Input.Keyboard.JustDown(this.player.cursors.space);
      }
      // If same Key object, JustDown was already consumed above (or not pressed)
    }

    // 2b. E key — unified: ladder push OR trash push based on what's nearby
    const eJustPressed = Phaser.Input.Keyboard.JustDown(this.player.grabKey) ||
      (this.touch && this.touch.eJustPressed);
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
          const playerFeetY = this.player.body.y + this.player.body.height;
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

    // 2d. Auto step-up onto bridges (works while walking or pushing ladder)
    if ((this.player.body.blocked.down || this.player.isPushingLadder) && !this.player.isClimbing && !this.player.isClimbing2) {
      this._bridgeStepUp(this.player);
    }

    // 3. Player movement & input (uses ladder/shadow state)
    this.player.update();

    // 3a. Ladder-to-platform landing: when climbing down, detect platform under feet
    // NOTE: This is now handled entirely by Player.update() platform-edge detection
    // which properly skips the ladder-top platform and checks isDroppingToLadder.
    // The old GameScene check was causing premature detachment because it didn't
    // account for isDroppingToLadder or the ladder-top platform.

    // 3b. Paint arm update — drive hand movement and rope simulation
    if (this.player.isPainting && this.paintArm.active) {
      // Color selector is fixed next to paint area (set once in createColorSelector)
      // Color switching (keys 1-4)
      if (this.colorKeys && this.pbn) {
        for (let i = 0; i < this.colorKeys.length; i++) {
          if (Phaser.Input.Keyboard.JustDown(this.colorKeys[i])) {
            const colorName = this.pbn.colorMap[i];
            if (colorName && this.player.hasPaint(colorName.toLowerCase())) {
              this.pbn.setSelectedColor(i);
              this.player.paintColor = this.pbn.getSelectedColorHex();
              this.paintArm.setCanColor(this.pbn.getSelectedColorName());
              this.updateColorSelectorHighlight();
            }
          }
        }
      }

      // Keep color selector following player
      this.updateColorSelectorPosition();

      const cursors = this.player.cursors;
      const wasd = this.player.wasdKeys;
      const t = this.touch;
      const input = {
        left:  cursors.left.isDown  || wasd.left.isDown  || (t && t.left),
        right: cursors.right.isDown || wasd.right.isDown || (t && t.right),
        up:    cursors.up.isDown    || wasd.up.isDown    || (t && t.up),
        down:  cursors.down.isDown  || wasd.down.isDown  || (t && t.down),
      };
      const isTouch = !!(t && t.enabled);

      // Mouse painting on desktop: when mouse button is held, drive hand to mouse world pos
      let mouseWorld = null;
      if (!isTouch && this.input.activePointer.isDown) {
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const b = this.paintArm.bounds;
        if (b && worldPoint.x >= b.x && worldPoint.x <= b.x + b.w &&
            worldPoint.y >= b.y && worldPoint.y <= b.y + b.h) {
          mouseWorld = { x: worldPoint.x, y: worldPoint.y };
        }
      }

      const handPos = this.paintArm.update(delta, input, this.player.x, this.player.y, isTouch, mouseWorld);
      const isMovingHand = !!(mouseWorld || input.left || input.right || input.up || input.down);
      if (handPos) {
        this.onPaintMove(handPos.x, handPos.y);
        this.player.spawnPaintSpray(handPos.x, handPos.y);
      }

      // --- Spray SFX: play while hand is moving ---
      if (this.sfxSpray) {
        if (isMovingHand && !this._sprayPlaying) {
          this.sfxSpray.play();
          this._sprayPlaying = true;
          this._paintIdleTimer = 0;
        } else if (!isMovingHand && this._sprayPlaying) {
          this.sfxSpray.stop();
          this._sprayPlaying = false;
          this._paintIdleTimer = 0;
          this._nextShakeDelay = Phaser.Math.Between(2000, 5000);
        }
      }

      // --- Can shake SFX: random during idle pauses ---
      if (!isMovingHand) {
        this._paintIdleTimer += delta;
        if (this._paintIdleTimer >= this._nextShakeDelay) {
          this.sound.play('sfx_canshake', { volume: 0.25 });
          this._paintIdleTimer = 0;
          this._nextShakeDelay = Phaser.Math.Between(3000, 8000);
        }
      }
    }

    // 3b. Move trash when player is pushing into it
    if (this.player.isPushingTrash && this.collidingTrash) {
      const t = this.collidingTrash;
      // Use input direction, not velocity (velocity is 0 because collider blocks player)
      const tc = this.touch;
      const left = this.player.cursors.left.isDown || this.player.wasdKeys.left.isDown || (tc && tc.left);
      const right = this.player.cursors.right.isDown || this.player.wasdKeys.right.isDown || (tc && tc.right);
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

    // Sync trash proximity zones + detect player leaving top
    this.trashCans.forEach(t => {
      if (!t.body) return;
      if (t._proximityZone) {
        t._proximityZone.x = t.x;
        t._proximityZone.y = t.y;
        t._proximityZone.body.x = t.x - 40;
        t._proximityZone.body.y = t.y - 30;
      }
      // Reset onTop flag when player is not touching this trash's top
      if (!(this.player.body.touching.down && t.body.touching.up)) {
        t.onPlayerOffTop();
      }
    });

    // 4. Cops AI
    this.cops.forEach(cop => cop.update(time, delta, this.player));

    // 4a2. Tower mode timer
    if (this.mode === 'tower') this.updateTowerTimer(delta);

    // 4b. Touch button highlights — signal nearby interactables
    if (this.touch && this.touch.enabled) {
      const onGnd = this.player.body.blocked.down || this.player.body.touching.down;
      const canP = onGnd || this.player.isClimbing || this.player.onLadder;
      this.touch.highlightButton('paint', !!(this.interactablePaintSpot && canP && !this.player.isPainting));

      let nearGrab = !!this.nearbyTrash;
      if (!nearGrab && onGnd && this.playerOnLadderThisFrame && this.currentLadderInfo) {
        const feetY = this.player.body.y + this.player.body.height;
        nearGrab = feetY >= this.currentLadderInfo.bottomY - 40;
      }
      this.touch.highlightButton('grab', nearGrab && !this.player.isPushingTrash && !this.player.isPushingLadder);
    }

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
