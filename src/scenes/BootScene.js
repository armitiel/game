import Phaser from 'phaser';
import { GAME, PLAYER, COP, PAINT } from '../config/gameConfig.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // === Progress bar with loading_frame.png ===
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Phase 1: load the frame image first, then set up fancy progress bar
    const frameKey = '__loading_frame';
    this.load.image(frameKey, 'assets/sprites/elementy/loading_frame.png');

    // Temporary simple bar while frame loads
    const progressBar = this.add.graphics();
    const progressGlow = this.add.graphics();
    const barW = 320, barH = 30;
    const barX = width / 2 - barW / 2;
    const barY = height / 2 - barH / 2;

    let frameImg = null;

    const loadingText = this.add.text(width / 2, barY - 62, 'Loading...', {
      font: '36px ChangaOne, monospace',
      fill: '#00ff88',
      stroke: '#003322', strokeThickness: 3
    }).setOrigin(0.5);

    // Once frame texture is ready, show it behind the bar
    this.load.on('filecomplete-image-' + frameKey, () => {
      frameImg = this.add.image(width / 2, height / 2, frameKey);
      // Scale frame to fit around the bar with some padding
      const fw = frameImg.width, fh = frameImg.height;
      const targetW = barW + 40, targetH = barH + 40;
      frameImg.setDisplaySize(targetW, targetH);
      frameImg.setDepth(0);
      progressBar.setDepth(1);
      progressGlow.setDepth(1);
      loadingText.setDepth(2);
    });

    this.load.on('progress', (value) => {
      const fillW = (barW - 10) * value;
      const fillH = barH - 10;
      const fillX = barX + 5;
      const fillY = barY + 4;

      // Glow behind the bar
      progressGlow.clear();
      progressGlow.fillStyle(0x00ff88, 0.15);
      progressGlow.fillRoundedRect(fillX - 4, fillY - 4, fillW + 8, fillH + 8, 6);
      progressGlow.fillStyle(0x00ff88, 0.08);
      progressGlow.fillRoundedRect(fillX - 8, fillY - 8, fillW + 16, fillH + 16, 8);

      // Main bar with 3D shading
      progressBar.clear();

      // Dark inset background
      progressBar.fillStyle(0x0a1a10, 0.9);
      progressBar.fillRoundedRect(barX + 3, barY + 3, barW - 6, barH - 6, 4);

      // Main green fill
      if (fillW > 0) {
        // Bottom shadow (darker green)
        progressBar.fillStyle(0x00aa55, 1);
        progressBar.fillRoundedRect(fillX, fillY + 2, fillW, fillH - 2, 3);

        // Main fill
        progressBar.fillStyle(0x00ff88, 1);
        progressBar.fillRoundedRect(fillX, fillY, fillW, fillH - 4, 3);

        // Top highlight (lighter)
        progressBar.fillStyle(0x66ffbb, 0.5);
        progressBar.fillRoundedRect(fillX + 2, fillY + 1, fillW - 4, (fillH - 4) * 0.4, 2);
      }
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressGlow.destroy();
      if (frameImg) frameImg.destroy();
      loadingText.destroy();
    });

    // === Load music ===
    // Multiple formats: browser picks first supported (m4a=iOS/Safari preferred, mp3=universal, ogg=Firefox/Chrome)
    this.load.audio('bgm', ['assets/sprites/bgm.m4a', 'assets/sprites/bgm.mp3', 'assets/sprites/bgm.ogg']);

    // === Load SFX ===
    this.load.audio('sfx_spray', ['assets/sounds/spray.m4a', 'assets/sounds/spray.mp3', 'assets/sounds/spray.ogg']);
    this.load.audio('sfx_canshake', ['assets/sounds/canshake.m4a', 'assets/sounds/canshake.mp3', 'assets/sounds/canshake.ogg']);

    // === Load logo ===
    this.load.image('logo', 'assets/sprites/logo.png');
    this.load.image('bckg', 'assets/sprites/bckg.png');
    this.load.spritesheet('mode_frames', 'assets/sprites/frames.png', {
      frameWidth: 512, frameHeight: 1024
    });

    // === Load platform/environment textures ===
    this.load.image('platform_block', 'assets/sprites/elementy/p1.png');
    this.load.image('ladder_tile', 'assets/sprites/elementy/drabinka.png');
    this.load.image('ladder_plank', 'assets/sprites/elementy/drabinka2.png');
    // Spray can base image — grayscale body will be recolored per paint color
    this.load.image('spray_can_base', 'assets/sprites/elementy/can.png');
    this.load.image('trash', 'assets/sprites/elementy/trash.png');
    this.load.image('trash2', 'assets/sprites/elementy/trash2.png');
    this.load.image('heart_icon', 'assets/sprites/elementy/serce.png');
    this.load.image('brick', 'assets/sprites/elementy/brick.png');
    this.load.image('brick2', 'assets/sprites/elementy/brick2.png');
    this.load.image('shadow_img', 'assets/sprites/elementy/shadow.png');
    this.load.image('lamp_img', 'assets/sprites/elementy/lamp.png');
    this.load.image('paper_img', 'assets/sprites/elementy/paper.png');
    // UI pictograms (SVG)
    this.load.svg('icon_hand', 'assets/sprites/elementy/hand.svg', { width: 64, height: 64 });
    this.load.svg('icon_spray', 'assets/sprites/elementy/spray.svg', { width: 64, height: 64 });

    // === Load paint arm assets ===
    this.load.image('paint_hand', 'assets/sprites/hand.png');
    this.load.image('paint_arm', 'assets/sprites/arm.png');

    // === Load unified player sprite sheet (all animations in one) ===
    this.load.spritesheet('player_sheet', PLAYER.SHEET_PATH, {
      frameWidth: PLAYER.FRAME_W,
      frameHeight: PLAYER.FRAME_H
    });

    // === Load paint-by-numbers painting data ===
    this.load.json('painting_heart', 'assets/paintings/heart_mural.json');
    this.load.json('painting_star', 'assets/paintings/star_mural.json');
    this.load.json('painting_mural_big', 'assets/paintings/pikachu_mural.json');

    // === Generate other textures procedurally ===
    this.generateOtherTextures();
  }

  generateOtherTextures() {
    // Cop sprite
    const copGfx = this.make.graphics({ add: false });
    copGfx.fillStyle(COP.COLOR, 1);
    copGfx.fillRect(0, 0, COP.WIDTH, COP.HEIGHT);
    copGfx.fillStyle(0x1a1a44, 1);
    copGfx.fillRect(2, 0, COP.WIDTH - 4, 8);
    copGfx.fillStyle(0xffdd33, 1);
    copGfx.fillCircle(COP.WIDTH / 2, 18, 3);
    copGfx.generateTexture('cop', COP.WIDTH, COP.HEIGHT);
    copGfx.destroy();

    // Platform tile
    const platGfx = this.make.graphics({ add: false });
    platGfx.fillStyle(0x444466, 1);
    platGfx.fillRect(0, 0, 32, 32);
    platGfx.lineStyle(1, 0x555577, 1);
    platGfx.strokeRect(0, 0, 32, 32);
    platGfx.generateTexture('platform', 32, 32);
    platGfx.destroy();

    // Ladder tile
    const ladderGfx = this.make.graphics({ add: false });
    ladderGfx.fillStyle(0x886633, 1);
    ladderGfx.fillRect(0, 0, 4, 32);
    ladderGfx.fillRect(20, 0, 4, 32);
    ladderGfx.fillRect(0, 6, 24, 3);
    ladderGfx.fillRect(0, 16, 24, 3);
    ladderGfx.fillRect(0, 26, 24, 3);
    ladderGfx.generateTexture('ladder', 24, 32);
    ladderGfx.destroy();

    // Shadow zone
    const shadowGfx = this.make.graphics({ add: false });
    shadowGfx.fillStyle(0x000000, 0.6);
    shadowGfx.fillRect(0, 0, 64, 64);
    shadowGfx.generateTexture('shadow_zone', 64, 64);
    shadowGfx.destroy();

    // Paint cans — real textures generated in create() from can.png base
    // (can.png must be loaded first before pixel manipulation)

    // HUD empty slot — semi-transparent silhouette of can.png
    this._generateEmptyCanSlot();

    // Paint spots — brick wall with marked area (target + painted)
    const SW = PAINT.SPOT_W;  // 64
    const SH = PAINT.SPOT_H;  // 80

    // Build small brick wall textures for simple paint spots using real brick tiles
    const brickImg = this.make.image({ key: 'brick', add: false }).setScale(0.35);
    const brick2Img = this.make.image({ key: 'brick2', add: false }).setScale(0.35);
    const tbw = Math.round(54 * 0.35);  // ~19
    const tbh = Math.round(26 * 0.35);  // ~9
    const tgap = 1;

    Object.entries(PAINT.COLORS).forEach(([name, color]) => {
      // TARGET: brick wall with colored outline marking
      const spotRT = this.make.renderTexture({ width: SW, height: SH, add: false });
      // Background
      const spotBg = this.make.graphics({ add: false });
      spotBg.fillStyle(0x8f3833, 1);
      spotBg.fillRect(0, 0, SW, SH);
      spotRT.draw(spotBg, 0, 0);
      spotBg.destroy();
      // Shadow pass
      const spotShadow = this.make.graphics({ add: false });
      spotShadow.fillStyle(0x000000, 0.35);
      const rows = Math.ceil(SH / (tbh + tgap));
      for (let row = 0; row < rows; row++) {
        const by = row * (tbh + tgap);
        const rowOff = (row % 2) * Math.round(tbw / 2 + tgap);
        for (let col = -1; col < Math.ceil(SW / (tbw + tgap)) + 2; col++) {
          const bx = col * (tbw + tgap) + rowOff;
          if (bx + tbw <= 0 || bx >= SW) continue;
          spotShadow.fillRect(bx + 1, by + 1, tbw, tbh);
        }
      }
      spotRT.draw(spotShadow, 0, 0);
      spotShadow.destroy();
      // Brick pass
      for (let row = 0; row < rows; row++) {
        const by = row * (tbh + tgap);
        const rowOff = (row % 2) * Math.round(tbw / 2 + tgap);
        for (let col = -1; col < Math.ceil(SW / (tbw + tgap)) + 2; col++) {
          const bx = col * (tbw + tgap) + rowOff;
          if (bx + tbw <= 0 || bx >= SW) continue;
          const img = ((row + col) % 3 === 0) ? brick2Img : brickImg;
          spotRT.draw(img, bx + tbw / 2, by + tbh / 2);
        }
      }
      // Colored outline + corner markers
      const spotOverlay = this.make.graphics({ add: false });
      spotOverlay.lineStyle(2, color, 0.9);
      spotOverlay.strokeRect(4, 4, SW - 8, SH - 8);
      const cm = 8;
      spotOverlay.fillStyle(color, 0.6);
      spotOverlay.fillRect(2, 2, cm, 3);
      spotOverlay.fillRect(2, 2, 3, cm);
      spotOverlay.fillRect(SW - cm - 2, 2, cm, 3);
      spotOverlay.fillRect(SW - 5, 2, 3, cm);
      spotOverlay.fillRect(2, SH - 5, cm, 3);
      spotOverlay.fillRect(2, SH - cm - 2, 3, cm);
      spotOverlay.fillRect(SW - cm - 2, SH - 5, cm, 3);
      spotOverlay.fillRect(SW - 5, SH - cm - 2, 3, cm);
      spotRT.draw(spotOverlay, 0, 0);
      spotOverlay.destroy();
      spotRT.saveTexture(`paint_spot_${name.toLowerCase()}`);
      spotRT.destroy();

      // PAINTED: brick wall covered with graffiti color
      const paintedRT = this.make.renderTexture({ width: SW, height: SH, add: false });
      const paintedBg = this.make.graphics({ add: false });
      // Base brick bg
      paintedBg.fillStyle(0x8f3833, 1);
      paintedBg.fillRect(0, 0, SW, SH);
      paintedRT.draw(paintedBg, 0, 0);
      paintedBg.destroy();
      // Brick shadow + tile pass (same as target)
      const pdShadow = this.make.graphics({ add: false });
      pdShadow.fillStyle(0x000000, 0.35);
      for (let row = 0; row < rows; row++) {
        const by = row * (tbh + tgap);
        const rowOff = (row % 2) * Math.round(tbw / 2 + tgap);
        for (let col = -1; col < Math.ceil(SW / (tbw + tgap)) + 2; col++) {
          const bx = col * (tbw + tgap) + rowOff;
          if (bx + tbw <= 0 || bx >= SW) continue;
          pdShadow.fillRect(bx + 1, by + 1, tbw, tbh);
        }
      }
      paintedRT.draw(pdShadow, 0, 0);
      pdShadow.destroy();
      for (let row = 0; row < rows; row++) {
        const by = row * (tbh + tgap);
        const rowOff = (row % 2) * Math.round(tbw / 2 + tgap);
        for (let col = -1; col < Math.ceil(SW / (tbw + tgap)) + 2; col++) {
          const bx = col * (tbw + tgap) + rowOff;
          if (bx + tbw <= 0 || bx >= SW) continue;
          const img = ((row + col) % 3 === 0) ? brick2Img : brickImg;
          paintedRT.draw(img, bx + tbw / 2, by + tbh / 2);
        }
      }
      // Paint fill overlay
      const paintOverlay = this.make.graphics({ add: false });
      paintOverlay.fillStyle(color, 0.85);
      paintOverlay.fillRect(3, 3, SW - 6, SH - 6);
      // Paint drips
      paintOverlay.fillStyle(color, 0.7);
      paintOverlay.fillRect(10, SH - 6, 4, 6);
      paintOverlay.fillRect(30, SH - 6, 3, 6);
      paintOverlay.fillRect(50, SH - 6, 5, 6);
      // Highlight streaks
      paintOverlay.fillStyle(0xffffff, 0.25);
      paintOverlay.fillRect(8, 12, 20, 3);
      paintOverlay.fillRect(14, 30, 30, 3);
      paintOverlay.fillRect(6, 50, 16, 3);
      paintOverlay.fillRect(28, 60, 24, 3);
      paintedRT.draw(paintOverlay, 0, 0);
      paintOverlay.destroy();
      paintedRT.saveTexture(`paint_done_${name.toLowerCase()}`);
      paintedRT.destroy();
    });
    brickImg.destroy();
    brick2Img.destroy();

    // Detection cone
    const coneGfx = this.make.graphics({ add: false });
    coneGfx.fillStyle(0xffff00, 0.15);
    coneGfx.fillTriangle(0, 0, COP.DETECTION_RANGE, -40, COP.DETECTION_RANGE, 40);
    coneGfx.generateTexture('detection_cone', COP.DETECTION_RANGE, 80);
    coneGfx.destroy();

    // Hidden icon (crossed eye)
    const eyeGfx = this.make.graphics({ add: false });
    eyeGfx.lineStyle(2, 0x00ff88, 1);
    eyeGfx.strokeCircle(8, 8, 6);
    eyeGfx.lineBetween(2, 2, 14, 14);
    eyeGfx.generateTexture('hidden_icon', 16, 16);
    eyeGfx.destroy();

    // Leaf texture (for wind effect)
    const leafGfx = this.make.graphics({ add: false });
    leafGfx.fillStyle(0x5a9e45, 1);
    // Main leaf body — pointed oval
    leafGfx.fillEllipse(10, 6, 18, 10);
    // Tip point
    leafGfx.fillTriangle(18, 6, 14, 2, 14, 10);
    // Stem
    leafGfx.lineStyle(1.5, 0x2d5a27, 1);
    leafGfx.lineBetween(1, 6, 10, 6);
    leafGfx.generateTexture('leaf_tex', 22, 12);
    leafGfx.destroy();
  }

  create() {
    // ==============================================
    // ANIMATION SETUP — all from unified player_sheet
    // idle: 0-17, walk: 18-41, jump: 42-61, push: 62-85,
    // climb: 86-104 (manual), climb2: 105-124, paint: 125-149
    // ==============================================

    const I = PLAYER.IDLE_FRAME_START;       // 0
    const IN = PLAYER.TOTAL_IDLE_FRAMES;     // 18
    const W = PLAYER.WALK_FRAME_START;       // 18
    const WN = PLAYER.TOTAL_WALK_FRAMES;     // 24
    const J = PLAYER.JUMP_FRAME_START;       // 42
    const JN = PLAYER.TOTAL_JUMP_FRAMES;     // 20
    const P = PLAYER.PUSH_FRAME_START;       // 62
    const PN = PLAYER.TOTAL_PUSH_FRAMES;     // 24
    const C2 = PLAYER.CLIMB2_FRAME_START;    // 105
    const C2N = PLAYER.TOTAL_CLIMB2_FRAMES;  // 20
    const T = PLAYER.TURN_FRAME_START;       // 125
    const TN = PLAYER.TOTAL_TURN_FRAMES;     // 25

    // --- IDLE: 18-frame idle sequence ---
    this.anims.create({
      key: 'player_idle',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: I, end: I + IN - 1 }),
      frameRate: 10,
      repeat: -1
    });

    // --- WALK: 24-frame cycle ---
    this.anims.create({
      key: 'player_walk',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: W, end: W + WN - 1 }),
      frameRate: 38,
      repeat: -1
    });

    // --- JUMP: launch phase (first half of jump frames) ---
    const halfJump = Math.floor(JN / 2);
    this.anims.create({
      key: 'player_jump',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: J, end: J + halfJump - 1 }),
      frameRate: 24,
      repeat: 0
    });

    // --- FALL: descent + landing (second half of jump frames) ---
    this.anims.create({
      key: 'player_fall',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: J + halfJump, end: J + JN - 1 }),
      frameRate: 20,
      repeat: 0
    });

    // --- PUSH: looping push animation (24 frames) ---
    this.anims.create({
      key: 'player_push',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: P, end: P + PN - 1 }),
      frameRate: 14,
      repeat: -1
    });

    // CLIMB: frames 86-104, manually controlled in Player.js (no auto-play)

    // --- CLIMB2: ledge climb onto platform (20 frames, plays once) ---
    this.anims.create({
      key: 'player_climb2',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: C2, end: C2 + C2N - 1 }),
      frameRate: 20,
      repeat: 0
    });

    // --- PAINT: character paints wall (25 frames, one-shot) ---
    this.anims.create({
      key: 'player_paint',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: T, end: T + TN - 1 }),
      frameRate: 12,
      repeat: 0
    });

    // --- PAINT LOOP: looping version for active painting mode ---
    this.anims.create({
      key: 'player_paint_loop',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: T, end: T + TN - 1 }),
      frameRate: 12,
      repeat: -1
    });

    // TWIST: idle fidget animation (plays after 5s of no input)
    const TW = PLAYER.TWIST_FRAME_START;
    const TWN = PLAYER.TOTAL_TWIST_FRAMES;
    this.anims.create({
      key: 'player_twist',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: TW, end: TW + TWN - 1 }),
      frameRate: 11,
      repeat: 0  // play once, then return to idle
    });

    // --- SIDE: ladder push animation (frame 0 = idle hold, frames 1-27 = pushing) ---
    const SD = PLAYER.SIDE_FRAME_START;
    const SDN = PLAYER.TOTAL_SIDE_FRAMES;
    // Side idle: just the first frame (holding ladder, not moving)
    this.anims.create({
      key: 'player_side_idle',
      frames: [{ key: 'player_sheet', frame: SD }],
      frameRate: 1,
      repeat: 0
    });
    // Side walk: frames 1 to end (pushing/pulling ladder)
    this.anims.create({
      key: 'player_side_walk',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: SD + 1, end: SD + SDN - 1 }),
      frameRate: 36,
      repeat: -1
    });

    // --- HIDE: crouching into shadow (transition plays once, then holds last frame) ---
    const HD = PLAYER.HIDE_FRAME_START;
    const HDN = PLAYER.TOTAL_HIDE_FRAMES;
    // Transition: full sequence from standing to crouching (plays once)
    this.anims.create({
      key: 'player_hide',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: HD, end: HD + HDN - 1 }),
      frameRate: 18,
      repeat: 0
    });
    // Held pose: last frame of hide (fully crouched)
    this.anims.create({
      key: 'player_hide_idle',
      frames: [{ key: 'player_sheet', frame: HD + HDN - 1 }],
      frameRate: 1,
      repeat: 0
    });
    // Reverse: standing up from crouch (plays once, then return to idle)
    this.anims.create({
      key: 'player_hide_reverse',
      frames: this.anims.generateFrameNumbers('player_sheet', { start: HD + HDN - 1, end: HD }),
      frameRate: 22,
      repeat: 0
    });

    // === Generate paint can textures from can.png base (all colors) ===
    this._generateAllPaintCanTextures();

    // === Register palette colors from painting JSONs ===
    this.registerPaintingPalettes();

    // Force-load ChangaOne font (CSS @font-face only loads when used in DOM, not Canvas)
    document.fonts.load('bold 20px ChangaOne').then(() => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Generate HUD empty slot: semi-transparent dark silhouette of can.png.
   * Preserves original proportions of the spray can asset.
   */
  _generateEmptyCanSlot() {
    const srcTex = this.textures.get('spray_can_base');
    const srcImg = srcTex.getSourceImage();
    const sw = srcImg.width, sh = srcImg.height;

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(srcImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, sw, sh);
    const d = imgData.data;

    // Convert to dark semi-transparent silhouette
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      // Dark blue-gray tint, reduced opacity
      d[i]     = 30;   // R
      d[i + 1] = 30;   // G
      d[i + 2] = 50;   // B
      d[i + 3] = Math.min(d[i + 3], 100); // semi-transparent
    }

    ctx.putImageData(imgData, 0, 0);
    this.textures.addCanvas('hud_can_empty', canvas);
  }

  /**
   * Generate all paint can textures from can.png base.
   * Recolors the body for each color in PAINT.COLORS.
   */
  _generateAllPaintCanTextures() {
    Object.entries(PAINT.COLORS).forEach(([name, colorHex]) => {
      this._generateCanVariants(name.toLowerCase(), colorHex);
    });
  }

  /**
   * Scan all loaded painting JSONs for `palette` field.
   * Auto-register new colors in PAINT.COLORS and generate textures.
   */
  registerPaintingPalettes() {
    const paintingKeys = ['painting_heart', 'painting_star', 'painting_mural_big'];

    for (const key of paintingKeys) {
      const data = this.cache.json.get(key);
      if (!data || !data.palette) continue;

      for (const [name, hex] of Object.entries(data.palette)) {
        // Skip if already registered
        if (PAINT.COLORS[name]) continue;

        // Register color: "#ff3344" → 0xff3344
        const colorHex = parseInt(hex.replace('#', ''), 16);
        PAINT.COLORS[name] = colorHex;

        // Recolor once, create all texture variants
        this._generateCanVariants(name.toLowerCase(), colorHex);
      }
    }
  }

  /**
   * Recolor can body ONCE, then create all 3 texture variants from the result.
   * This avoids iterating 208k pixels multiple times per color.
   */
  _generateCanVariants(colorKey, targetHex) {
    const srcTex = this.textures.get('spray_can_base');
    const srcImg = srcTex.getSourceImage();
    const sw = srcImg.width, sh = srcImg.height;

    // Recolor on a single canvas
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(srcImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, sw, sh);
    const d = imgData.data;

    const tR = (targetHex >> 16) & 0xff;
    const tG = (targetHex >> 8) & 0xff;
    const tB = targetHex & 0xff;

    // Body band: start higher (~30%) and extend lower (~87%)
    const bodyTop = Math.floor(sh * 0.30);
    const bodyBottom = Math.floor(sh * 0.87);

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      const py = (i >> 2) / sw | 0;
      if (py < bodyTop || py > bodyBottom) continue;

      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (r + g + b) / 3;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if ((mx - mn) / 255 < 0.25 && lum > 60) {
        const f = lum / 200;
        d[i]     = Math.min(255, tR * f + 0.5 | 0);
        d[i + 1] = Math.min(255, tG * f + 0.5 | 0);
        d[i + 2] = Math.min(255, tB * f + 0.5 | 0);
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // World sprite — full resolution (PaintCan.js uses setScale)
    this.textures.addCanvas(`paint_can_sprite_${colorKey}`, canvas);

    // Mini icon & HUD icon — share the same full-res canvas
    // (Phaser scales via setScale/displaySize, no need for separate small textures)
    const cloneCanvas = (key) => {
      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      c.getContext('2d').drawImage(canvas, 0, 0);
      this.textures.addCanvas(key, c);
    };
    cloneCanvas(`paint_can_${colorKey}`);
    cloneCanvas(`hud_can_${colorKey}`);
  }

}
