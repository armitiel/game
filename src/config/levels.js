import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

// ============================================================
//  MODE: 'stealth' — cops, health, shadows, pressure
//  MODE: 'puzzle'  — no cops, pure ladder/trash/bridge puzzles
//  MODE: 'tower'   — vertical climb, color-gating, global timer
// ============================================================

// === STEALTH LEVELS ===

export const LEVEL_1 = {
  mode: 'stealth',
  name: 'Ulica',
  description: 'Pomaluj dwa murale w miescie',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: H - 156, w: 256 },
    { x: 620, y: H - 286, w: 250 },
    { x: 300, y: H - 286, w: 300 },
    { x: 50, y: H - 416, w: 300 },
    { x: 620, y: H - 420, w: 170 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 224, topY: H - 142, bottomY: H - 32, minX: 54, maxX: 264 },
    { x: 820, topY: H - 270, bottomY: H - 32, minX: 630, maxX: 870 },
    { x: 340, topY: H - 415, bottomY: H - 285, minX: 310, maxX: 590 },
    { x: 500, topY: H - 270, bottomY: H - 32, minX: 310, maxX: 590 },
  ],
  shadows: [
    { x: 80, y: H - 135, w: 66, h: 100 },
    { x: 568, y: H - 135, w: 60, h: 100 },
  ],
  paintCans: [
    { x: 120, y: H - 190 },
    { x: 250, y: H - 450 },
    { x: 550, y: H - 320 },
  ],
  paintSpots: [
    { x: 450, y: H - 140, w: 140, h: 222, paintingKey: 'painting_heart' },
    { x: 740, y: H - 140, w: 140, h: 222, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 270, y: H - 56 },
    { x: 902, y: H - 56 },
  ],
  cops: [
    { x: 400, y: H - 55, minX: 300, maxX: W - 40 },
  ],
  foregroundWires: [
    { x1: -10, y1: H - 520, x2: 1270, y2: H - 550 },
  ],
};

const L2_W = 800;
const L2_H = 1300;

export const LEVEL_2 = {
  mode: 'stealth',
  name: 'Wiezowiec',
  description: 'Pokoloruj wielki mural na scianie wiezowca',
  worldWidth: L2_W,
  worldHeight: L2_H,
  checkpoint: { x: 60, y: L2_H - 101 },
  paintings: ['painting_mural_big'],

  platforms: [
    { x: 0, y: L2_H - 250, w: 280 },
    { x: 420, y: L2_H - 250, w: 380 },
    { x: 0, y: L2_H - 500, w: 320 },
    { x: 480, y: L2_H - 500, w: 320 },
    { x: 0, y: L2_H - 750, w: 280 },
    { x: 420, y: L2_H - 750, w: 380 },
    { x: 0, y: L2_H - 1000, w: 800 },
  ],
  ground: [
    { x: 0, y: L2_H - 32, w: L2_W },
  ],
  ladders: [
    { x: 265, topY: L2_H - 250, bottomY: L2_H - 32, minX: 195, maxX: 335 },
    { x: 150, topY: L2_H - 500, bottomY: L2_H - 250, minX: 50, maxX: 380 },
    { x: 620, topY: L2_H - 750, bottomY: L2_H - 500, minX: 450, maxX: 720 },
    { x: 250, topY: L2_H - 1000, bottomY: L2_H - 750, minX: 80, maxX: 420 },
    { x: 120, topY: L2_H - 750, bottomY: L2_H - 500, minX: -50, maxX: 220 },
    { x: 700, topY: L2_H - 1000, bottomY: L2_H - 750, minX: 530, maxX: 870 },
    { x: 510, topY: L2_H - 500, bottomY: L2_H - 250, minX: 410, maxX: 740 },
  ],
  shadows: [
    { x: 510, y: L2_H - 170, w: 66, h: 140 },
    { x: 690, y: L2_H - 390, w: 66, h: 140 },
    { x: 30, y: L2_H - 640, w: 66, h: 140 },
    { x: 40, y: L2_H - 890, w: 66, h: 140 },
    { x: 730, y: L2_H - 890, w: 66, h: 140 },
  ],
  paintCans: [
    { x: 120, y: L2_H - 290 },
    { x: 650, y: L2_H - 540 },
    { x: 180, y: L2_H - 540 },
    { x: 600, y: L2_H - 790 },
    { x: 150, y: L2_H - 790 },
    { x: 400, y: L2_H - 1040 },
    { x: 70, y: L2_H - 1040 },
    { x: 760, y: L2_H - 1040 },
  ],
  paintSpots: [
    { x: 400, y: L2_H - 620, w: 480, h: 576, paintingKey: 'painting_mural_big' },
  ],
  trashCans: [
    { x: 620, y: L2_H - 55 },
    { x: 248, y: L2_H - 524 },
  ],
  cops: [
    { x: 500, y: L2_H - 55, minX: 100, maxX: L2_W - 40 },
    { x: 300, y: L2_H - 520, minX: 100, maxX: 500 },
    { x: 450, y: L2_H - 770, minX: 250, maxX: 650 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 380, x2: L2_W, y2: L2_H - 400 },
    { x1: 0, y1: L2_H - 880, x2: L2_W, y2: L2_H - 860 },
  ],
};

// === PUZZLE LEVEL ===
// No cops, no health. Pure spatial puzzle: arrange ladders, push trash,
// build bridges to reach 3 murals placed in tricky spots.
// Layout: wide map, 3 tiers. Murals require creative use of ladders.
//
//  DESIGN LOGIC:
//  - Mural 1 (heart): ground level but behind a GAP — need to push trash
//    to bridge the gap, then use ladder to reach the wall
//  - Mural 2 (star): mid platform, reachable only by knocking down a ladder
//    to create a bridge between two separated platforms, then climbing
//  - Mural 3 (pikachu): top level, need to drag a ladder across the bridge
//    from Mural 2, then climb up. Requires planning ahead.

const P1_W = 1400;
const P1_H = 900;

export const PUZZLE_1 = {
  mode: 'puzzle',
  name: 'Lamiglowka',
  description: 'Uzyj drabin i koszy by dotrzec do murali',
  worldWidth: P1_W,
  worldHeight: P1_H,
  checkpoint: { x: 60, y: P1_H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  // 3 tiers: ground, mid (350px up), top (600px up)
  platforms: [
    // Tier 1 — ground level platforms with a gap in the middle
    { x: 0,   y: P1_H - 160, w: 300 },     // left shelf
    { x: 500, y: P1_H - 160, w: 300 },     // right shelf (gap 200px between)
    // Tier 2 — mid level, two separated platforms (bridge puzzle)
    { x: 0,   y: P1_H - 380, w: 350 },     // left mid
    { x: 550, y: P1_H - 380, w: 350 },     // right mid (gap 200px)
    // Tier 3 — top, mural 3 here
    { x: 200, y: P1_H - 600, w: 500 },     // wide top platform
    // Small stepping stone for ladder access
    { x: 950, y: P1_H - 280, w: 200 },     // side platform (access to mid-right)
  ],
  ground: [
    { x: 0, y: P1_H - 32, w: P1_W },
  ],
  ladders: [
    // Ladder 1: ground → left shelf
    { x: 140, topY: P1_H - 160, bottomY: P1_H - 32, minX: 10, maxX: 300 },
    // Ladder 2: ground → side platform (access route to tier 2 right)
    { x: 1020, topY: P1_H - 280, bottomY: P1_H - 32, minX: 900, maxX: 1150 },
    // Ladder 3: on left shelf — can be pushed and knocked to bridge the gap to right shelf
    { x: 380, topY: P1_H - 160, bottomY: P1_H - 32, minX: 10, maxX: 800 },
    // Ladder 4: on left mid — pushable to bridge gap between mid platforms
    { x: 200, topY: P1_H - 380, bottomY: P1_H - 160, minX: 10, maxX: 900 },
    // Ladder 5: side platform → right mid
    { x: 1000, topY: P1_H - 380, bottomY: P1_H - 280, minX: 900, maxX: 1150 },
    // Ladder 6: right mid → top (the key ladder to drag across the bridge)
    { x: 700, topY: P1_H - 600, bottomY: P1_H - 380, minX: 200, maxX: 900 },
  ],
  shadows: [],     // no shadows needed — no cops
  paintCans: [
    // 3 colors scattered: player needs to collect before painting
    { x: 100, y: P1_H - 60 },        // ground level — easy pickup
    { x: 700, y: P1_H - 200 },       // on right shelf
    { x: 300, y: P1_H - 420 },       // on left mid platform
    { x: 450, y: P1_H - 640 },       // on top platform
  ],
  paintSpots: [
    // Mural 1: on the right shelf wall — need to bridge the gap first
    { x: 650, y: P1_H - 220, w: 120, h: 180, paintingKey: 'painting_heart' },
    // Mural 2: high on left mid wall — need ladder from below
    { x: 170, y: P1_H - 480, w: 120, h: 180, paintingKey: 'painting_star' },
  ],
  trashCans: [
    // Trash 1: push to fill the gap between ground platforms
    { x: 150, y: P1_H - 56 },
    // Trash 2: on left shelf, pushable for height
    { x: 80, y: P1_H - 185 },
    // Trash 3: on right mid, useful for reaching high spot
    { x: 750, y: P1_H - 405 },
  ],
  cops: [],          // NO cops in puzzle mode
  foregroundWires: [
    { x1: 0, y1: P1_H - 520, x2: P1_W, y2: P1_H - 540 },
  ],
};

// === TOWER LEVEL ===
// Vertical climb: 5 floors, each has a mural.
// Start with 3 colors (RED, BLUE, YELLOW). Each mural unlocked adds GREEN.
// Global countdown timer: 120s, each mural adds +30s bonus.
// Color gates block upward progress until you have the required color.
//
//  DESIGN LOGIC (bottom to top):
//  Floor 0 (ground): Starting area, collect RED + BLUE + YELLOW cans
//  Floor 1: Small heart mural (uses RED, BLUE) — reward: +30s
//  Floor 2: Star mural (uses RED, BLUE, YELLOW) — reward: +30s, unlock GREEN
//  Floor 3: COLOR GATE — needs GREEN to pass
//  Floor 4: Big mural (uses all 4 colors) — reward: +30s
//  Floor 5: FINISH — reach the top!

const TW_W = 700;
const TW_H = 2000;

export const TOWER_1 = {
  mode: 'tower',
  name: 'Wieza',
  description: 'Wspinaj sie i maluj — czas ucieka!',
  worldWidth: TW_W,
  worldHeight: TW_H,
  checkpoint: { x: 60, y: TW_H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  // Timer config for tower mode
  timer: {
    startSeconds: 120,        // initial time
    bonusPerMural: 30,        // seconds added per completed mural
    warningAt: 20,            // pulsing red warning at this many seconds
  },

  // Color unlocks: mural index → color unlocked after completing it
  colorUnlocks: [
    null,                     // mural 0 (heart): no new color
    'GREEN',                  // mural 1 (star): unlocks GREEN
  ],

  // Color gates: barriers that require a specific color to pass
  colorGates: [
    { x: 0, y: TW_H - 1150, w: TW_W, requiredColor: 'GREEN',
      message: 'Potrzebujesz ZIELONEJ farby!' },
  ],

  // 5 floors connected by ladders
  platforms: [
    // Floor 0 shelf
    { x: 0,   y: TW_H - 200, w: 300 },
    { x: 400, y: TW_H - 200, w: 300 },
    // Floor 1
    { x: 0,   y: TW_H - 450, w: 320 },
    { x: 380, y: TW_H - 450, w: 320 },
    // Floor 2
    { x: 0,   y: TW_H - 700, w: 280 },
    { x: 420, y: TW_H - 700, w: 280 },
    // Floor 3 (above gate)
    { x: 0,   y: TW_H - 1200, w: 350 },
    { x: 350, y: TW_H - 1200, w: 350 },
    // Floor 4 — wide top
    { x: 0,   y: TW_H - 1500, w: 700 },
    // FINISH platform
    { x: 150, y: TW_H - 1800, w: 400 },
  ],
  ground: [
    { x: 0, y: TW_H - 32, w: TW_W },
  ],
  ladders: [
    // Ground → Floor 0 shelf
    { x: 200, topY: TW_H - 200, bottomY: TW_H - 32,  minX: 50, maxX: 350 },
    // Floor 0 → Floor 1
    { x: 550, topY: TW_H - 450, bottomY: TW_H - 200, minX: 400, maxX: 650 },
    // Floor 1 → Floor 2
    { x: 150, topY: TW_H - 700, bottomY: TW_H - 450, minX: 50, maxX: 380 },
    // Floor 2 → Floor 3 (above gate — blocked until GREEN)
    { x: 550, topY: TW_H - 1200, bottomY: TW_H - 700, minX: 350, maxX: 700 },
    // Floor 3 → Floor 4
    { x: 200, topY: TW_H - 1500, bottomY: TW_H - 1200, minX: 50, maxX: 400 },
    // Floor 4 → Finish
    { x: 400, topY: TW_H - 1800, bottomY: TW_H - 1500, minX: 150, maxX: 550 },
  ],
  shadows: [],
  paintCans: [
    // Floor 0: starting colors
    { x: 100, y: TW_H - 60 },        // RED
    { x: 300, y: TW_H - 60 },        // BLUE
    { x: 500, y: TW_H - 60 },        // YELLOW
    // Floor 2: GREEN unlocked by completing mural 1
    { x: 350, y: TW_H - 740 },       // GREEN (placed after star mural area)
  ],
  paintSpots: [
    // Floor 1: heart mural (RED + BLUE)
    { x: 170, y: TW_H - 530, w: 140, h: 200, paintingKey: 'painting_heart' },
    // Floor 2: star mural (RED + BLUE + YELLOW) — completing this unlocks GREEN
    { x: 520, y: TW_H - 790, w: 140, h: 200, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 500, y: TW_H - 56 },
    { x: 100, y: TW_H - 475 },
  ],
  cops: [],
  foregroundWires: [
    { x1: 0, y1: TW_H - 350, x2: TW_W, y2: TW_H - 370 },
    { x1: 0, y1: TW_H - 900, x2: TW_W, y2: TW_H - 920 },
    { x1: 0, y1: TW_H - 1400, x2: TW_W, y2: TW_H - 1380 },
  ],
};

// === LEVEL GROUPS BY MODE ===
export const STEALTH_LEVELS = [LEVEL_1, LEVEL_2];
export const PUZZLE_LEVELS  = [PUZZLE_1];
export const TOWER_LEVELS   = [TOWER_1];

// All levels flat list (for backward compat)
export const LEVELS = [...STEALTH_LEVELS, ...PUZZLE_LEVELS, ...TOWER_LEVELS];
