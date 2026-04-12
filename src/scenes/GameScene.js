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
import Paper from '../entities/Paper.js';
import Bottle from '../entities/Bottle.js';
import Carton from '../entities/Carton.js';
import { t } from '../config/i18n.js';

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
    // Belt-and-suspenders: remove any leaked intro overlay so the game
    // canvas is never hidden behind a stray fullscreen black div on a
    // fast scene transition.
    try {
      document.querySelectorAll('div[data-intro-overlay]').forEach(el => {
        try { el.remove(); } catch (e) {}
      });
    } catch (e) {}

    this.sfx = new SynthSFX();

    // === SYNCHRONIZE SCALE BEFORE BUILDING ANYTHING ===
    // Force ScaleManager to re-read canvas dimensions so cameras + HUD
    // are built with the final, stable size. Without this, a scene started
    // mid-resize (e.g. Home → Level, orientation change) uses stale values.
    try { this.scale.refresh(); } catch(e) {}

    const ld = this.levelData;
    this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
    // CRITICAL: explicitly size the main camera to the current canvas.
    // When scene.start() boots GameScene from another scene, Phaser does NOT
    // automatically resize cameras.main to match ScaleManager — it stays at
    // the Phaser.Game config size (1280x720). TouchControls and HUD read
    // cam.width/height to position buttons, so if we skip this, controls end
    // up positioned for 1280x720 and are invisible off the actual canvas.
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // With Phaser.Scale.FIT the canvas is always virtually 1280x720,
    // so we use the original fixed zoom values — no runtime scaling.
    this.cameras.main.setZoom(isMobile ? 2.7 : 1.95);
    this.cameras.main.setRoundPixels(true);
    this._baseZoom = this.cameras.main.zoom;  // remember base zoom for paint restore
    this.cameras.main.setBounds(0, 0, ld.worldWidth, ld.worldHeight);
    // Remember initial size so we can detect post-create scale drift
    this._initialScaleW = this.scale.width;
    this._initialScaleH = this.scale.height;

    // === World bounds ===
    this.physics.world.setBounds(0, 0, ld.worldWidth, ld.worldHeight);

    // === Checkpoint ===
    this.checkpointX = ld.checkpoint.x;
    this.checkpointY = ld.checkpoint.y;

    // Track painted spots
    this.totalSpots = 0;
    this.paintedSpots = 0;

    // Flood fill state — initialize explicitly to avoid undefined access
    this._floodAnimating = false;
    this._floodHeld = false;
    this._floodPointerWasDown = false;
    this._armFloodLastCell = null;
    this._armFloodRegion = null;
    this.pbn = null;
    this.activePaintSpot = null;

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
    this._bridgeLines = []; // track bridge line endpoints for smooth Y interpolation

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
        // Only solid when player is landing on top from above.
        // Must check that player's feet were ABOVE the trash top in the previous
        // frame (prev.y) to avoid oscillation when standing beside the trash
        // at the same Y level.
        const playerBottom = player.body.y + player.body.height;
        const playerPrevBottom = player.body.prev.y + player.body.height;
        const trashTop = t.body.y;
        const falling = player.body.velocity.y >= 0;
        const wasAbove = playerPrevBottom <= trashTop + 4;
        // Already standing on top (touching.down vs touching.up) — stay solid
        const alreadyOnTop = player.body.touching.down && t.body.touching.up;
        return (falling && wasAbove && playerBottom <= trashTop + 10) || alreadyOnTop;
      });
      // Overlap — detect proximity for HUD hint and push activation
      // Use a wider invisible zone so player can enter push mode earlier
      const proximityZone = this.add.zone(trash.x, trash.y, 120, 60);
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
    // Grace timestamp for flicker tolerance at high fps
    this.playerOnLadderThisFrame = false;
    this.ladderCenterX = 0;
    this.ladderTopY = 0;
    this.currentLadderInfo = null; // reference to ladderInfo for pushing
    this._ladderOverlapTs = 0;
    this._lastLadderCenterX = 0;
    this._lastLadderTopY = 0;
    this._lastLadderInfo = null;
    this.physics.add.overlap(this.player, this.ladderZones, (player, ladder) => {
      const info = ladder.getData('ladderInfo');
      // Skip fallen/destroyed ladders — can't climb a bridge
      if (info && (info.isFalling || info.isBridge || info.destroyed)) return;
      this.playerOnLadderThisFrame = true;
      this.ladderCenterX = ladder.x + ladder.width / 2 + 6;
      this.ladderTopY = ladder.getData('ladderTopY');
      this.currentLadderInfo = info;
      this._ladderOverlapTs = this.time.now;
      this._lastLadderCenterX = this.ladderCenterX;
      this._lastLadderTopY = this.ladderTopY;
      this._lastLadderInfo = info;
    });

    // Shadow overlap — set timestamp so we can add grace period for flicker tolerance
    this.physics.add.overlap(this.player, this.shadowZones, () => {
      this._shadowOverlapTs = this.time.now;
      this.playerInShadow = true;
    });

    // Paint can pickup
    this.physics.add.overlap(this.player, this.paintCans, (player, can) => {
      can.collect(player);
      this.sound.play('sfx_pickup', { volume: 0.35 });
    });

    // Paint spot interaction — with grace timestamp for flicker tolerance at high fps
    this.interactablePaintSpot = null;
    this._paintSpotOverlapTs = 0;
    this._lastPaintSpot = null;
    this.physics.add.overlap(this.player, this.paintSpotZones, (player, spot) => {
      if (!spot.getData('painted')) {
        this.interactablePaintSpot = spot;
        this._paintSpotOverlapTs = this.time.now;
        this._lastPaintSpot = spot;
      }
      // Dismiss beacon on first visit
      this._dismissBeacon(spot);
    });

    // === HUD ===
    this.createHUD();

    // === Post-create scale reconciliation ===
    // The ScaleManager can still settle AFTER create() completes (common
    // during orientation changes or when returning from Home). Schedule a
    // series of refresh+reconcile calls to catch any drift and rebuild
    // the HUD if necessary. Each refresh() triggers the resize handler,
    // which in turn triggers _rebuildHUD() when size actually changed.
    [50, 200, 500].forEach(delay => {
      this.time.delayedCall(delay, () => {
        if (!this.sys || !this.sys.isActive()) return;
        try { this.scale.refresh(); } catch(e) {}
        // Force main-camera size in case nothing fired
        const w = this.scale.width;
        const h = this.scale.height;
        if (this.cameras && this.cameras.main) {
          this.cameras.main.setSize(w, h);
        }
        if (this.uiCam && this.uiCam.scene === this) {
          this.uiCam.setSize(w, h);
        }
      });
    });

    // === Tower mode: timer + color gates ===
    if (this.mode === 'tower') {
      this.setupTowerMode();
    }

    // === Tutorial mode ===
    if (this.mode === 'tutorial') {
      this.setupTutorial();
    }

    // === Litter props that react to player passing ===
    this.papers = [];
    this.bottles = [];
    this.cartons = [];
    this.createPapers();
    this.createBottles();
    this.createCartons();

    // === Wind leaves effect ===
    this.createLeafEffect();

    // === Events ===
    this.events.on('player-caught', () => {
      // Always reset cops out of ALERT state (even if damage doesn't go through)
      this.cops.forEach(cop => cop.resetState());
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
      // ugh sound already played in takeDamage()
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
    // Also clear references to Phaser objects so a fresh create() starts clean.
    this.events.on('shutdown', () => {
      if (this.bgm) { try { this.bgm.stop(); this.bgm.destroy(); } catch(e) {} this.bgm = null; }
      // Kill any orphan bgm instances to prevent overlap on next scene
      try {
        const orphans = this.sound.getAll ? this.sound.getAll('bgm') : [];
        orphans.forEach(s => { try { s.stop(); s.destroy(); } catch(e) {} });
      } catch(e) {}
      if (this._leafTimer) { try { this._leafTimer.remove(); } catch(e) {} this._leafTimer = null; }
      if (this._hudRebuildTimer) { try { this._hudRebuildTimer.remove(); } catch(e) {} this._hudRebuildTimer = null; }
      this._hudRebuildScheduled = false;
      // Clear stale refs — on restart create() will reinitialize these
      this.uiCam = null;
      this._hudElements = null;
      this.cops = null;
      this.player = null;
      this.paintArm = null;
      this.touch = null;
      this._bridgeLayer = null;
      this._bridgeBodies = null;
      this._bridgeLines = null;
      this.trashCans = null;
      this.shadowZones = null;
      this.shadowVisuals = null;
      this._shadowArrows = null;
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

  /**
   * Safe wrapper around textures.addCanvas that removes the previous texture
   * with the same key first (if any). Without this, restarting the scene
   * (Home → menu → same level) crashes because Phaser's TextureManager
   * rejects duplicate keys, causing downstream getContext-on-null errors.
   */
  _safeAddCanvas(key, canvas) {
    if (this.textures.exists(key)) {
      try { this.textures.remove(key); } catch (e) {}
    }
    return this.textures.addCanvas(key, canvas);
  }

  /** Same guard for textures.createCanvas (used by lamps / notes). */
  _safeCreateCanvas(key, w, h) {
    if (this.textures.exists(key)) {
      try { this.textures.remove(key); } catch (e) {}
    }
    return this.textures.createCanvas(key, w, h);
  }

  createBackground() {
    const ld = this.levelData;
    const ww = ld.worldWidth;
    const wh = ld.worldHeight;

    // === SKY (fixed behind everything, scrollFactor 0) ===
    const gh = this.cameras.main.height;
    const gw = this.cameras.main.width;
    // Use canvas gradient for band-free smooth sky with built-in horizon glow
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = gw;
    skyCanvas.height = gh;
    const skyCtx = skyCanvas.getContext('2d');
    // Base vertical gradient
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, gh);
    skyGrad.addColorStop(0, 'rgb(8,8,32)');
    skyGrad.addColorStop(0.55, 'rgb(14,18,70)');
    skyGrad.addColorStop(0.8, 'rgb(18,30,100)');
    skyGrad.addColorStop(1, 'rgb(22,40,125)');
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, gw, gh);
    // Horizon glow — radial, baked into the same canvas
    const glowGrad = skyCtx.createRadialGradient(
      gw / 2, gh, 0,
      gw / 2, gh, gw * 0.55
    );
    glowGrad.addColorStop(0, 'rgba(55,100,185,0.4)');
    glowGrad.addColorStop(0.5, 'rgba(30,60,140,0.12)');
    glowGrad.addColorStop(1, 'rgba(10,15,50,0)');
    skyCtx.fillStyle = glowGrad;
    skyCtx.fillRect(0, 0, gw, gh);
    const skyTexKey = '__sky_grad__';
    if (this.textures.exists(skyTexKey)) this.textures.remove(skyTexKey);
    this._safeAddCanvas(skyTexKey, skyCanvas);
    this.add.image(gw / 2, gh / 2, skyTexKey)
      .setDisplaySize(gw, gh).setDepth(0).setScrollFactor(0);
    // Graphics layer for stars & moon drawn on top
    const sky = this.add.graphics().setDepth(0).setScrollFactor(0);

    // Stars on sky — scattered with twinkling
    this._skyStars = [];
    const starCount = Math.floor(80 * (gh / GAME.HEIGHT));
    for (let i = 0; i < starCount; i++) {
      const sx = Phaser.Math.Between(0, gw);
      const sy = Phaser.Math.Between(0, Math.floor(gh * 0.55));
      const size = Math.random() > 0.85 ? 2 : 1;
      const baseAlpha = Math.random() * 0.5 + 0.25;
      const star = this.add.rectangle(sx, sy, size, size, 0xffffff, baseAlpha)
        .setDepth(0).setScrollFactor(0);
      this._skyStars.push(star);
      // Twinkling — random delay, slow alpha oscillation
      this.tweens.add({
        targets: star,
        alpha: { from: baseAlpha, to: baseAlpha * 0.2 },
        duration: Phaser.Math.Between(1500, 4000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        ease: 'Sine.easeInOut'
      });
    }

    // Moon on sky
    sky.fillStyle(0xddeeff, 0.8);
    sky.fillCircle(gw - 80, 50, 25);
    sky.fillStyle(0x0a0a1a, 1);
    sky.fillCircle(gw - 70, 45, 22);

    // Drifting clouds — canvas-based wispy shapes, spawn periodically
    this._clouds = [];
    this._cloudTimer = 0;
    this._cloudInterval = Phaser.Math.Between(3000, 7000); // ms between spawns
    // Create a few cloud textures
    if (!this.textures.exists('__cloud_0__')) {
      for (let ci = 0; ci < 3; ci++) {
        const cw = Phaser.Math.Between(120, 200);
        const ch = Phaser.Math.Between(30, 50);
        const cc = document.createElement('canvas');
        cc.width = cw; cc.height = ch;
        const cctx = cc.getContext('2d');
        // Draw wispy cloud from overlapping ellipses
        const blobs = Phaser.Math.Between(3, 5);
        for (let bi = 0; bi < blobs; bi++) {
          const bx = (cw * 0.15) + Math.random() * (cw * 0.7);
          const by = ch * 0.3 + Math.random() * (ch * 0.4);
          const bw = Phaser.Math.Between(30, 70);
          const bh = Phaser.Math.Between(15, 30);
          const grd = cctx.createRadialGradient(bx, by, 0, bx, by, bw * 0.5);
          grd.addColorStop(0, 'rgba(180,200,230,0.12)');
          grd.addColorStop(0.6, 'rgba(140,165,200,0.06)');
          grd.addColorStop(1, 'rgba(100,130,180,0)');
          cctx.fillStyle = grd;
          cctx.beginPath();
          cctx.ellipse(bx, by, bw * 0.5, bh * 0.5, 0, 0, Math.PI * 2);
          cctx.fill();
        }
        const key = `__cloud_${ci}__`;
        this._safeAddCanvas(key, cc);
      }
    }
    // Spawn initial clouds already on screen
    for (let i = 0; i < 5; i++) {
      this._spawnCloud(gw, gh, true);
    }

    // === Helper: draw buildings onto a canvas ===
    const drawBuildings = (canvasW, canvasH, params) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      const { count, minW, maxW, minH, maxH, colors, winScale, seedOffset } = params;

      for (let i = 0; i < count; i++) {
        const seed = ((i + seedOffset) * 7 + 3) % 17;
        const bw = minW + (seed * 4) % (maxW - minW);
        const bh = minH + (seed * 13) % (maxH - minH);
        const spacing = canvasW / count;
        const bx = Math.round(i * spacing + ((seed * 5) % (spacing * 0.3)));
        const by = canvasH - bh;
        const col = colors[i % colors.length];

        // Building body gradient
        const gradSteps = 8;
        for (let gs = 0; gs < gradSteps; gs++) {
          const t = gs / (gradSteps - 1);
          const r0 = (col[0] >> 16) & 0xff, g0 = (col[0] >> 8) & 0xff, b0 = col[0] & 0xff;
          const r1 = (col[1] >> 16) & 0xff, g1 = (col[1] >> 8) & 0xff, b1 = col[1] & 0xff;
          const cr = Math.round(r0 + (r1 - r0) * t);
          const cg = Math.round(g0 + (g1 - g0) * t);
          const cb = Math.round(b0 + (b1 - b0) * t);
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
          const sy = by + Math.floor(bh * gs / gradSteps);
          const sh = Math.ceil(bh / gradSteps) + 1;
          ctx.fillRect(bx, sy, bw, sh);
        }

        // Left highlight
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(bx, by, 3, bh);
        // Right shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(bx + bw - 3, by, 3, bh);

        // Roof cap
        ctx.fillStyle = '#0a0c1e';
        ctx.fillRect(bx - 2, by, bw + 4, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(bx - 2, by, bw + 4, 2);

        // Windows
        const wW = Math.round(8 * winScale), wH = Math.round(11 * winScale);
        const wGapX = Math.round(17 * winScale), wGapY = Math.round(22 * winScale);
        const wPadX = Math.round(8 * winScale), wPadY = Math.round(14 * winScale);
        for (let wy = by + wPadY; wy + wH < canvasH - 5; wy += wGapY) {
          for (let wx = bx + wPadX; wx + wW < bx + bw - 5; wx += wGapX) {
            const rnd = ((wx * 13 + wy * 7 + i * 31 + seedOffset) % 100);
            const lit = rnd > 50; // ~50% lit
            if (lit) {
              const bright = rnd > 60; // ~40% extra bright
              ctx.fillStyle = bright ? 'rgba(255,200,100,0.25)' : 'rgba(255,170,68,0.15)';
              ctx.fillRect(wx - 2, wy - 2, wW + 4, wH + 4);
              ctx.fillStyle = bright ? 'rgba(255,220,130,0.85)' : 'rgba(255,187,85,0.6)';
              ctx.fillRect(wx, wy, wW, wH);
              ctx.fillStyle = bright ? 'rgba(255,240,180,0.6)' : 'rgba(255,221,136,0.4)';
              ctx.fillRect(wx + 1, wy + 1, wW - 2, wH - 2);
            } else {
              ctx.fillStyle = 'rgba(10,12,24,0.7)';
              ctx.fillRect(wx, wy, wW, wH);
            }
          }
        }
      }
      return canvas;
    };

    // Parallax strip width — wider than world so buildings don't run out during scroll
    const stripW = Math.round(ww * 1.5);

    // === FAR LAYER (slow parallax, smaller/darker buildings) ===
    const farH = Math.round(wh * 0.7);
    const farCanvas = drawBuildings(stripW, farH, {
      count: Math.ceil(stripW / 130),
      minW: 50, maxW: 110,
      minH: 100, maxH: Math.min(Math.round(farH * 0.55), 350),
      winScale: 1,
      seedOffset: 0,
      colors: [
        [0x0a0c1e, 0x12142a],
        [0x0c0e22, 0x14162e],
        [0x080a18, 0x101228],
        [0x0e1024, 0x161a32],
      ],
    });
    // Portable canvas blur: works even when ctx.filter is unsupported.
    // Uses multiple scaled drawImage passes (box blur approximation).
    const _blurCanvas = (src, radius) => {
      const w = src.width, h = src.height;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');

      // Check if native filter is supported
      if (typeof ctx.filter === 'string' || ctx.filter !== undefined) {
        try {
          ctx.filter = `blur(${radius}px)`;
          ctx.drawImage(src, 0, 0);
          // Verify it actually worked (some browsers silently ignore filter)
          ctx.filter = 'none';
          return out;
        } catch (e) { /* fallback below */ }
      }

      // Fallback: iterative downscale/upscale blur (3 passes)
      const passes = Math.max(1, Math.round(radius));
      const tmp = document.createElement('canvas');
      const scale = Math.max(0.05, 1 / (1 + radius * 0.5));
      tmp.width = Math.max(1, Math.round(w * scale));
      tmp.height = Math.max(1, Math.round(h * scale));
      const tCtx = tmp.getContext('2d');
      tCtx.imageSmoothingEnabled = true;
      tCtx.imageSmoothingQuality = 'high';
      // Downscale
      tCtx.drawImage(src, 0, 0, tmp.width, tmp.height);
      // Upscale back
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, 0, 0, w, h);
      // Extra passes for smoother result
      for (let i = 1; i < passes; i++) {
        tCtx.clearRect(0, 0, tmp.width, tmp.height);
        tCtx.drawImage(out, 0, 0, tmp.width, tmp.height);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0, w, h);
      }
      return out;
    };

    // Apply blur to far layer (more blur = further away)
    const farBlurred = _blurCanvas(farCanvas, 4);
    const farKey = '__parallax_far';
    if (this.textures.exists(farKey)) this.textures.remove(farKey);
    this._safeAddCanvas(farKey, farBlurred);
    this.add.image(0, wh - farH - 60, farKey)
      .setOrigin(0, 0).setDepth(0.1).setScrollFactor(0.15, 0.3);

    // === NEAR LAYER (faster parallax, bigger/brighter buildings) ===
    const nearH = Math.round(wh * 0.85);
    const nearCanvas = drawBuildings(stripW, nearH, {
      count: Math.ceil(stripW / 110),
      minW: 60, maxW: 130,
      minH: 140, maxH: Math.min(Math.round(nearH * 0.65), 480),
      winScale: 1.2,
      seedOffset: 50,
      colors: [
        [0x0f1028, 0x1a1e3a],
        [0x121430, 0x1e2240],
        [0x0e1025, 0x181c35],
        [0x141838, 0x222848],
      ],
    });

    // Apply subtle blur to near layer
    const nearBlurred = _blurCanvas(nearCanvas, 1.5);
    const nearKey = '__parallax_near';
    if (this.textures.exists(nearKey)) this.textures.remove(nearKey);
    this._safeAddCanvas(nearKey, nearBlurred);
    this.add.image(0, wh - nearH - 30, nearKey)
      .setOrigin(0, 0).setDepth(0.2).setScrollFactor(0.4, 0.6);
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

      this._safeAddCanvas(rtKey, canvas);

      const tile = this.add.image(x + width / 2, y + BLOCK_H / 2, rtKey);
      tile.setDepth(depth ?? 3);
      this.physics.add.existing(tile, true);
      group.add(tile);
    };

    const ld = this.levelData;
    ld.ground.forEach(g => addPlatform(this.ground, g.x, g.y, g.w, g.depth));
    ld.platforms.forEach(p => {
      addPlatform(this.platforms, p.x, p.y, p.w, p.depth);
      // Cast shadow below platform only if there's a surface beneath it
      if (this._hasSurfaceBelow(p.x, p.y + BLOCK_H, p.w, ld)) {
        this._addPlatformShadow(p.x, p.y + BLOCK_H, p.w);
      }
    });
  }

  /**
   * Find the Y of the nearest platform/ground surface directly below (x, fromY).
   * Returns the top-Y of that surface, or null if nothing is below.
   */
  findSurfaceBelow(x, fromY) {
    let bestY = null;
    const check = (group) => {
      group.getChildren().forEach(plat => {
        const b = plat.body;
        const left = b.x;
        const right = b.x + b.width;
        const top = b.y;
        if (x >= left && x <= right && top > fromY + 2) {
          if (bestY === null || top < bestY) bestY = top;
        }
      });
    };
    check(this.ground);
    check(this.platforms);
    return bestY;
  }

  /**
   * Check if x is on any platform/ground surface at surfaceY.
   * Returns true if the object is still supported.
   */
  isOnSurface(x, surfaceY) {
    const check = (group) => {
      for (const plat of group.getChildren()) {
        const b = plat.body;
        const left = b.x;
        const right = b.x + b.width;
        const top = b.y;
        // Object is on surface if X is within platform bounds
        // and Y is within 24px of platform top (generous tolerance for varied prop placement)
        if (x >= left - 4 && x <= right + 4 && Math.abs(top - surfaceY) < 24) return true;
      }
      return false;
    };
    return check(this.ground) || check(this.platforms);
  }

  /**
   * Return the left/right edges of the surface supporting the object at (x, surfaceY).
   * Returns { left, right } or null if no surface found.
   */
  getSurfaceBounds(x, surfaceY) {
    let result = null;
    const check = (group) => {
      for (const plat of group.getChildren()) {
        const b = plat.body;
        const left = b.x;
        const right = b.x + b.width;
        const top = b.y;
        if (x >= left - 2 && x <= right + 2 && Math.abs(top - surfaceY) < 12) {
          if (!result || (right - left) > (result.right - result.left)) {
            result = { left, right };
          }
        }
      }
    };
    check(this.ground);
    check(this.platforms);
    return result;
  }

  /**
   * Check if any ground or platform surface exists below a platform within shadow range.
   * Uses raw level data so it works at build time before physics bodies are ready.
   */
  _hasSurfaceBelow(px, bottomY, pw, ld) {
    const shadowH = 40; // must match _addPlatformShadow height
    const hasOverlapX = (sx, sw) => px + pw > sx && px < sx + sw;

    // Check fillWalls — shadow appears on a wall directly adjacent below the platform
    if (ld.fillWalls) {
      for (const fw of ld.fillWalls) {
        // Wall top must be within shadow range of platform bottom (touching or very close)
        if (fw.y > bottomY + shadowH) continue;
        // Wall bottom must be at or below platform bottom
        if (fw.y + fw.h < bottomY) continue;
        if (hasOverlapX(fw.x, fw.w)) return true;
      }
    }

    // Check ground/platforms — only if very close below (direct contact, not floating)
    const maxDist = 80;
    const surfaces = [...ld.ground, ...ld.platforms];
    for (const s of surfaces) {
      const top = s.y;
      if (top < bottomY || top > bottomY + maxDist) continue;
      if (hasOverlapX(s.x, s.w)) return true;
    }

    return false;
  }

  /**
   * Check if a fillWall exists behind a ladder (overlaps horizontally and vertically).
   */
  _hasWallBehindLadder(ladX, topY, bottomY, ladW, ld) {
    if (!ld.fillWalls) return false;
    const halfW = ladW / 2;
    const lLeft = ladX - halfW;
    const lRight = ladX + halfW;
    for (const fw of ld.fillWalls) {
      const fwRight = fw.x + fw.w;
      const fwBottom = fw.y + fw.h;
      // Horizontal overlap
      if (lRight <= fw.x || lLeft >= fwRight) continue;
      // Vertical overlap — wall must cover at least part of the ladder
      if (bottomY <= fw.y || topY >= fwBottom) continue;
      return true;
    }
    return false;
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
    this._safeAddCanvas(rtKey, canvas);

    const img = this.add.image(wx + w / 2, wy + h / 2, rtKey);
    // Clamp minimum depth above background parallax layers (sky=0, buildings=0.1/0.2)
    const MIN_WALL_DEPTH = 0.5;
    const wallDepth = Math.max(MIN_WALL_DEPTH, depth ?? 1.5);
    img.setDepth(wallDepth); // behind murals (2) and shadows (2)
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
    this._safeAddCanvas(rtKey, canvas);

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

      this._safeAddCanvas(rtKey, canvas);

      const visual = this.add.image(x, topY + height / 2, rtKey);
      visual.setDepth(ladderDepth ?? 4);
      this.ladderVisuals.add(visual);

      // Cast shape-accurate shadow only when a fillWall is behind the ladder
      const hasWallBehind = this._hasWallBehindLadder(x, topY, bottomY, snapW, ld);
      let ladShadow = null;
      if (hasWallBehind) {
        const shadowOffX = 6;
        const shadowOffY = 12; // shift further down against wall
        ladShadow = this.add.image(x + shadowOffX, topY + height / 2 + shadowOffY, rtKey);
        ladShadow.setTint(0x000000);
        ladShadow.setAlpha(0.40);
        ladShadow.setCrop(0, 0, snapW, snapH - 12);
        ladShadow.setDepth((ladderDepth ?? 4) - 0.1);
      }

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
        font: 'bold 14px Bungee, monospace',
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
    const ld = this.levelData;

    // If level has explicit paintCans with color — use those (backward compat)
    if (ld.paintCans && ld.paintCans.length > 0 && ld.paintCans[0].color) {
      ld.paintCans.forEach(c => {
        const can = new PaintCan(this, c.x, c.y, c.color);
        this.paintCans.add(can);
      });
      return;
    }

    // === AUTO-GENERATE paint cans based on mural requirements ===
    // Only count colors from paintings that have an actual paintSpot in this level.
    // Generate exactly 1 can per unique color — the PBN cost formula already ensures
    // 1 can covers its color's share of a mural, and surplus gives enough margin.

    const paintSpots = ld.paintSpots || [];
    // Collect unique painting keys referenced by paint spots
    const neededPaintings = new Set();
    paintSpots.forEach(ps => {
      if (ps.paintingKey && !ps.painted) neededPaintings.add(ps.paintingKey);
    });

    // Count how many murals use each color — need 1 can per mural per color
    const colorCanCount = new Map();
    neededPaintings.forEach(key => {
      const data = this.cache.json.get(key);
      if (!data || !data.colors) return;
      data.colors.forEach(c => {
        const lc = c.toLowerCase();
        colorCanCount.set(lc, (colorCanCount.get(lc) || 0) + 1);
      });
    });

    // Build canList with N entries per color (N = number of murals using it)
    const canList = [];
    colorCanCount.forEach((count, color) => {
      for (let i = 0; i < count; i++) canList.push(color);
    });

    // Shuffle to mix colors
    for (let i = canList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [canList[i], canList[j]] = [canList[j], canList[i]];
    }

    // 4. Collect all valid spawn surfaces (ground + platforms)
    const surfaces = [];
    (ld.ground || []).forEach(g => {
      surfaces.push({ x: g.x, y: g.y, w: g.w });
    });
    (ld.platforms || []).forEach(p => {
      surfaces.push({ x: p.x, y: p.y, w: p.w });
    });

    // Sort surfaces from bottom (high Y) to top (low Y) — player encounters lower ones first
    surfaces.sort((a, b) => b.y - a.y);

    // 5. Collect positions to AVOID (paint spots, ladders, trash, etc.)
    const avoidZones = [];
    (ld.paintSpots || []).forEach(ps => {
      avoidZones.push({ x: ps.x, w: ps.w + 40 }); // extra margin
    });
    (ld.trashCans || []).forEach(t => {
      avoidZones.push({ x: t.x - 30, w: 60 });
    });

    const isAvoid = (px) => {
      return avoidZones.some(z => px >= z.x - 20 && px <= z.x + z.w + 20);
    };

    // 6. Distribute cans evenly across surfaces
    const totalCans = canList.length;
    const placedCans = [];

    // Spread cans across surfaces proportionally to their width
    const totalWidth = surfaces.reduce((sum, s) => sum + s.w, 0);
    let canIdx = 0;

    for (const surf of surfaces) {
      const share = Math.max(1, Math.round(totalCans * (surf.w / totalWidth)));
      const cansOnSurf = Math.min(share, totalCans - canIdx);
      if (cansOnSurf <= 0) continue;

      const spacing = surf.w / (cansOnSurf + 1);
      for (let i = 0; i < cansOnSurf && canIdx < totalCans; i++) {
        let cx = surf.x + spacing * (i + 1);
        // Nudge away from avoid zones
        let attempts = 0;
        while (isAvoid(cx) && attempts < 10) {
          cx += 25;
          attempts++;
        }
        // Clamp to surface bounds
        cx = Phaser.Math.Clamp(cx, surf.x + 20, surf.x + surf.w - 20);

        const cy = surf.y - 30; // float above surface
        placedCans.push({ x: cx, y: cy, color: canList[canIdx] });
        canIdx++;
      }
    }

    // If some cans weren't placed (narrow surfaces), put remaining on ground
    while (canIdx < totalCans) {
      const ground = surfaces[0]; // widest / lowest
      const cx = ground.x + Phaser.Math.Between(40, ground.w - 40);
      const cy = ground.y - 30;
      placedCans.push({ x: cx, y: cy, color: canList[canIdx] });
      canIdx++;
    }

    // 7. Create actual PaintCan objects
    placedCans.forEach(c => {
      const can = new PaintCan(this, c.x, c.y, c.color);
      this.paintCans.add(can);
    });
  }

  createHeartPickups() {
    this.heartPickups = this.physics.add.staticGroup();
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
      // Outline marking the mural area — star-colored border
      const visual = this.add.graphics();
      visual.lineStyle(1.5, 0xffe090, 0.3);
      visual.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
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

      // Spray can pictogram — hidden by default, appears with glow when player is near
      const sprayIcon = this.add.image(x, y, 'icon_spray')
        .setDisplaySize(20, 20)
        .setDepth(depth + 0.3)
        .setAlpha(0)
        .setTint(0xffe090);

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

      this._muralGlows.push({ zone, glowG, stars, sprayIcon, glowT: 0, rx: x - w / 2, ry: y - h / 2, rw: w, rh: h });

      // --- Beacon: blinking indicator above paint spot ---
      const beaconY = y - h / 2 - 20;
      const beacon = this.add.image(x, beaconY, 'icon_spray')
        .setDisplaySize(16, 16)
        .setDepth((spotDepth ?? 2) + 0.5)
        .setTint(0xffe090)
        .setAlpha(0);

      // Pulse tween — blink loop
      const beaconTween = this.tweens.add({
        targets: beacon,
        alpha: { from: 0.9, to: 0.15 },
        yoyo: true,
        repeat: -1,
        duration: 600,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 400
      });

      // Bob up/down
      this.tweens.add({
        targets: beacon,
        y: beaconY - 4,
        yoyo: true,
        repeat: -1,
        duration: 1200,
        ease: 'Sine.easeInOut'
      });

      zone.setData('beacon', beacon);
      zone.setData('beaconTween', beaconTween);
    };

    // Track discovered beacons per level session
    this._discoveredBeacons = new Set();

    this.levelData.paintSpots.forEach(s => {
      addSpot(s.x, s.y, s.w, s.h, s.paintingKey, s.depth);
    });
  }

  _dismissBeacon(spot) {
    const key = spot.getData('paintingKey');
    if (!this._discoveredBeacons || this._discoveredBeacons.has(key)) return;
    const beacon = spot.getData('beacon');
    if (!beacon || beacon.alpha <= 0) return;
    this._discoveredBeacons.add(key);
    // Stop pulse tween and fade out permanently
    const tw = spot.getData('beaconTween');
    if (tw) tw.stop();
    this.tweens.add({
      targets: beacon,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => beacon.setVisible(false)
    });
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
        if (entry.sprayIcon) entry.sprayIcon.setAlpha(0);
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
          entry.glowG.strokeRoundedRect(rx, ry, rw, rh, 8);
        });
      }

      // --- Spray can icon — only when active (player nearby), fades with glowT ---
      if (entry.sprayIcon) {
        entry.sprayIcon.setAlpha(gt * 0.85);
        const bob = Math.sin(time * 0.003) * 2;
        entry.sprayIcon.setY(ry + rh / 2 + bob);
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
      const ct   = this._safeCreateCanvas(texKey, texW, texH);
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
      const gt = this._safeCreateCanvas(glowKey, glowSize, glowSize);
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

  createPapers() {
    (this.levelData.papers || []).forEach(p => {
      const paper = new Paper(this, p.x, p.y, p.angle);
      this.papers.push(paper);
    });
  }

  createBottles() {
    (this.levelData.bottles || []).forEach(b => {
      const bottle = new Bottle(this, b.x, b.y, b.angle);
      this.bottles.push(bottle);
    });
  }

  createCartons() {
    (this.levelData.cartons || []).forEach(c => {
      const carton = new Carton(this, c.x, c.y, c.angle);
      this.cartons.push(carton);
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

    // Build the HUD timer text (extracted so rebuild can recreate it)
    this._createTowerTimerHUD();

    // Color gates — physical barriers
    this._colorGates = [];
    (this.levelData.colorGates || []).forEach(g => {
      const gate = this.add.rectangle(g.x + g.w / 2, g.y, g.w, 8, 0xff4444, 0.7)
        .setDepth(10);
      this.physics.add.existing(gate, true); // static

      // Message text floating above gate
      const msg = this.add.text(g.x + g.w / 2, g.y - 16, t(g.message) || g.message || '', {
        font: 'bold 10px Bungee, monospace', fill: '#ff6666',
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

  /**
   * Creates ONLY the tower timer HUD text. Extracted from setupTowerMode
   * so _rebuildHUD can recreate it on resize without rebuilding gates.
   */
  _createTowerTimerHUD() {
    this._addingHud = true;
    const gw = this.scale.width;
    this._towerTimerText = this.add.text(gw / 2, 32, '', {
      fontFamily: 'Bungee', fontSize: '36px', fontStyle: 'bold',
      color: '#00ff88',
      stroke: '#003322', strokeThickness: 6
    }).setOrigin(0.5, 0).setDepth(300).setScrollFactor(0);
    this._addingHud = false;
    this.cameras.main.ignore(this._towerTimerText);
    // Add to hudElements so it's rebuilt on resize
    if (this._hudElements) this._hudElements.add(this._towerTimerText);
  }

  updateTowerTimer(delta) {
    if (!this._towerTimerText || this._towerGameOver) return;

    this._towerTimeLeft -= delta / 1000;
    if (this._towerTimeLeft <= 0) {
      this._towerTimeLeft = 0;
      this._towerGameOver = true;
      this._towerTimerText.setText(t('timeUp')).setFill('#ff3333');
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
    const gw = this.scale.width;
    const bonusText = this.add.text(gw / 2, 42, `+${this._towerBonus}s`, {
      font: 'bold 18px Bungee, monospace', fill: '#ffdd33',
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
          `${t('newColor')}: ${unlocks[muralIdx]}!`, {
          font: 'bold 14px Bungee, monospace', fill: '#33ff88',
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

  // === TUTORIAL MODE ===

  setupTutorial() {
    this._tutPhase = 0;
    this._tutGates = [];
    this._tutHintElements = [];  // all world-space hint elements
    this._tutOverlayElements = []; // UI-cam overlay elements
    this._tutTransitioning = false;
    this._tutControlLock = { left: true, right: true, jump: false, up: false, down: false, interact: false };
    this._tutIsMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Hi-res multiplier for crisp text at camera zoom
    this._tutTextRes = Math.max(2, Math.ceil(this.cameras.main.zoom));

    const ld = this.levelData;

    // Build physical gates (thin invisible walls)
    (ld.tutorialGates || []).forEach(g => {
      const gateWall = this.add.rectangle(g.x, 0, 8, ld.worldHeight * 2, 0xff4444, 0)
        .setOrigin(0.5, 0).setDepth(10);
      this.physics.add.existing(gateWall, true);
      this.physics.add.collider(this.player, gateWall);
      gateWall._gatePhase = g.phase;
      this._tutGates.push(gateWall);
    });

    // Show first hint + overlay
    this._showTutorialHint(0);
    this._showTutorialOverlay(0);

    // Welcome flash (on UI cam — always crisp)
    this._addingHud = true;
    const gw = this.scale.width;
    const welcomeText = this.add.text(gw / 2, 80, t('tutWelcome'), {
      fontFamily: 'Bungee', fontSize: '42px', fontStyle: 'bold',
      color: '#00ff88', stroke: '#003322', strokeThickness: 6
    }).setOrigin(0.5).setDepth(301).setScrollFactor(0).setResolution(2);
    this._addingHud = false;
    this.cameras.main.ignore(welcomeText);
    this.tweens.add({
      targets: welcomeText, alpha: 0, y: welcomeText.y - 30,
      duration: 2500, delay: 1500, onComplete: () => welcomeText.destroy()
    });
  }

  /**
   * Render a world-space hint using a canvas texture for crisp text at any zoom.
   */
  _showTutorialHint(phase) {
    // Destroy old hint elements
    this._tutHintElements.forEach(el => el.destroy());
    this._tutHintElements = [];

    const ld = this.levelData;
    const hints = ld.tutorialHints || [];
    const hint = hints.find(h => h.phase === phase);
    if (!hint) return;

    const text = this._tutIsMobile ? hint.mobile : hint.desktop;
    const RES = this._tutTextRes;  // super-sampling factor

    // --- Create canvas texture for crisp world-space text ---
    const fontSize = 15;
    const pad = 10;
    const strokeW = 3;

    // Measure text width using offscreen canvas
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `bold ${fontSize * RES}px Bungee, monospace`;
    const metrics = measure.measureText(text);
    const textW = Math.ceil(metrics.width / RES) + pad * 2;
    const textH = fontSize + pad * 2 + 4;
    const canW = textW * RES;
    const canH = textH * RES;

    const texKey = `_tut_hint_${phase}_${Date.now()}`;
    const canvas = document.createElement('canvas');
    canvas.width = canW;
    canvas.height = canH;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const r = 8 * RES;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(canW - r, 0);
    ctx.quadraticCurveTo(canW, 0, canW, r);
    ctx.lineTo(canW, canH - r);
    ctx.quadraticCurveTo(canW, canH, canW - r, canH);
    ctx.lineTo(r, canH);
    ctx.quadraticCurveTo(0, canH, 0, canH - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,221,51,0.5)';
    ctx.lineWidth = 2 * RES;
    ctx.stroke();

    // Text with stroke
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize * RES}px Bungee, monospace`;
    ctx.lineWidth = strokeW * RES;
    ctx.strokeStyle = '#332200';
    ctx.strokeText(text, canW / 2, canH / 2);
    ctx.fillStyle = '#ffdd33';
    ctx.fillText(text, canW / 2, canH / 2);

    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    this._safeAddCanvas(texKey, canvas);

    const img = this.add.image(hint.x, hint.y, texKey)
      .setDisplaySize(textW, textH)
      .setOrigin(0.5)
      .setDepth(20);

    // Pulse animation
    this.tweens.add({
      targets: img, alpha: { from: 0, to: 1 },
      duration: 400, ease: 'Sine.easeIn'
    });
    this.tweens.add({
      targets: img,
      scaleX: img.scaleX * 1.03, scaleY: img.scaleY * 1.03,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Arrow indicator pointing down to the relevant area
    const arrow = this.add.triangle(hint.x, hint.y + textH / 2 + 10, 0, 0, 12, 16, -12, 16, 0xffdd33, 0.7)
      .setDepth(20).setOrigin(0.5, 0);
    this.tweens.add({
      targets: arrow, y: arrow.y + 6,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this._tutHintElements.push(img, arrow);
  }

  /**
   * Show a screen-space control overlay on the UI camera.
   * On mobile: shows joystick area + button highlights.
   * On desktop: shows key icons.
   */
  _showTutorialOverlay(phase) {
    // Destroy previous overlay
    this._tutOverlayElements.forEach(el => el.destroy());
    this._tutOverlayElements = [];

    const gw = this.scale.width;
    const gh = this.scale.height;

    if (this._tutIsMobile) {
      this._showMobileOverlay(phase, gw, gh);
    } else {
      this._showDesktopOverlay(phase, gw, gh);
    }
  }

  _showMobileOverlay(phase, gw, gh) {
    const els = [];
    this._addingHud = true;

    // Semi-transparent overlay panel at bottom
    const panelH = 80;
    const panelY = gh - panelH;
    const panel = this.add.rectangle(gw / 2, panelY + panelH / 2, gw, panelH, 0x000000, 0.6)
      .setDepth(290).setScrollFactor(0);
    els.push(panel);

    // Phase-specific control graphics
    if (phase === 0) {
      // Phase 0: Show joystick area with left/right arrows
      const joyX = 110;
      const joyY = panelY + panelH / 2;
      const ring = this.add.circle(joyX, joyY, 30, 0xffffff, 0.15)
        .setStrokeStyle(2, 0xffdd33, 0.8).setDepth(291).setScrollFactor(0);
      const arrowL = this.add.text(joyX - 42, joyY, '◀', {
        fontSize: '22px', color: '#ffdd33'
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      const arrowR = this.add.text(joyX + 42, joyY, '▶', {
        fontSize: '22px', color: '#ffdd33'
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      const label = this.add.text(gw / 2, joyY, t('tutMoveJoystick'), {
        fontFamily: 'Bungee, monospace', fontSize: '16px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      // Animate arrows
      this.tweens.add({ targets: arrowL, x: arrowL.x - 6, duration: 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: arrowR, x: arrowR.x + 6, duration: 500, yoyo: true, repeat: -1 });
      els.push(ring, arrowL, arrowR, label);
    } else if (phase === 1) {
      // Phase 1: Highlight JUMP button
      const btnX = gw - 85;
      const btnY = panelY + panelH / 2;
      const jumpCircle = this.add.circle(btnX, btnY, 34, 0x33ff88, 0.25)
        .setStrokeStyle(3, 0x33ff88, 0.9).setDepth(291).setScrollFactor(0);
      const jumpLabel = this.add.text(btnX, btnY, 'JUMP', {
        fontFamily: 'Bungee, monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#33ff88', stroke: '#003322', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      const desc = this.add.text(gw / 2 - 40, btnY, t('tutJump'), {
        fontFamily: 'Bungee, monospace', fontSize: '16px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      // Pulse the button
      this.tweens.add({
        targets: jumpCircle, scaleX: 1.15, scaleY: 1.15,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      els.push(jumpCircle, jumpLabel, desc);
    } else if (phase === 2) {
      // Phase 2: Show joystick ↑↓ + E button
      const joyX = 110;
      const joyY = panelY + panelH / 2;
      const ring = this.add.circle(joyX, joyY, 30, 0xffffff, 0.15)
        .setStrokeStyle(2, 0xffaa33, 0.8).setDepth(291).setScrollFactor(0);
      const arrowU = this.add.text(joyX, joyY - 32, '▲', {
        fontSize: '18px', color: '#ffaa33'
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      const arrowD = this.add.text(joyX, joyY + 32, '▼', {
        fontSize: '18px', color: '#ffaa33'
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      this.tweens.add({ targets: arrowU, y: arrowU.y - 4, duration: 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: arrowD, y: arrowD.y + 4, duration: 500, yoyo: true, repeat: -1 });

      const eX = gw - 215;
      const eCircle = this.add.circle(eX, joyY, 26, 0xffaa33, 0.25)
        .setStrokeStyle(3, 0xffaa33, 0.9).setDepth(291).setScrollFactor(0);
      const eLabel = this.add.text(eX, joyY, 'E', {
        fontFamily: 'Bungee, monospace', fontSize: '18px', fontStyle: 'bold',
        color: '#ffaa33', stroke: '#332200', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      this.tweens.add({
        targets: eCircle, scaleX: 1.15, scaleY: 1.15,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      const desc = this.add.text(gw / 2, joyY, t('tutLadderE'), {
        fontFamily: 'Bungee, monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(ring, arrowU, arrowD, eCircle, eLabel, desc);
    } else if (phase === 3) {
      // Phase 3: Simple text — collect paint
      const desc = this.add.text(gw / 2, panelY + panelH / 2, t('tutCollectPaint'), {
        fontFamily: 'Bungee, monospace', fontSize: '16px', fontStyle: 'bold',
        color: '#ffdd33', stroke: '#332200', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(desc);
    } else if (phase === 4) {
      // Phase 4: Highlight ACT button for painting
      const btnX = gw - 85;
      const btnY = panelY + panelH / 2;
      const actCircle = this.add.circle(btnX, btnY - 10, 30, 0x3388ff, 0.25)
        .setStrokeStyle(3, 0x3388ff, 0.9).setDepth(291).setScrollFactor(0);
      const actLabel = this.add.text(btnX, btnY - 10, 'ACT', {
        fontFamily: 'Bungee, monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#3388ff', stroke: '#001133', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      this.tweens.add({
        targets: actCircle, scaleX: 1.15, scaleY: 1.15,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      const desc = this.add.text(gw / 2 - 40, btnY, t('tutPaintACT'), {
        fontFamily: 'Bungee, monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(actCircle, actLabel, desc);
    }

    // Hide all overlay elements from main cam
    els.forEach(el => this.cameras.main.ignore(el));
    this._addingHud = false;

    // Auto-fade after delay
    this.time.delayedCall(6000, () => {
      this.tweens.add({
        targets: els.filter(e => e.active), alpha: 0,
        duration: 800, onComplete: () => {
          els.forEach(e => { if (e.active) e.destroy(); });
        }
      });
    });

    this._tutOverlayElements = els;
  }

  _showDesktopOverlay(phase, gw, gh) {
    const els = [];
    this._addingHud = true;

    // Desktop: show key icons at bottom-center
    const panelH = 60;
    const panelY = gh - panelH;
    const cy = panelY + panelH / 2;
    const panel = this.add.rectangle(gw / 2, cy, gw * 0.5, panelH, 0x000000, 0.6)
      .setDepth(290).setScrollFactor(0);
    els.push(panel);

    // Helper: draw a keyboard key icon
    const drawKey = (x, y, label, highlight) => {
      const keyW = label.length > 2 ? 54 : 32;
      const keyH = 28;
      const bg = this.add.rectangle(x, y, keyW, keyH, highlight ? 0x332200 : 0x222222, 0.9)
        .setStrokeStyle(2, highlight ? 0xffdd33 : 0x555555, 1)
        .setDepth(291).setScrollFactor(0);
      const txt = this.add.text(x, y, label, {
        fontFamily: 'Bungee, monospace', fontSize: '12px', fontStyle: 'bold',
        color: highlight ? '#ffdd33' : '#888888',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(292).setScrollFactor(0).setResolution(2);
      if (highlight) {
        this.tweens.add({ targets: bg, scaleX: 1.1, scaleY: 1.1, duration: 500, yoyo: true, repeat: -1 });
      }
      els.push(bg, txt);
    };

    const baseX = gw / 2 - 80;

    if (phase === 0) {
      drawKey(baseX, cy, '←', true);
      drawKey(baseX + 40, cy, '→', true);
      const desc = this.add.text(baseX + 100, cy, t('tutMove'), {
        fontFamily: 'Bungee, monospace', fontSize: '13px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(desc);
    } else if (phase === 1) {
      drawKey(baseX - 20, cy, '←', false);
      drawKey(baseX + 20, cy, '→', false);
      drawKey(baseX + 70, cy, '↑', true);
      drawKey(baseX + 130, cy, 'SPACE', true);
      const desc = this.add.text(baseX + 180, cy, t('tutJumpWord'), {
        fontFamily: 'Bungee, monospace', fontSize: '13px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(desc);
    } else if (phase === 2) {
      drawKey(baseX - 20, cy, '↑', true);
      drawKey(baseX + 20, cy, '↓', true);
      const lbl1 = this.add.text(baseX + 50, cy, t('tutLadder'), {
        fontFamily: 'Bungee, monospace', fontSize: '11px', fontStyle: 'bold',
        color: '#ffaa33', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      drawKey(baseX + 120, cy, 'E', true);
      const lbl2 = this.add.text(baseX + 145, cy, t('tutPushCrate'), {
        fontFamily: 'Bungee, monospace', fontSize: '11px', fontStyle: 'bold',
        color: '#ffaa33', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(lbl1, lbl2);
    } else if (phase === 3) {
      const desc = this.add.text(gw / 2, cy, t('tutCollectPaintDesktop'), {
        fontFamily: 'Bungee, monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#ffdd33', stroke: '#332200', strokeThickness: 3
      }).setOrigin(0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(desc);
    } else if (phase === 4) {
      drawKey(gw / 2 - 30, cy, 'SPACE', true);
      const desc = this.add.text(gw / 2 + 20, cy, t('tutPaintMural'), {
        fontFamily: 'Bungee, monospace', fontSize: '13px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0, 0.5).setDepth(291).setScrollFactor(0).setResolution(2);
      els.push(desc);
    }

    // Hide from main cam
    els.forEach(el => this.cameras.main.ignore(el));
    this._addingHud = false;

    // Auto-fade
    this.time.delayedCall(6000, () => {
      this.tweens.add({
        targets: els.filter(e => e.active), alpha: 0,
        duration: 800, onComplete: () => {
          els.forEach(e => { if (e.active) e.destroy(); });
        }
      });
    });

    this._tutOverlayElements = els;
  }

  _advanceTutorialPhase(newPhase) {
    if (this._tutTransitioning) return;
    if (this._tutPhase >= newPhase) return;
    this._tutTransitioning = true;
    this._tutPhase = newPhase;

    // Remove the gate matching this phase (gate.phase = "open when entering this phase")
    const gateToRemove = this._tutGates.find(g => g._gatePhase === newPhase);
    if (gateToRemove) {
      const fx = this.add.rectangle(gateToRemove.x, this.levelData.worldHeight / 2, 12, this.levelData.worldHeight, 0x00ff88, 0.6)
        .setDepth(15);
      this.tweens.add({
        targets: fx, alpha: 0, scaleX: 3,
        duration: 400, onComplete: () => fx.destroy()
      });
      gateToRemove.destroy();
      this._tutGates = this._tutGates.filter(g => g !== gateToRemove);
    }

    // Update control lock based on phase
    switch (newPhase) {
      case 1:
        this._tutControlLock = { left: true, right: true, jump: true, up: true, down: false, interact: false };
        break;
      case 2:
        this._tutControlLock = { left: true, right: true, jump: true, up: true, down: true, interact: true };
        break;
      case 3:
      case 4:
        this._tutControlLock = { left: true, right: true, jump: true, up: true, down: true, interact: true };
        break;
    }

    // Camera pan to next area, then show hint + overlay
    const hints = this.levelData.tutorialHints || [];
    const hint = hints.find(h => h.phase === newPhase);
    if (hint) {
      const cam = this.cameras.main;
      cam.stopFollow();

      // "Bravo!" feedback (UI cam — always crisp)
      this._addingHud = true;
      const gw = this.scale.width;
      const bravoTexts = t('bravo');
      const bravoText = this.add.text(gw / 2, 120, bravoTexts[newPhase - 1] || bravoTexts[0], {
        fontFamily: 'Bungee', fontSize: '28px', fontStyle: 'bold',
        color: '#00ff88', stroke: '#003322', strokeThickness: 4
      }).setOrigin(0.5).setDepth(302).setScrollFactor(0).setResolution(2);
      this._addingHud = false;
      this.cameras.main.ignore(bravoText);
      this.tweens.add({
        targets: bravoText, alpha: 0, y: bravoText.y - 20,
        duration: 1200, delay: 600, onComplete: () => bravoText.destroy()
      });

      // Pan to hint location
      cam.pan(hint.x, hint.y, 800, 'Sine.easeInOut', false, (c, progress) => {
        if (progress >= 1) {
          this._showTutorialHint(newPhase);
          this.time.delayedCall(1200, () => {
            cam.pan(this.player.x, this.player.y, 600, 'Sine.easeInOut', false, (c2, p2) => {
              if (p2 >= 1) {
                cam.startFollow(this.player, true, 0.1, 0.1);
                this._tutTransitioning = false;
                // Show overlay after camera returns to player
                this._showTutorialOverlay(newPhase);
              }
            });
          });
        }
      });
    } else {
      this._tutTransitioning = false;
    }
  }

  updateTutorial(delta) {
    if (this._tutTransitioning) return;

    const px = this.player.x;
    const phase = this._tutPhase;

    if (phase === 0 && px > 350) {
      this._advanceTutorialPhase(1);
    } else if (phase === 1 && px > 700) {
      this._advanceTutorialPhase(2);
    } else if (phase === 2 && px > 1150) {
      this._advanceTutorialPhase(3);
    } else if (phase === 3 && px > 1550) {
      this._advanceTutorialPhase(4);
    }
  }

  // === HUD ===

  createHUD() {
    // CRITICAL: remove any stale listeners from a previous createHUD()
    // call on this same scene instance. Phaser reuses scene instances
    // across scene.start() — scene.events listeners added by user code
    // PERSIST across restarts. If we don't clear the old 'addedtoscene'
    // handler, it fires during the new HUD build, reads the FRESH
    // this.uiCam, and applies cameraFilter |= uiCam.id to every new HUD
    // element — making them invisible on the new uiCam. This is the
    // root cause of "HUD vanishes on level after visiting another
    // level first" (observed on tower, street, and rebuild flows).
    this.events.off('addedtoscene');
    // Also detach any stale ScaleManager resize handler so we don't
    // end up with multiple handlers after a rebuild or scene restart.
    if (this._resizeHandler) {
      try { this.scale.off('resize', this._resizeHandler); } catch(e) {}
      this._resizeHandler = null;
    }

    // HUD uses a dedicated scene overlay to avoid zoom issues
    // We add a second camera just for UI, with zoom=1
    const gw = this.scale.width;
    const gh = this.scale.height;
    this.uiCam = this.cameras.add(0, 0, gw, gh);
    this.uiCam.setZoom(1);
    this.uiCam.setScroll(0, 0);
    this.uiCam.setName('ui');

    // Keep cameras sized to canvas when EXPAND mode resizes the game.
    // IMPORTANT: this.scale is the GLOBAL ScaleManager — listeners persist
    // across scene restarts. Must remove on shutdown to prevent stale refs.
    this._resizeHandler = (gameSize) => {
      // Ensure scene is still alive before touching anything
      if (!this.scene || !this.sys || !this.sys.isActive()) return;
      const w = gameSize.width;
      const h = gameSize.height;
      // ALWAYS resize main camera — even if uiCam isn't ready yet —
      // otherwise the viewport stays stuck at a stale size and the world
      // appears frozen / cropped.
      if (this.cameras && this.cameras.main) {
        this.cameras.main.setSize(w, h);
      }
      // Only touch uiCam if it belongs to THIS scene instance
      if (this.uiCam && this.uiCam.scene === this) {
        this.uiCam.setSize(w, h);
      }
      // HUD uses absolute pixel positions computed from initial size.
      // If size changed significantly we rebuild the HUD from scratch so
      // layout math re-runs with the correct dimensions.
      const iw = this._initialScaleW || w;
      const ih = this._initialScaleH || h;
      const sizeChanged = Math.abs(w - iw) > 2 || Math.abs(h - ih) > 2;
      if (sizeChanged && !this._hudRebuildScheduled && this._hudElements) {
        this._hudRebuildScheduled = true;
        // Debounce — wait for resize burst to settle before rebuilding
        if (this._hudRebuildTimer) this._hudRebuildTimer.remove();
        this._hudRebuildTimer = this.time.delayedCall(120, () => {
          this._hudRebuildScheduled = false;
          this._hudRebuildTimer = null;
          this._rebuildHUD();
        });
      }
    };
    this.scale.on('resize', this._resizeHandler);
    this.events.once('shutdown', () => {
      if (this._resizeHandler) {
        this.scale.off('resize', this._resizeHandler);
        this._resizeHandler = null;
      }
    });

    // HUD layout: single horizontal bar at the top
    // [home] [can1] [can2] ... [counter] [heart1] [heart2] ...    [mute]
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // Scale UI relative to actual screen height (base design = 720px)
    const screenScale = gh / 720;
    const uiScale = isMobile ? 1.8 * screenScale : screenScale;
    const slotColors = this.levelColors;
    const bgPad = Math.round(6 * uiScale);
    const innerPad = Math.round(8 * uiScale);
    const barH = Math.round(60 * uiScale);
    const barY = bgPad;
    const centerY = barY + Math.round(barH / 2);

    // Home button size (15% bigger)
    const homeBtnSize = Math.round(68 * uiScale); // match icon size for better hit area
    const homeX = bgPad + innerPad + Math.round(homeBtnSize / 2);
    const homeY = centerY;

    // Cans — positioned horizontally after home
    const canScale = uiScale * 41 / (72 * 5); // HUD textures are 5x resolution (45% smaller)
    const canSpacing = Math.round(38 * uiScale);
    const canStartX = bgPad + innerPad + homeBtnSize + Math.round(20 * uiScale);

    this.hudSlots = [];
    for (let i = 0; i < slotColors.length; i++) {
      const cx = canStartX + i * canSpacing;
      const colorKey = slotColors[i].toLowerCase();

      const emptyFill = this.add.image(cx, centerY, 'hud_can_fill')
        .setDepth(100.2).setScrollFactor(0).setScale(canScale).setTint(0x222233).setAlpha(0.5);

      const fillKey = `hud_fill_${colorKey}`;
      const hasFillTex = this.textures.exists(fillKey);
      const fill = hasFillTex
        ? this.add.image(cx, centerY, fillKey)
            .setDepth(100.5).setScrollFactor(0).setScale(canScale).setVisible(false)
        : null;
      const fillTexH = fill ? fill.texture.getSourceImage().height : 1;
      const fillTexW = fill ? fill.texture.getSourceImage().width : 1;

      const shell = this.add.image(cx, centerY, 'hud_can_shell')
        .setDepth(101).setScrollFactor(0).setScale(canScale).setAlpha(0.35);

      // Smooth filtering for HUD icons
      emptyFill.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      if (fill) fill.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      shell.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

      this.hudSlots.push({
        color: slotColors[i], shell, fill, emptyFill,
        fillTexW: fillTexW, fillTexH: fillTexH
      });
    }

    // Painted spots counter — wall icon + badge text in a container
    const lastCanX = canStartX + (slotColors.length - 1) * canSpacing;
    const wallIconX = lastCanX + Math.round(46 * uiScale);
    const wallIconSize = Math.round(33 * uiScale);
    const counterFontSize = Math.round(barH * 0.45);

    this.hudWallIcon = this.add.image(0, 0, 'icon_wall')
      .setDisplaySize(wallIconSize, wallIconSize)
      .setOrigin(0.5);
    this.hudCountText = this.add.text(Math.round(wallIconSize * 0.4), 0, '', {
      fontFamily: 'Bungee',
      fontSize: `${counterFontSize}px`,
      fontStyle: 'bold',
      fill: '#ffffff',
      stroke: '#000000', strokeThickness: Math.round(uiScale * 3)
    }).setOrigin(0.5, 0.5).setResolution(2);

    this.hudCountContainer = this.add.container(wallIconX, centerY, [
      this.hudWallIcon, this.hudCountText
    ]).setDepth(101).setScrollFactor(0);

    // Status bar (desktop only) — dynamic elements with keyboard key icons
    if (!isMobile) {
      this._statusElements = [];
      this._lastStatusMsg = '';
      this._statusUiScale = uiScale;
    }

    // Music toggle button (speaker icon)
    this.musicOn = true;
    // Kill any stale bgm instances from previous scene runs to avoid overlap
    try {
      const staleBgms = this.sound.getAll ? this.sound.getAll('bgm') : [];
      staleBgms.forEach(s => { try { s.stop(); s.destroy(); } catch(e) {} });
    } catch(e) {}
    // Stop menu ambience while in-game so it doesn't overlap with bgm
    try {
      const amb = this.sound.getAll ? this.sound.getAll('ambience') : [];
      amb.forEach(s => { try { s.stop(); } catch(e) {} });
    } catch(e) {}
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.0375 });

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

    // Home button
    this.menuBtnHit = this.add.rectangle(homeX, homeY, homeBtnSize, homeBtnSize, 0x000000, 0)
      .setDepth(210).setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.menuBtn = this.add.image(homeX, homeY, 'icon_home')
      .setDisplaySize(Math.round(68 * uiScale), Math.round(68 * uiScale))
      .setOrigin(0.5).setDepth(102).setScrollFactor(0);
    this.menuBtn.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // Home button: press-in animation on pointerdown, navigate on pointerup.
    // Using pointerup prevents the same touch from cascading into MenuScene /
    // LevelSelectScene during a slow tap.
    this.menuBtnHit._pressed = false;
    const _homeBaseScaleX = this.menuBtn.scaleX;
    const _homeBaseScaleY = this.menuBtn.scaleY;
    const _homeAnimate = (targetScale) => {
      if (!this.menuBtn || !this.menuBtn.scene) return;
      if (this._homeTween) this._homeTween.stop();
      this._homeTween = this.tweens.add({
        targets: this.menuBtn,
        scaleX: _homeBaseScaleX * targetScale,
        scaleY: _homeBaseScaleY * targetScale,
        duration: 80,
        ease: 'Quad.easeOut'
      });
    };
    this.menuBtnHit.on('pointerdown', () => {
      this.menuBtnHit._pressed = true;
      _homeAnimate(0.82);
    });
    this.menuBtnHit.on('pointerout', () => {
      if (!this.menuBtnHit._pressed) return;
      this.menuBtnHit._pressed = false;
      _homeAnimate(1);
    });
    this.menuBtnHit.on('pointerupoutside', () => {
      if (!this.menuBtnHit._pressed) return;
      this.menuBtnHit._pressed = false;
      _homeAnimate(1);
    });
    this.menuBtnHit.on('pointerup', () => {
      if (!this.menuBtnHit._pressed) return;
      this.menuBtnHit._pressed = false;
      // Bounce back with a tiny pulse, then navigate after the anim plays
      if (this._homeTween) this._homeTween.stop();
      this._homeTween = this.tweens.add({
        targets: this.menuBtn,
        scaleX: _homeBaseScaleX * 1.08,
        scaleY: _homeBaseScaleY * 1.08,
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.bgm) { try { this.bgm.stop(); } catch (e) {} }
          if (this.sys && this.sys.isActive()) {
            this.scene.start('MenuScene');
          }
        }
      });
    });

    // Hearts — after counter
    // counterX is the right edge of the painted spots counter (wall icon + number badge)
    // We approximate it based on the wall icon position/size and expected text width.
    const counterX = wallIconX + Math.round(wallIconSize * 1.1 + counterFontSize * 0.6);

    this.hudHeart = null;
    let heartsEndX = counterX + Math.round(30 * uiScale);
    if (this.mode === 'stealth') {
      this._addingHud = true;
      const heartScale = uiScale * 41 / (40 * 5); // 5x texture, similar sizing to cans
      const heartX = counterX + Math.round(16 * uiScale);

      // Empty background heart (dark, always visible)
      const heartEmpty = this.add.image(heartX, centerY, 'hud_heart_fill')
        .setDepth(100.2).setScrollFactor(0).setScale(heartScale)
        .setTint(0x222233).setAlpha(0.5);

      // Filled red heart (cropped from top based on HP ratio)
      const heartFill = this.add.image(heartX, centerY, 'hud_heart_fill')
        .setDepth(100.5).setScrollFactor(0).setScale(heartScale);

      // Outline shell (always visible so heart shape is clear at low HP)
      const heartShell = this.add.image(heartX, centerY, 'hud_heart_shell')
        .setDepth(101).setScrollFactor(0).setScale(heartScale).setAlpha(0.9);

      // Smooth filtering
      heartEmpty.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      heartFill.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      heartShell.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

      const fillTexH = heartFill.texture.getSourceImage().height;
      const fillTexW = heartFill.texture.getSourceImage().width;

      this.hudHeart = { fill: heartFill, empty: heartEmpty, shell: heartShell, fillTexW, fillTexH };
      heartsEndX = heartX + Math.round(20 * uiScale);
      this._addingHud = false;
    }

    // Mute button — right end of bar
    const muteX = gw - Math.round(36 * uiScale);
    this.muteBtnHit = this.add.rectangle(muteX, centerY, Math.round(44 * uiScale), barH, 0x000000, 0)
      .setDepth(210).setScrollFactor(0).setInteractive({ useHandCursor: true });

    // Load SVG music icon via Image→canvas to bypass pixelArt nearest-neighbor filtering
    const noteSize = Math.round(30 * uiScale);
    const noteRes = noteSize * 3; // 3x resolution for crisp rendering
    const noteKey = '__music_note_svg';

    // Create a placeholder so the image exists immediately; replace once SVG loads
    if (!this.textures.exists(noteKey)) {
      this._safeCreateCanvas(noteKey, noteRes, noteRes).refresh();
    }
    this.muteBtn = this.add.image(muteX, centerY, noteKey)
      .setDisplaySize(noteSize, noteSize)
      .setOrigin(0.5).setDepth(101).setScrollFactor(0);

    // Async SVG→canvas rendering (loads in background, updates texture)
    const svgImg = new Image();
    svgImg.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = noteRes;
      cvs.height = noteRes;
      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, noteRes, noteRes);
      ctx.drawImage(svgImg, 0, 0, noteRes, noteRes);
      // Replace Phaser texture with rendered SVG canvas
      if (this.textures.exists(noteKey)) this.textures.remove(noteKey);
      this._safeAddCanvas(noteKey, cvs);
      if (this.muteBtn && this.muteBtn.active) {
        this.muteBtn.setTexture(noteKey);
        this.muteBtn.setDisplaySize(noteSize, noteSize);
      }
    };
    svgImg.src = 'assets/sprites/elementy/nutka.svg';

    this.muteBtnHit.on('pointerdown', () => {
      this.musicOn = !this.musicOn;
      if (this.musicOn) {
        this.bgm.resume();
        this.muteBtn.setAlpha(1);
      } else {
        this.bgm.pause();
        this.muteBtn.setAlpha(0.4);
      }
    });

    // HUD background bar (3-slice): left edge, stretchable middle, right edge.
    // The assets are provided as back_ui0.png, back_ui.png, back_ui2.png.
    // The bar should only cover the left-side HUD elements (ends just after hearts).
    // Start drawing the bar from the middle of the home icon.
    const barLeft = homeX; // homeX is the center of the home icon
    const barBaseRight = heartsEndX + innerPad; // end after hearts + padding
    const barBaseWidth = barBaseRight - barLeft;
    // Reduce right-side padding: add only a small constant buffer so the background ends closer to the hearts.
    const barExtra = Math.round(6 * uiScale);
    const barRight = barBaseRight + barExtra;
    const barWidth = barRight - barLeft;
    const barHeight = barH;

    let hudBgLeft = null;
    let hudBgMid = null;
    let hudBgRight = null;

    if (this.textures.exists('hud_bg_left') && this.textures.exists('hud_bg_mid') && this.textures.exists('hud_bg_right')) {
      hudBgLeft = this.add.image(barLeft, barY, 'hud_bg_left')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(98);
      const leftScale = barHeight / hudBgLeft.height;
      const leftW = Math.round(hudBgLeft.width * leftScale);
      hudBgLeft.setDisplaySize(leftW, barHeight);

      hudBgRight = this.add.image(0, barY, 'hud_bg_right')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(98);
      const rightScale = barHeight / hudBgRight.height;
      const rightW = Math.round(hudBgRight.width * rightScale);
      hudBgRight.setDisplaySize(rightW, barHeight);
      hudBgRight.setX(barLeft + barWidth - rightW);

      hudBgMid = this.add.image(0, barY, 'hud_bg_mid')
        .setOrigin(0, 0).setScrollFactor(0).setDepth(98);
      const midWidth = Math.max(0, barWidth - leftW - rightW);
      hudBgMid.setDisplaySize(midWidth, barHeight);
      hudBgMid.setX(barLeft + leftW);

      this.hudBgLeft = hudBgLeft;
      this.hudBgMid = hudBgMid;
      this.hudBgRight = hudBgRight;
    } else {
      // Fallback solid bar if textures are missing
      this.hudBgBar = this.add.rectangle(bgPad, barY, barRight - bgPad, barH, 0x000000, 0.6)
        .setDepth(100).setScrollFactor(0).setOrigin(0, 0);

      // Small background pill behind mute button
      const muteBgW = Math.round(40 * uiScale);
      this.hudBgMute = this.add.rectangle(muteX, centerY, muteBgW, barH, 0x000000, 0.6)
        .setDepth(100).setScrollFactor(0);
    }

    // Collect all HUD elements for camera management
    const slotElements = [];
    this.hudSlots.forEach(s => slotElements.push(s.emptyFill, s.shell, s.fill));
    const heartElements = [];
    if (this.hudHeart) heartElements.push(this.hudHeart.fill, this.hudHeart.empty, this.hudHeart.shell);

    const hudElements = [
      this.hudBgBar, this.hudBgMute,
      this.hudBgLeft, this.hudBgMid, this.hudBgRight,
      this.hudCountContainer, this.menuBtn, this.menuBtnHit, this.muteBtn, this.muteBtnHit,
      ...slotElements, ...heartElements, ...this.touch.getElements()
    ].filter(Boolean);
    this.cameras.main.ignore(hudElements);

    // Hide ALL scene objects from uiCam using cameraFilter bitmask
    const uiId = this.uiCam.id;
    this.children.list.forEach(child => {
      if (!hudElements.includes(child)) {
        child.cameraFilter |= uiId;
      }
    });

    this._hudElements = new Set(hudElements);

    this.events.on('addedtoscene', (obj) => {
      if (this._addingHud) return;
      // Any new non-HUD object: hide from uiCam immediately
      if (this.uiCam) {
        obj.cameraFilter |= this.uiCam.id;
        try { this.uiCam.ignore(obj); } catch(e) {}
      }
    });
  }

  /**
   * Rebuild HUD after scale change. Destroys all HUD elements and re-runs
   * createHUD() so positions/sizes are recomputed with current scale.width/height.
   * Preserves the existing uiCam (just resizes it).
   */
  _rebuildHUD() {
    if (!this.sys || !this.sys.isActive()) return;
    // Don't rebuild while in paint mode — color selector state would be lost
    if (this.player && this.player.isPainting) {
      // Retry after paint exits
      this._hudRebuildScheduled = true;
      if (this._hudRebuildTimer) this._hudRebuildTimer.remove();
      this._hudRebuildTimer = this.time.delayedCall(500, () => {
        this._hudRebuildScheduled = false;
        this._hudRebuildTimer = null;
        this._rebuildHUD();
      });
      return;
    }

    // Destroy old HUD elements
    if (this._hudElements) {
      this._hudElements.forEach(el => {
        if (el && el.destroy) {
          try { el.destroy(); } catch(e) {}
        }
      });
      this._hudElements = null;
    }

    // Destroy & recreate touch controls (joystick + action buttons)
    if (this.touch) {
      try { this.touch.destroy(); } catch(e) {}
      this.touch = new TouchControls(this);
    }

    // Clear HUD refs so createHUD rebuilds fresh
    this.hudBgBar = null; this.hudBgMute = null;
    this.hudBgLeft = null; this.hudBgMid = null; this.hudBgRight = null;
    this.hudCountContainer = null; this.hudCountText = null;
    this.menuBtn = null; this.menuBtnHit = null;
    this.muteBtn = null; this.muteBtnHit = null;
    this.hudSlots = null;
    this.hudHeart = null;

    // Remove the old uiCam (createHUD will make a new one)
    if (this.uiCam) {
      try { this.cameras.remove(this.uiCam); } catch(e) {}
      this.uiCam = null;
    }

    // Update initial size tracker so we don't immediately re-trigger
    this._initialScaleW = this.scale.width;
    this._initialScaleH = this.scale.height;

    // Rebuild
    try {
      this.createHUD();
      // Re-create mode-specific HUD elements (tower timer, tutorial overlays).
      // These exist OUTSIDE the main createHUD() and must be rebuilt separately
      // so they're positioned against the new scale.width/height and stored
      // in the fresh _hudElements set.
      if (this.mode === 'tower' && typeof this._createTowerTimerHUD === 'function') {
        // Kill the stale reference (the old text was destroyed with _hudElements above)
        this._towerTimerText = null;
        this._createTowerTimerHUD();
        // Force immediate update so text isn't blank
        if (typeof this.updateTowerTimer === 'function') {
          // Use delta of 0 so nothing ticks — just refreshes the displayed string
          // updateTowerTimer wants a ms delta, passing 0 is safe
          try { this.updateTowerTimer(0); } catch(e) {}
        }
      }
      if (typeof this.updateHUD === 'function') this.updateHUD();
      if (typeof this.updateHearts === 'function') this.updateHearts();
    } catch(e) {
      console.warn('[HUD] rebuild failed:', e);
    }
  }

  updateHearts() {
    if (!this.hudHeart) return;
    const ratio = this.player.hp / this.player.maxHp;
    const h = this.hudHeart;
    if (ratio > 0.001) {
      h.fill.setVisible(true);
      const cropTop = Math.round(h.fillTexH * (1 - ratio));
      h.fill.setCrop(0, cropTop, h.fillTexW, h.fillTexH - cropTop);
    } else {
      h.fill.setVisible(false);
    }
  }

  updateHUD() {
    this.updateHearts();
    // Update each paint slot: shell always visible, fill cropped to paint level
    for (let i = 0; i < this.hudSlots.length; i++) {
      const slot = this.hudSlots[i];
      const qty = this.player.getPaintCount(slot.color);
      const ratio = this.player.getPaintRatio(slot.color); // 0..1

      // Shell (can_.png) — brighten when player has paint
      slot.shell.setAlpha(qty > 0.01 ? 0.9 : 0.35);

      // Fill body (can_fill.png recolored) — crop from top to show paint level
      if (slot.fill) {
        if (qty > 0.01 && ratio > 0.01) {
          slot.fill.setVisible(true);
          const cropTop = Math.round(slot.fillTexH * (1 - ratio));
          slot.fill.setCrop(0, cropTop, slot.fillTexW, slot.fillTexH - cropTop);
        } else {
          slot.fill.setVisible(false);
        }
      }

    }

    // Painted spots counter — skip when paint mode uses it for progress %
    if (this._savedMuralCountText == null) {
      this.hudCountText.setText(`${this.paintedSpots}/${this.totalSpots}`);
    }

    const isMob = !!(this.touch && this.touch.enabled);

    if (!isMob && this._statusElements) {
      let msg = '';
      let color = '#00ff88';

      if (this.player.isPainting) {
        msg = `[ ${t('painting')} — ${t('paintCancel')} ]`;
        color = '#ffdd33';
      } else if (this.player.isPushingLadder) {
        msg = `[ ${t('movingLadder')} ]`;
        color = '#ffaa33';
      } else if (this.player.isPushingTrash) {
        msg = `[ ${t('movingCrate')} ]`;
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
              hints.push(t('paintMural'));
              paintHint = true;
            } else {
              hints.push(t('noPaint'));
              paintHint = true;
            }
          }
        }

        // Ladder hints — use grace timestamp for flicker-free display
        const nearLadder = this._ladderOverlapTs && (this.time.now - this._ladderOverlapTs < 100);
        if (nearLadder && !this.player.isClimbing && !this.player.isPushingLadder) {
          const onGnd = this.player.body.blocked.down;
          if (onGnd && this._lastLadderInfo) {
            const playerFeetY = this.player.body.y + this.player.body.height;
            const ladderMidY = (this._lastLadderInfo.topY + this._lastLadderInfo.bottomY) / 2;
            // Player above ladder midpoint → show "descend" (↓/S), otherwise "climb" (↑/W)
            if (playerFeetY < ladderMidY) {
              hints.push(t('descendLadder'));
            } else {
              hints.push(t('climbLadder'));
            }
            // Show grab hint if near ladder bottom
            if (playerFeetY >= this._lastLadderInfo.bottomY - 40) {
              hints.push(t('grabLadder'));
            }
          } else if (onGnd) {
            hints.push(t('climbLadder'));
          }
        }

        // Shadow hint
        if (this.playerInShadow && !this.player.isHiding && !this.player.isClimbing) {
          const onGnd = this.player.body.blocked.down;
          if (onGnd) {
            hints.push(t('hideInShadow'));
          }
        }

        if (hints.length > 0) {
          color = paintHint ? '#ffdd33' : '#00ff88';
          if (hints.length === 1) {
            msg = `[ ${hints[0]} ]`;
            this._hintRotateIdx = 0;
          } else {
            // Rotate hints one at a time
            const hintKey = hints.join('|');
            if (this._hintRotateKey !== hintKey) {
              this._hintRotateKey = hintKey;
              this._hintRotateIdx = 0;
              this._hintRotateTs = this.time.now;
            }
            const elapsed = this.time.now - (this._hintRotateTs || 0);
            if (elapsed > 2500) {
              this._hintRotateIdx = ((this._hintRotateIdx || 0) + 1) % hints.length;
              this._hintRotateTs = this.time.now;
            }
            msg = `[ ${hints[this._hintRotateIdx || 0]} ]`;
          }
        }
      }

      this._renderStatus(msg, color);
    }
  }

  _renderStatus(msg, color) {
    if (msg === this._lastStatusMsg) return;

    // Hold current message for at least 1s to prevent flickering
    const now = this.time.now;
    if (msg && this._lastStatusMsg && this._statusShownAt) {
      if (now - this._statusShownAt < 1000) return;
    }

    this._lastStatusMsg = msg;
    this._statusShownAt = now;

    // Destroy old elements
    if (this._statusElements) {
      this._statusElements.forEach(e => { if (e.active) e.destroy(); });
      this._statusElements = [];
    }
    if (!msg) return;

    this._addingHud = true;
    const uiScale = this._statusUiScale || 1;
    const fontSize = Math.round(11 * uiScale);
    const keyFontSize = Math.round(10 * uiScale);
    const gw = this.cameras.main.width;
    const y = Math.round(10 * uiScale);

    // Parse message to find key tokens (SPACE, standalone E/W/S, arrows)
    const keyRegex = /(SPACE|(?<![A-Za-z])[EWSM](?![A-Za-z])|[↑↓←→])/g;
    const rawSegs = [];
    let lastIdx = 0;
    let match;
    while ((match = keyRegex.exec(msg)) !== null) {
      if (match.index > lastIdx) rawSegs.push({ t: 'txt', v: msg.slice(lastIdx, match.index) });
      rawSegs.push({ t: 'key', v: match[0] });
      lastIdx = keyRegex.lastIndex;
    }
    if (lastIdx < msg.length) rawSegs.push({ t: 'txt', v: msg.slice(lastIdx) });

    // Clean up punctuation that looks bad next to key icons
    const segments = [];
    for (let i = 0; i < rawSegs.length; i++) {
      const s = rawSegs[i];
      if (s.t === 'key') { segments.push(s); continue; }
      let v = s.v;
      // Strip outer brackets
      if (i === 0) v = v.replace(/^\[\s*/, '');
      if (i === rawSegs.length - 1) v = v.replace(/\s*\]$/, '');
      // Replace pipe separators with spacing
      v = v.replace(/\s*\|\s*/g, '    ');
      // Remove slash between keys (e.g. "↑/W")
      const prevKey = i > 0 && rawSegs[i - 1].t === 'key';
      const nextKey = i < rawSegs.length - 1 && rawSegs[i + 1].t === 'key';
      if (prevKey && nextKey && v.trim() === '/') { segments.push({ t: 'txt', v: ' ' }); continue; }
      // Remove colon right after a key
      if (prevKey) v = v.replace(/^:\s*/, ' ');
      // Remove "— " before a key at end of text
      if (nextKey) v = v.replace(/\s*—\s*$/, '   ');
      if (v) segments.push({ t: 'txt', v });
    }

    // First pass: create elements, measure widths
    const items = [];
    let totalW = 0;
    const gap = Math.round(2 * uiScale);

    for (const seg of segments) {
      if (seg.t === 'key') {
        const kw = seg.v.length > 2 ? Math.round(52 * uiScale) : Math.round(26 * uiScale);
        const kh = Math.round(24 * uiScale);
        items.push({ t: 'key', label: seg.v, w: kw, h: kh });
        totalW += kw + gap;
      } else {
        const txt = this.add.text(0, -999, seg.v, {
          fontFamily: 'Calibri, Arial, Helvetica, sans-serif',
          fontSize: `${fontSize}px`, fontStyle: 'bold',
          fill: '#ffdd33', stroke: '#000000', strokeThickness: Math.round(1 * uiScale)
        }).setResolution(4);
        txt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        items.push({ t: 'txt', obj: txt, w: txt.width });
        totalW += txt.width;
        this._statusElements.push(txt);
      }
    }

    // Background panel — single Graphics pill shape (no overlap artifacts)
    const padX = Math.round(14 * uiScale);
    const padY = Math.round(7 * uiScale);
    const maxItemH = Math.max(fontSize, Math.round(24 * uiScale));
    const barH = maxItemH + padY * 2;
    const centerY = y + barH / 2;
    const bgW = totalW + padX * 2;
    const bgR = Math.round(barH / 2);
    const bgGfx = this.add.graphics().setDepth(99).setScrollFactor(0);
    bgGfx.fillStyle(0x050505, 0.58);
    bgGfx.fillRoundedRect(gw / 2 - bgW / 2, centerY - barH / 2, bgW, barH, bgR);
    this._statusElements.push(bgGfx);

    // Second pass: position elements centered
    let x = gw / 2 - totalW / 2;
    for (const item of items) {
      if (item.t === 'key') {
        const kBg = this.add.rectangle(x + item.w / 2, centerY, item.w, item.h, 0x4b4b4b, 1)
          .setStrokeStyle(Math.round(2 * uiScale), 0x818181, 1)
          .setDepth(101).setScrollFactor(0);
        const isArrow = /[↑↓←→]/.test(item.label);
        const kFs = isArrow ? Math.round(keyFontSize * 1.5) : keyFontSize;
        const kTxt = this.add.text(x + item.w / 2, centerY, item.label, {
          fontFamily: 'Calibri, Arial, Helvetica, sans-serif', fontSize: `${kFs}px`, fontStyle: 'bold',
          color: '#ffffff'
        }).setOrigin(0.5).setDepth(102).setScrollFactor(0).setResolution(4);
        kTxt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        this._statusElements.push(kBg, kTxt);
        x += item.w + gap;
      } else {
        item.obj.setPosition(x, centerY).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);
        x += item.w;
      }
    }

    // Hide from main camera (show only on UI camera)
    this._statusElements.forEach(el => this.cameras.main.ignore(el));
    this._addingHud = false;
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
        t('needPaint'), {
          font: '11px Bungee, monospace',
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

    // Hide spray icon and outline while painting
    const muralEntry = this._muralGlows && this._muralGlows.find(function(e) { return e.zone === spot; });
    if (muralEntry) {
      if (muralEntry.sprayIcon) muralEntry.sprayIcon.setVisible(false);
      const vis = spot.getData('visual');
      if (vis && vis.setVisible) vis.setVisible(false);
    }

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

    // Tell paint arm about cell dimensions for grid snapping
    if (this.paintArm && this.pbn) {
      const pbn = this.pbn;
      this.paintArm.setGridCells(pbn.cellW, pbn.cellH, (col, row) => {
        if (row < 0 || row >= pbn.rows || col < 0 || col >= pbn.cols) return false;
        return pbn.filledGrid[row][col];
      }, (col, row) => {
        if (row < 0 || row >= pbn.rows || col < 0 || col >= pbn.cols) return -1;
        return pbn.targetGrid[row][col];
      });
      this.paintArm._selectedColorIndex = pbn.selectedColorIndex;
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

    // Reuse mural counter for paint progress — swap text to show %
    const progress = this.pbn.getProgress();
    this._savedMuralCountText = this.hudCountText.text;
    this.hudCountText.setText(`${Math.round(progress * 100)}%`);

    // Color selector HUD — circular buttons (same UI on mobile and desktop)
    const hasColorArr = this.pbn.colorMap.map(c => this.player.hasPaint(c.toLowerCase()));
    this._addingHud = true;
    this.touch.createColorButtons(this, (colorIdx) => {
      if (this.pbn) {
        this.pbn.setSelectedColor(colorIdx);
        this.player.paintColor = this.pbn.getSelectedColorHex();
        if (this.paintArm) {
          this.paintArm.setCanColor(this.pbn.getSelectedColorName());
        }
        // Force flood preview refresh when color changes
        this._armFloodLastCell = null;
        this.updateTouchColorHighlight();
      }
    }, this.pbn.colorMap, () => {
      if (this.player.isPainting) {
        this.player.stopPainting();
        this.cancelPainting();
      }
    }, hasColorArr);
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

    const targetZoom = isMobile ? 5.0 : 3.5;

    // Focus camera on the mural center (mobile) or slightly below player (desktop)
    // so the full paint area is visible on screen
    const anchorX = isMobile ? (bounds.x + bounds.w / 2) : this.player.x;
    const anchorY = isMobile ? (bounds.y + bounds.h / 2) : this.player.y;
    const camOffsetY = isMobile ? 0 : -18;

    this._paintCamAnchor = this.add.rectangle(anchorX, anchorY, 1, 1)
      .setAlpha(0).setDepth(-999);
    cam.startFollow(this._paintCamAnchor, true, 0.1, 0.1);
    cam.setFollowOffset(0, camOffsetY);
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

  updateColorSelectorHighlight() {
    this.updateTouchColorHighlight();
  }

  updateTouchColorHighlight() {
    if (!this.touch || !this.touch.colorButtons || !this.pbn) return;
    const sel = this.pbn.selectedColorIndex;
    this.touch.colorButtons.forEach((btn, idx) => {
      btn.bg.setStrokeStyle(idx === sel ? 3 : 2, 0xffffff, idx === sel ? 1 : 0.3);
    });
  }

  /**
   * Called each frame while arm is over the mural.
   * Shows flood-fill preview of the connected region under the hand.
   * Actual fill is triggered separately by tryFloodFill() on tap/click.
   */
  onPaintMove(handX, handY) {
    if (!this.pbn) return;
    if (this._floodAnimating) return;

    const selectedColorName = this.pbn.getSelectedColorName().toLowerCase();
    if (!this.player.hasPaint(selectedColorName)) return;

    const cell = this.pbn.getCellAt(handX, handY);
    if (!cell) {
      // Arm moved outside the grid — clear preview
      if (this._armFloodLastCell !== null) {
        this._armFloodLastCell = null;
        this._armFloodRegion = null;
        this._destroyFloodPreview();
      }
      return;
    }

    const cellKey = `${cell.row},${cell.col}`;

    // Update preview only when hovering a new cell
    if (cellKey !== this._armFloodLastCell) {
      this._armFloodLastCell = cellKey;
      this._destroyFloodPreview();

      const region = this.pbn.getFloodRegion(cell.row, cell.col);
      if (region) {
        const isCorrectColor = this.pbn.selectedColorIndex === region.colorIndex;
        this._showFloodPreview(region);
        this._armFloodRegion = isCorrectColor ? region : null;
      } else {
        this._armFloodRegion = null;
      }
    }
  }

  /**
   * Execute flood fill on the currently previewed region.
   * Called when the user explicitly taps/clicks (action button or pointer).
   */
  tryFloodFill() {
    if (!this.pbn || this._floodAnimating) return;
    if (!this._armFloodRegion) return;

    const region = this._armFloodRegion;
    const colorName = this.pbn.colorMap[region.colorIndex];
    const totalCost = this.pbn.getFloodCost(region);
    const currentPaint = this.player.getPaintCount(colorName.toLowerCase());

    if (currentPaint >= totalCost - 0.001) {
      this._armFloodRegion = null;
      this._armFloodLastCell = null;
      this._executeFloodFill(region);
    } else {
      // Not enough paint — flash red
      this._flashFloodInsufficient(region);
      this._armFloodRegion = null;
      this._armFloodLastCell = null;
    }
  }

  completePainting() {
    const spot = this.activePaintSpot;

    // Paint was already consumed per-pixel in onPaintMove — no bulk deduction needed

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
    const splash = this.add.text(spotX, spotY, t('tagged'), {
      font: 'bold 16px Bungee, monospace',
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

    // Clean up flood-fill state
    this._destroyFloodPreview();
    this._floodAnimating = false;
    this._floodHeld = false;
    this._armFloodLastCell = null;
    this._armFloodRegion = null;
    this.player.setVisible(true);
    this._paintViewMode = 'arm';

    // --- Camera: always ensure following player + restore zoom ---
    if (this._paintCamAnchor) {
      this._paintCamAnchor.destroy();
      this._paintCamAnchor = null;
    }
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setFollowOffset(0, 0);
    if (this._preZoom != null) {
      // Always restore to the reliable base zoom, not a possibly mid-animation value
      const restoreZoom = this._baseZoom || this._preZoom;
      cam.zoomTo(restoreZoom, 350, 'Sine.easeInOut');
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

    // Restore mural counter text
    if (this._savedMuralCountText != null && this.hudCountText) {
      this.hudCountText.setText(this._savedMuralCountText);
      this._savedMuralCountText = null;
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

    // Restore spray icon and outline after painting
    if (this.activePaintSpot && this._muralGlows) {
      const spot = this.activePaintSpot;
      const entry = this._muralGlows.find(function(e) { return e.zone === spot; });
      if (entry) {
        if (entry.sprayIcon && !spot.getData('painted')) entry.sprayIcon.setVisible(true);
        const vis = spot.getData('visual');
        if (vis && vis.setVisible && !spot.getData('painted')) vis.setVisible(true);
      }
    }
    this.activePaintSpot = null;
  }

  // === FLOOD FILL HELPERS (used by arm paint mode) ===

  /**
   * Destroy flood preview highlight graphics.
   */
  _destroyFloodPreview() {
    if (this._floodPreview) {
      this._floodPreview.destroy();
      this._floodPreview = null;
    }
  }

  /**
   * Show a semi-transparent preview of the flood region under the pointer.
   */
  _showFloodPreview(region) {
    this._destroyFloodPreview();
    if (!region || !this.pbn) return;

    const g = this.add.graphics().setDepth(8);

    const b = this.pbn.bounds;
    const hex = this.pbn.getSelectedColorHex();
    // Check if selected color matches the region's target color
    const isCorrectColor = this.pbn.selectedColorIndex === region.colorIndex;
    const previewHex = isCorrectColor ? hex : 0xff0000;
    const alpha = isCorrectColor ? 0.3 : 0.15;

    g.fillStyle(previewHex, alpha);
    for (const layer of region.layers) {
      for (const { r, c } of layer) {
        const cx = b.x + c * this.pbn.cellW;
        const cy = b.y + r * this.pbn.cellH;
        g.fillRect(cx, cy, this.pbn.cellW, this.pbn.cellH);
      }
    }

    this._floodPreview = g;
  }

  /**
   * Execute flood fill with animated BFS wave.
   * Each BFS layer fills after a staggered delay for a ripple effect.
   */
  _executeFloodFill(region) {
    if (!region || !this.pbn || this._floodAnimating) return;

    // Check paint inventory — need enough for entire flood
    const colorName = this.pbn.colorMap[region.colorIndex];
    const totalCost = this.pbn.getFloodCost(region);
    const currentPaint = this.player.getPaintCount(colorName.toLowerCase());
    if (currentPaint < totalCost) {
      this._flashFloodInsufficient(region);
      return;
    }

    this._floodAnimating = true;
    this._floodHeld = true; // tracks if player is holding button
    this._destroyFloodPreview();

    const delayPerLayer = 45;
    let layerIndex = 0;
    let cellsFilled = 0;

    const fillNextLayer = () => {
      if (layerIndex >= region.layers.length || !this.pbn) {
        this._floodAnimating = false;
        this._floodHeld = false;
        if (this.pbn) {
          const progress = this.pbn.getProgress();
          if (this.hudCountText) this.hudCountText.setText(`${Math.round(progress * 100)}%`);
          if (this.pbn.isComplete()) {
            this.pbn.fillRemaining();
            this.player.finishPainting();
          }
        }
        return;
      }

      // PAUSE if player released the button — wait and check again
      if (!this._floodHeld) {
        this.time.delayedCall(60, fillNextLayer);
        return;
      }

      const layer = region.layers[layerIndex];
      for (const { r, c } of layer) {
        if (this.pbn.fillCellDirect(r, c, true)) {
          cellsFilled++;
          const cost = this.pbn.costPerCell[region.colorIndex] || 1;
          this.player.usePaint(colorName.toLowerCase(), cost);
        }
      }
      // Batch composite update after entire layer
      if (this.pbn.updateDisplay) this.pbn.updateDisplay();

      if (this.pbn && this.hudCountText) {
        const progress = this.pbn.getProgress();
        this.hudCountText.setText(`${Math.round(progress * 100)}%`);
      }
      this.updateHUD();

      layerIndex++;
      this.time.delayedCall(delayPerLayer, fillNextLayer);
    };

    fillNextLayer();
  }

  /**
   * Flash the region red when insufficient paint.
   */
  _flashFloodInsufficient(region) {
    if (!this.pbn) return;
    const g = this.add.graphics().setDepth(9);
    const b = this.pbn.bounds;

    g.fillStyle(0xff0000, 0.35);
    for (const layer of region.layers) {
      for (const { r, c } of layer) {
        const cx = b.x + c * this.pbn.cellW;
        const cy = b.y + r * this.pbn.cellH;
        g.fillRect(cx, cy, this.pbn.cellW, this.pbn.cellH);
      }
    }

    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 500,
      onComplete: () => g.destroy()
    });
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
    this.player._isPullingTrash = false;
    this._activeTrash = null;
    this._trashSnapGap = null;
    if (this.touch) this.touch.setActiveMode('grab', false);
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

    // No horizontal limits — ladder can be pushed freely within world bounds
    const worldW = this.levelData.worldWidth || this.physics.world.bounds.width;
    const newX = Phaser.Math.Clamp(ladderInfo.visual.x + dx, 20, worldW - 20);
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
            this._createLadderBridge(ladderInfo, pivotX, pivotY, ladderHeight, dir, landingPlatform, finalAngle);
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
  _createLadderBridge(ladderInfo, pivotX, pivotY, ladderHeight, dir, landingPlatform, finalAngle) {
    ladderInfo.isBridge = true;
    ladderInfo.isFalling = false;

    const landPlatTop = landingPlatform.y - landingPlatform.height / 2;

    // Bridge endpoints: pivot (source platform edge) and landing point
    const angleDeg = Phaser.Math.RadToDeg(finalAngle); // finalAngle is in radians
    const absAngle = Math.abs(finalAngle);

    // Ladder tip position (where it lands)
    const tipX = pivotX + Math.sin(absAngle) * ladderHeight * dir;
    const tipY = pivotY - Math.cos(absAngle) * ladderHeight;
    // Clamp tip to landing platform top
    const clampedTipY = Math.min(tipY, landPlatTop);

    // Plank center = midpoint between pivot base and tip
    const plankCenterX = (pivotX + tipX) / 2;
    const plankCenterY = (pivotY + clampedTipY) / 2;

    // === Plank visual: plain Image stretched to ladder height ===
    const PLANK_TEX_W = 10;
    const plankDisplayLength = ladderHeight;
    const plankDisplayThick = PLANK_TEX_W * 0.8;

    const plankVisual = this.add.image(plankCenterX, plankCenterY, 'ladder_plank');
    plankVisual.setDisplaySize(plankDisplayThick, plankDisplayLength);
    // Use the actual fall angle (converted to degrees) instead of flat 90°
    plankVisual.setAngle(angleDeg);
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

    // === Physics colliders — staircase of small steps to approximate the slope ===
    // Arcade Physics doesn't support rotated bodies, so we use steps
    const BRIDGE_H = 14;
    const STEPS = 6;
    const bridgeBodies = [];
    for (let i = 0; i < STEPS; i++) {
      const t0 = i / STEPS;
      const t1 = (i + 1) / STEPS;
      const tMid = (t0 + t1) / 2;
      // Interpolate along the plank from pivot to tip
      const sx = pivotX + (tipX - pivotX) * tMid;
      const sy = pivotY + (clampedTipY - pivotY) * tMid + BRIDGE_H / 2;
      const stepW = Math.abs(tipX - pivotX) / STEPS + 4; // slight overlap
      const step = this.add.rectangle(sx, sy, stepW, BRIDGE_H, 0x000000, 0);
      this.physics.add.existing(step, true);
      // Only allow upward collision (for cops). Player uses _bridgeSnap instead.
      step.body.checkCollision.down = false;
      step.body.checkCollision.left = false;
      step.body.checkCollision.right = false;
      step.setData('isBridgePlank', true);
      bridgeBodies.push(step);
    }

    // Use overlap (not collider) for player — no physical separation,
    // only refresh _bridgeGrace. Positioning is done by _bridgeSnap.
    for (const step of bridgeBodies) {
      this.physics.add.overlap(this.player, step, (_p) => {
        if (_p.isClimbing || _p.isDroppingToLadder || _p.isClimbing2) return;
        if (_p._droppingThroughBridge) return;
        _p._bridgeGrace = 10;
      });
      // Cops still use collider for physical support
      this.cops.forEach(cop => {
        this.physics.add.collider(cop, step);
      });
    }

    ladderInfo.bridgeBody = bridgeBodies[0];
    ladderInfo.bridgeBodies = bridgeBodies;
    ladderInfo.bridgeVisual = plankVisual;
    // Store bridge line for smooth _bridgeSnap interpolation
    const bridgeLine = { pivotX, pivotY, tipX, tipY: clampedTipY };
    ladderInfo.bridgeLine = bridgeLine;
    this._bridgeLines.push(bridgeLine);
    for (const step of bridgeBodies) {
      this._bridgeBodies.push(step);
    }
  }

  /**
   * Snap player to bridge surface line every frame.
   * Instead of staircase colliders, directly set player Y
   * from linear interpolation along the bridge slope.
   */
  _bridgeSnap(player) {
    const pb = player.body;
    if (!pb) return;
    if (player.isClimbing || player.isDroppingToLadder || player.isClimbing2) return;
    if (player._droppingThroughBridge) return;

    const playerCenterX = pb.x + pb.width / 2;
    const playerBottom = pb.y + pb.height;
    // If already on bridge, use generous range to keep tracking.
    // If NOT on bridge yet, only snap when very close (landed on a step collider).
    const alreadyOnBridge = player._bridgeGrace > 0;
    const SNAP_ABOVE = 6;                     // max px player feet above surface
    const SNAP_BELOW = alreadyOnBridge ? 14 : 6; // max px player feet below surface

    for (const line of this._bridgeLines) {
      const minX = Math.min(line.pivotX, line.tipX);
      const maxX = Math.max(line.pivotX, line.tipX);
      if (playerCenterX < minX - 4 || playerCenterX > maxX + 4) continue;

      const spanX = line.tipX - line.pivotX;
      if (Math.abs(spanX) < 1) continue;
      const t = Phaser.Math.Clamp((playerCenterX - line.pivotX) / spanX, 0, 1);
      // Slight lift so player walks ON the plank, not through it
      const surfaceY = line.pivotY + (line.tipY - line.pivotY) * t - 4;

      const diff = playerBottom - surfaceY; // positive = feet below surface
      if (diff > -SNAP_ABOVE && diff <= SNAP_BELOW) {
        // DROP-THROUGH: pressing DOWN while on bridge → fall through
        const down = player.cursors.down.isDown || player.wasdKeys.down.isDown
          || (player.touch && player.touch.down);
        if (down && alreadyOnBridge && Math.abs(pb.velocity.x) < 10) {
          player._droppingThroughBridge = true;
          player._bridgeGrace = 0;
          player.body.allowGravity = true;
          this.time.delayedCall(400, () => { player._droppingThroughBridge = false; });
          return;
        }
        // Set ABSOLUTE body bottom to the bridge surface (rounded to whole pixel).
        // Using absolute target prevents oscillation between two Y values.
        const targetBodyBottom = Math.round(surfaceY);
        const currentBodyBottom = Math.round(pb.y + pb.height);
        const nudge = currentBodyBottom - targetBodyBottom;
        if (nudge !== 0) {
          player.y -= nudge;
          pb.y -= nudge;
        }
        pb.velocity.y = 0;
        pb.blocked.down = true;
        player.body.allowGravity = false;
        player._bridgeGrace = 10;
        return;
      }
    }

    // Not on any diagonal bridge — check flat bridges (old style)
    for (const bridge of this._bridgeBodies) {
      if (!bridge.body) continue;
      const bb = bridge.body;
      const bridgeTop = bb.y;
      if (playerCenterX < bb.x || playerCenterX > bb.x + bb.width) continue;
      const diff = playerBottom - bridgeTop;
      if (diff > 0 && diff <= 12) {
        player.y -= diff; pb.y -= diff; pb.velocity.y = 0;
      }
    }
  }

  // === CLOUDS ===

  _spawnCloud(screenW, screenH, onScreen = false) {
    const ci = Phaser.Math.Between(0, 2);
    const key = `__cloud_${ci}__`;
    if (!this.textures.exists(key)) return;
    const x = onScreen ? Phaser.Math.Between(0, screenW) : screenW + 100;
    const y = Phaser.Math.Between(Math.floor(screenH * 0.1), Math.floor(screenH * 0.5));
    const speed = Phaser.Math.FloatBetween(6, 18); // px per second
    const scale = Phaser.Math.FloatBetween(0.8, 1.6);
    const img = this.add.image(x, y, key)
      .setDepth(0).setScrollFactor(0).setScale(scale).setAlpha(0);
    // Fade in
    this.tweens.add({ targets: img, alpha: Phaser.Math.FloatBetween(0.3, 0.7), duration: 2000 });
    this._clouds.push({ img, speed });
  }

  // === UPDATE ===

  update(time, delta) {
    // Tutorial transition — freeze player during camera pans
    if (this._tutTransitioning) {
      this.player.setVelocity(0, 0);
      this.playerInShadow = false;
      this.playerOnLadderThisFrame = false;
      this.interactablePaintSpot = null;
      this.currentLadderInfo = null;
      this.nearbyTrash = null;
      this.collidingTrash = null;
      return;
    }

    // --- Drift clouds ---
    if (this._clouds && this._clouds.length > 0) {
      const dt = delta / 1000;
      const screenW = this.cameras.main.width;
      for (let i = this._clouds.length - 1; i >= 0; i--) {
        const c = this._clouds[i];
        c.img.x -= c.speed * dt;
        if (c.img.x < -250) {
          c.img.destroy();
          this._clouds.splice(i, 1);
        }
      }
      this._cloudTimer += delta;
      if (this._cloudTimer >= this._cloudInterval) {
        this._cloudTimer = 0;
        this._cloudInterval = Phaser.Math.Between(3000, 7000);
        this._spawnCloud(screenW, this.cameras.main.height);
      }
    }

    // Overlap callbacks fired BEFORE this update() call (during physics step).
    // So playerOnLadderThisFrame / playerInShadow already hold this frame's results.

    // 1. Apply overlap results to player state
    this.player.setOnLadder(this.playerOnLadderThisFrame, this.ladderCenterX, this.ladderTopY, this.currentLadderInfo);
    // Shadow zone: tell player whether they're in shadow (for hide mechanic availability)
    // isHidden is now managed by Player — only true when actively hiding (DOWN + stopped + in shadow)
    this.player.inShadowZone = this.playerInShadow;
    // Tell touch controls to bias down-diagonals as pure down near shadows
    // Only activate bias when player is nearly stopped — prevents stripping
    // horizontal input while running, which caused unwanted slide-into-shadow
    if (this.touch && this.touch.enabled) {
      const playerStopped = Math.abs(this.player.body.velocity.x) < 15;
      this.touch.shadowBias = this.playerInShadow && playerStopped;
    }
    // Update shadow down-arrow indicators
    this._updateShadowArrows();

    // Paper blow — trigger when player runs past within range
    if (this.papers.length > 0) {
      const px = this.player.x;
      const py = this.player.y;
      const pvx = this.player.body.velocity.x;
      const speed = Math.abs(pvx);
      if (speed > 40) { // only when actually moving
        for (const paper of this.papers) {
          paper.tick(delta);
          const dy = py - paper.homeY;
          // Only trigger if player is at same level or above paper (dy <= 0..small),
          // never when player is far below (walking under a platform)
          if (Math.abs(px - paper.x) < 60 && dy > -80 && dy < 15) {
            paper.disturb(pvx, speed);
          }
        }
      } else {
        for (const paper of this.papers) {
          paper.tick(delta);
        }
      }
    }
    // Bottle blow — same logic as paper
    if (this.bottles.length > 0) {
      const px = this.player.x;
      const py = this.player.y;
      const pvx = this.player.body.velocity.x;
      const speed = Math.abs(pvx);
      if (speed > 40) {
        for (const bottle of this.bottles) {
          bottle.tick(delta);
          const dy = py - bottle.homeY;
          if (Math.abs(px - bottle.x) < 50 && dy > -80 && dy < 15) {
            bottle.disturb(pvx, speed);
          }
        }
      } else {
        for (const bottle of this.bottles) bottle.tick(delta);
      }
    }
    // Carton blow
    if (this.cartons.length > 0) {
      const px = this.player.x;
      const py = this.player.y;
      const pvx = this.player.body.velocity.x;
      const speed = Math.abs(pvx);
      if (speed > 40) {
        for (const carton of this.cartons) {
          carton.tick(delta);
          const dy = py - carton.homeY;
          if (Math.abs(px - carton.x) < 50 && dy > -80 && dy < 15) {
            carton.disturb(pvx, speed);
          }
        }
      } else {
        for (const carton of this.cartons) carton.tick(delta);
      }
    }

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

    // Animate mural glow & star particles (after ladder detection so all spots are resolved)
    this._updateMuralGlow(time, delta);

    // Tell player if near paint spot (so ladder SPACE doesn't jump but paints instead)
    this.player.nearPaintSpot = !!(this.interactablePaintSpot && canPaint);

    // Tutorial lock: block painting if interact not yet unlocked
    const tutAllowPaint = !this._tutControlLock || this._tutControlLock.interact;
    if (tutAllowPaint && this.interactablePaintSpot && !this.player.isPainting && !this.player.isPushingLadder && canPaint) {
      const paintPressed = Phaser.Input.Keyboard.JustDown(this.paintKeySpace) ||
        (this.touch && this.touch.actionJustPressed);
      if (paintPressed) {
        // DON'T clear isClimbing/onLadder here — tryPaint() needs them
        // to pass its own onLadder check. tryPaint() handles the exit internally.
        this._paintViewMode = 'arm';
        this.tryPaint();
      }
    }
    // While painting, pressing paint button again → exit painting
    if (this.player.isPainting && this.pbn) {
      const togglePressed = Phaser.Input.Keyboard.JustDown(this.paintKeySpace) ||
        (this.touch && this.touch.actionJustPressed);
      if (togglePressed && !this._floodAnimating) {
        this.player.stopPainting();
        this.cancelPainting();
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
    const tutAllowInteract = !this._tutControlLock || this._tutControlLock.interact;
    const eJustPressed = tutAllowInteract && (Phaser.Input.Keyboard.JustDown(this.player.grabKey) ||
      (this.touch && this.touch.eJustPressed));
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
        if (!grabbedLadder && this.nearbyTrash && !this._trashApproachTween) {
          const trash = this.nearbyTrash;
          const dx = trash.x - this.player.x;
          const pushGap = 28;
          const targetX = trash.x - Math.sign(dx) * pushGap;
          const dist = Math.abs(this.player.x - targetX);
          if (dist > 4) {
            // Smooth walk toward trash, then enter push mode
            this.player.setFlipX(dx < 0);
            this.player.playAnim('player_walk');
            this.player.setVelocityX(0);
            this.player.body.setAccelerationX(0);
            this._trashApproachTween = this.tweens.add({
              targets: this.player,
              x: targetX,
              duration: Math.min(400, dist * 4),
              ease: 'Power2',
              onComplete: () => {
                this._trashApproachTween = null;
                this.player.isPushingTrash = true;
                this._activeTrash = trash;  // remember which trash we're interacting with
                this.player.playPushAnim(false); // set push frame immediately — no flicker
                if (this.touch) this.touch.setActiveMode('grab', true);
              }
            });
          } else {
            // Already close enough
            this.player.isPushingTrash = true;
            this._activeTrash = trash;  // remember which trash we're interacting with
            this.player.playPushAnim(false); // set push frame immediately — no flicker
            if (this.touch) this.touch.setActiveMode('grab', true);
          }
        }
      }
    }
    // Cancel approach tween if player jumps or moves away
    if (this._trashApproachTween && !this.player.isPushingTrash) {
      const jumpPressed = Phaser.Input.Keyboard.JustDown(this.player.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.player.wasdKeys.up);
      if (jumpPressed) {
        this._trashApproachTween.stop();
        this._trashApproachTween = null;
      }
    }
    // Auto-exit push mode when player gets too far from the active trash
    if (this.player.isPushingTrash) {
      const ref = this._activeTrash;
      if (ref) {
        const dist = Math.abs(this.player.x - ref.x);
        // Only auto-exit when truly too far away AND not pulling
        const isPulling = !!this.player._isPullingTrash;
        if (!isPulling && dist > 80) {
          this.exitTrashPush();
        } else if (dist > 120) {
          // Even while pulling, if player drifts very far, exit
          this.exitTrashPush();
        }
      } else {
        // No active trash reference — shouldn't happen, but safety exit
        this.exitTrashPush();
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

    // 2d. Snap player to bridge surface line (smooth diagonal walking)
    this._bridgeSnap(this.player);

    // 3. Player movement & input (uses ladder/shadow state)
    this.player.update(delta);

    // 3a. Ladder-to-platform landing: when climbing down, detect platform under feet
    // NOTE: This is now handled entirely by Player.update() platform-edge detection
    // which properly skips the ladder-top platform and checks isDroppingToLadder.
    // The old GameScene check was causing premature detachment because it didn't
    // account for isDroppingToLadder or the ladder-top platform.

    // 3b. Paint arm update — drive hand movement, rope simulation, flood fill
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
              this._armFloodLastCell = null; // force flood preview refresh
            }
          }
        }
      }

      // Color selector is fixed on screen (circular buttons via TouchControls)

      const cursors = this.player.cursors;
      const wasd = this.player.wasdKeys;
      const t = this.touch;
      const input = {
        left:  cursors.left.isDown  || wasd.left.isDown  || (t && t.left),
        right: cursors.right.isDown || wasd.right.isDown || (t && t.right),
        up:    cursors.up.isDown    || wasd.up.isDown    || (t && t.up),
        down:  cursors.down.isDown  || wasd.down.isDown  || (t && t.down),
        intensityX: t ? t.intensityX : 1,
        intensityY: t ? t.intensityY : 1,
      };
      const isTouch = !!(t && t.enabled);

      // Keep paint arm in sync with selected color for snapping
      if (this.pbn) this.paintArm._selectedColorIndex = this.pbn.selectedColorIndex;

      // Desktop: arm always follows mouse cursor (not just on click)
      // Camera follows fixed anchor during painting, so world mapping is stable
      let mouseWorld = null;
      if (!isTouch) {
        const worldPoint = this.cameras.main.getWorldPoint(
          this.input.activePointer.x, this.input.activePointer.y
        );
        mouseWorld = { x: worldPoint.x, y: worldPoint.y };
      }

      // Pass original X for shoulder visual, actual X for arm attachment
      const handPos = this.paintArm.update(delta, input, this.player.x, this.player.y, isTouch, mouseWorld);

      // Dodge: shift player aside when hand overlaps player sprite
      if (handPos) {
        this.player.updatePaintDodge(handPos.x, delta);
      }

      // On desktop arm always tracks mouse — treat as "moving" only when pointer moves or keys pressed
      const isMovingHand = !!(input.left || input.right || input.up || input.down) ||
        (!isTouch && this.input.activePointer.isDown);
      if (handPos) {
        this.onPaintMove(handPos.x, handPos.y);
        this.player.spawnPaintSpray(handPos.x, handPos.y);
      }

      // --- Flood fill trigger + hold-to-fill ---
      const floodPtr = this.input.activePointer;
      const touchFillPressed = !!(this.touch && this.touch.paintFillJustPressed);
      const touchFillHeld = !!(this.touch && this.touch.paintFillHeld);

      // Track hold state for active flood animation
      if (this._floodAnimating) {
        // Mobile: auto-paint keeps filling as long as joystick is active
        // Desktop: held while pointer is down
        this._floodHeld = isTouch ? isMovingHand : floodPtr.isDown;
      }

      // Start new flood on click/tap (not during active animation)
      if (!this._floodAnimating) {
        if (isTouch) {
          // Mobile: auto-paint when hand moves over a region of the selected color
          if (handPos && this.pbn && this._armFloodRegion && isMovingHand) {
            const reg = this._armFloodRegion;
            if (reg.colorIndex === this.pbn.selectedColorIndex) {
              this.tryFloodFill();
            }
          }
        } else {
          // Desktop: mouse click inside mural bounds
          if (floodPtr.isDown && !this._floodPointerWasDown) {
            if (handPos && this.pbn) {
              const b = this.pbn.bounds;
              const wp = this.cameras.main.getWorldPoint(floodPtr.x, floodPtr.y);
              const inBounds = wp.x >= b.x && wp.x <= b.x + b.w &&
                               wp.y >= b.y && wp.y <= b.y + b.h;
              if (inBounds) {
                this.tryFloodFill();
              }
            }
          }
        }
      }
      this._floodPointerWasDown = floodPtr.isDown;

      // --- Spray SFX: play while hand is moving ---
      if (this.sfxSpray) {
        if (isMovingHand && !this._sprayPlaying) {
          this.sfxSpray.play();
          this._sprayPlaying = true;
          this._paintIdleTimer = 0;
          this._sprayShakeTimer = Phaser.Math.Between(800, 2500);
        } else if (!isMovingHand && this._sprayPlaying) {
          this.sfxSpray.stop();
          this._sprayPlaying = false;
          this._paintIdleTimer = 0;
          this._nextShakeDelay = Phaser.Math.Between(2000, 5000);
        }
      }

      // --- Random spray shake sound while actively painting ---
      if (this._sprayPlaying) {
        this._sprayShakeTimer = (this._sprayShakeTimer || 0) - delta;
        if (this._sprayShakeTimer <= 0) {
          this.sound.play('sfx_spray_shake', { volume: Phaser.Math.FloatBetween(0.12, 0.25) });
          this._sprayShakeTimer = Phaser.Math.Between(1200, 3500);
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

    // 3b. Move trash when player is pushing OR pulling it
    // Use _activeTrash (set when entering push mode) instead of collidingTrash,
    // because when pulling the player moves away and loses collision contact.
    const activeT = this._activeTrash || this.collidingTrash;
    if (this.player.isPushingTrash && activeT) {
      const t = activeT;
      // Use input direction, not velocity (velocity is 0 because collider blocks player)
      const tc = this.touch;
      const left = this.player.cursors.left.isDown || this.player.wasdKeys.left.isDown || (tc && tc.left);
      const right = this.player.cursors.right.isDown || this.player.wasdKeys.right.isDown || (tc && tc.right);
      const trashIsRight = t.x > this.player.x;
      const pushingToward = (trashIsRight && right) || (!trashIsRight && left);
      const pullingAway   = (trashIsRight && left)  || (!trashIsRight && right);
      if (pushingToward || pullingAway) {
        const pushSpeed = 35; // same speed for push & pull
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
      // Record initial gap when push/pull starts; reuse for the whole interaction.
      // This prevents the player from gradually creeping into the trash (push)
      // or drifting away from it (pull).
      if ((pushingToward || pullingAway) && (left || right)) {
        if (!this._trashSnapGap) {
          this._trashSnapGap = Math.abs(this.player.x - t.x);
          if (this._trashSnapGap < 20) this._trashSnapGap = 20;
          if (this._trashSnapGap > 40) this._trashSnapGap = 40;
        }
        // Kill normal velocity so input doesn't fight the snap
        this.player.setVelocityX(0);
        this.player.body.setAccelerationX(0);
        // Snap player to fixed offset from trash
        const sign = t.x > this.player.x ? 1 : -1; // +1 = trash is to the right
        const targetX = t.x - sign * this._trashSnapGap;
        this.player.x = targetX;
        this.player.body.position.x = this.player.x - this.player.body.width / 2;
        this.player.body.prev.x = this.player.body.position.x;
      } else {
        this._trashSnapGap = null; // reset when idle
      }
      // Tell player whether pulling (for reversed push animation)
      this.player._isPullingTrash = pullingAway && (left || right);
    } else {
      this.player._isPullingTrash = false;
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

    // 4a3. Tutorial mode phase progression
    if (this.mode === 'tutorial') this.updateTutorial(delta);

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

      // Active mode for grab button (push trash or ladder) — show "✕" exit icon
      const grabActive = this.player.isPushingTrash || this.player.isPushingLadder;
      if (grabActive !== this.touch._grabActive) {
        this.touch.setActiveMode('grab', grabActive);
      }
    }

    // 5. HUD (uses interactablePaintSpot, ladder info)
    this.updateHUD();


    // 6. Reset flags AFTER use — next frame's physics step will set them again
    // Grace period (100ms) to prevent flickering at high frame rates.
    // Phaser overlap callbacks can miss 1-2 frames at 114+ fps.
    const overlapGrace = 100; // ms
    const now = this.time.now;

    // Shadow
    if (this._shadowOverlapTs && now - this._shadowOverlapTs > overlapGrace) {
      this.playerInShadow = false;
    }

    // Paint spot
    if (this._paintSpotOverlapTs && now - this._paintSpotOverlapTs < overlapGrace) {
      // Keep last paint spot alive during grace period
      if (!this.interactablePaintSpot && this._lastPaintSpot && !this._lastPaintSpot.getData('painted')) {
        this.interactablePaintSpot = this._lastPaintSpot;
      }
    } else {
      this.interactablePaintSpot = null;
    }

    // Ladder — reset every frame (no grace period for gameplay logic;
    // grace period only used for UI hints via _ladderOverlapTs check in updateHUD)
    this.playerOnLadderThisFrame = false;
    this.currentLadderInfo = null;

    this.nearbyTrash = null;
    this.collidingTrash = null;
  }
}
