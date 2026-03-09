import Phaser from 'phaser';
import { GAME, PLAYER, COP, PAINT } from '../config/gameConfig.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // === Progress bar ===
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      font: '18px monospace',
      fill: '#00ff88'
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff88, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
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

    // === Load platform/environment textures ===
    this.load.image('platform_block', 'assets/sprites/elementy/blok.png');
    this.load.image('ladder_tile', 'assets/sprites/elementy/drabinka.png');
    // Spray can base image — grayscale body will be recolored per paint color
    this.load.image('spray_can_base', 'assets/sprites/elementy/can.png');
    this.load.image('trash', 'assets/sprites/elementy/trash.png');
    this.load.image('trash2', 'assets/sprites/elementy/trash2.png');

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

    // HUD empty slot (procedural — no image needed)
    const emptyGfx = this.make.graphics({ add: false });
    emptyGfx.fillStyle(0x333344, 0.5);
    emptyGfx.fillRoundedRect(3, 8, 18, 18, 2);
    emptyGfx.fillRect(6, 4, 12, 5);
    emptyGfx.lineStyle(1.5, 0x666688, 0.6);
    emptyGfx.strokeCircle(12, 4, 4);
    emptyGfx.lineStyle(1, 0x666688, 0.6);
    emptyGfx.strokeRoundedRect(3, 8, 18, 18, 2);
    emptyGfx.strokeRect(6, 4, 12, 5);
    emptyGfx.generateTexture('hud_can_empty', 24, 28);
    emptyGfx.destroy();

    // Paint spots — brick wall with marked area (target + painted)
    const SW = PAINT.SPOT_W;  // 64
    const SH = PAINT.SPOT_H;  // 80

    Object.entries(PAINT.COLORS).forEach(([name, color]) => {
      // TARGET: brick wall with colored outline marking
      const spotGfx = this.make.graphics({ add: false });
      // Brick wall background
      spotGfx.fillStyle(0x555566, 1);
      spotGfx.fillRect(0, 0, SW, SH);
      // Brick pattern
      const brickW = 14, brickH = 8, gap = 1;
      for (let row = 0; row < Math.ceil(SH / (brickH + gap)); row++) {
        const offsetX = (row % 2) * (brickW / 2 + gap);
        for (let col = -1; col < Math.ceil(SW / (brickW + gap)) + 1; col++) {
          const bx = col * (brickW + gap) + offsetX;
          const by = row * (brickH + gap);
          spotGfx.fillStyle(0x443344 + (((row * 7 + col * 3) % 5) * 0x050505), 1);
          spotGfx.fillRect(bx, by, brickW, brickH);
        }
      }
      // Colored dashed outline — paint target marking
      spotGfx.lineStyle(2, color, 0.9);
      spotGfx.strokeRect(4, 4, SW - 8, SH - 8);
      // Corner markers
      const cm = 8;
      spotGfx.fillStyle(color, 0.6);
      spotGfx.fillRect(2, 2, cm, 3);
      spotGfx.fillRect(2, 2, 3, cm);
      spotGfx.fillRect(SW - cm - 2, 2, cm, 3);
      spotGfx.fillRect(SW - 5, 2, 3, cm);
      spotGfx.fillRect(2, SH - 5, cm, 3);
      spotGfx.fillRect(2, SH - cm - 2, 3, cm);
      spotGfx.fillRect(SW - cm - 2, SH - 5, cm, 3);
      spotGfx.fillRect(SW - 5, SH - cm - 2, 3, cm);
      spotGfx.generateTexture(`paint_spot_${name.toLowerCase()}`, SW, SH);
      spotGfx.destroy();

      // PAINTED: wall covered in graffiti color with paint drips
      const paintedGfx = this.make.graphics({ add: false });
      // Base wall
      paintedGfx.fillStyle(0x555566, 1);
      paintedGfx.fillRect(0, 0, SW, SH);
      // Paint fill (main color)
      paintedGfx.fillStyle(color, 0.85);
      paintedGfx.fillRect(3, 3, SW - 6, SH - 6);
      // Paint drips
      paintedGfx.fillStyle(color, 0.7);
      paintedGfx.fillRect(10, SH - 6, 4, 6);
      paintedGfx.fillRect(30, SH - 6, 3, 6);
      paintedGfx.fillRect(50, SH - 6, 5, 6);
      // Highlight streaks
      paintedGfx.fillStyle(0xffffff, 0.25);
      paintedGfx.fillRect(8, 12, 20, 3);
      paintedGfx.fillRect(14, 30, 30, 3);
      paintedGfx.fillRect(6, 50, 16, 3);
      paintedGfx.fillRect(28, 60, 24, 3);
      paintedGfx.generateTexture(`paint_done_${name.toLowerCase()}`, SW, SH);
      paintedGfx.destroy();
    });

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

    // === Generate paint can textures from can.png base (all colors) ===
    this._generateAllPaintCanTextures();

    // === Register palette colors from painting JSONs ===
    this.registerPaintingPalettes();

    this.scene.start('MenuScene');
  }

  /**
   * Generate all paint can textures from green.png base.
   * Recolors the dome for each color in PAINT.COLORS.
   */
  _generateAllPaintCanTextures() {
    Object.entries(PAINT.COLORS).forEach(([name, colorHex]) => {
      const key = name.toLowerCase();
      // All textures at native can.png resolution (102x72) — scaled in-game
      this._recolorSprayCan(`paint_can_sprite_${key}`, colorHex);
      this._recolorSprayCan(`paint_can_${key}`, colorHex);
      this._recolorSprayCan(`hud_can_${key}`, colorHex);
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

        // All textures at native can.png resolution — scaled in-game
        this._recolorSprayCan(`paint_can_sprite_${name.toLowerCase()}`, colorHex);
        this._recolorSprayCan(`paint_can_${name.toLowerCase()}`, colorHex);
        this._recolorSprayCan(`hud_can_${name.toLowerCase()}`, colorHex);
      }
    }
  }

  /**
   * Recolor the grayscale body of can.png to a target color.
   * Body area (Y 38-85%): neutral pixels get colorized.
   * Dome, cap, bands and base stay untouched.
   * Output at native source resolution (102x72) for max quality.
   */
  _recolorSprayCan(textureKey, targetHex) {
    const srcTex = this.textures.get('spray_can_base');
    const srcImg = srcTex.getSourceImage();

    const canvas = document.createElement('canvas');
    canvas.width = srcImg.width;
    canvas.height = srcImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(srcImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    // Target color in RGB
    const tR = (targetHex >> 16) & 0xff;
    const tG = (targetHex >> 8) & 0xff;
    const tB = targetHex & 0xff;

    // Body band: skip dome/cap at top (~38%), stop before base (~85%)
    const bodyTop = Math.floor(h * 0.38);
    const bodyBottom = Math.floor(h * 0.85);

    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a < 10) continue;

      const pixelY = Math.floor((i / 4) / w);
      if (pixelY < bodyTop || pixelY > bodyBottom) continue;

      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = (r + g + b) / 3;
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

      // Colorize neutral pixels — skip dark edges/bands
      if (sat < 0.25 && lum > 60) {
        const factor = lum / 200;
        d[i]     = Math.min(255, Math.round(tR * factor));
        d[i + 1] = Math.min(255, Math.round(tG * factor));
        d[i + 2] = Math.min(255, Math.round(tB * factor));
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.textures.addCanvas(textureKey, canvas);
  }

}
