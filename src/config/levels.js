import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

const TW = 2000;
const TH = 720;

export const LEVEL_TUTORIAL = {
  name: 'lvlTutorial',
  mode: 'tutorial',
  description: 'lvlTutorialDesc',
  worldWidth: TW,
  worldHeight: TH,
  checkpoint: { x: 60, y: TH - 101 },
  paintings: ['painting_heart'],

  platforms: [
    { x: 480, y: TH - 160, w: 120 },
    { x: 650, y: TH - 160, w: 100 },
    { x: 850, y: TH - 280, w: 200 },
    { x: 1050, y: TH - 180, w: 150 },
    { x: 1300, y: TH - 180, w: 200 },
    { x: 1450, y: TH - 300, w: 150 },
    { x: 1750, y: TH - 200, w: 200 },
  ],
  ground: [
    { x: 0, y: TH - 32, w: 570 },
    { x: 630, y: TH - 32, w: 1370 },
  ],
  ladders: [
    { x: 900, topY: TH - 280, bottomY: TH - 32, minX: 760, maxX: 1050 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 850, y: TH - 248, w: 200, h: 216 },
    { x: 1700, y: TH - 400, w: 250, h: 368 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 1820, y: TH - 260, w: 120, h: 180, paintingKey: 'painting_heart' },
  ],
  trashCans: [
    { x: 1900, y: TH - 210 },
  ],
  cops: [
  ],
  lamps: [
    { x: 180, y: TH - 23, radius: 100, intensity: 0.5 },
    { x: 1250, y: TH - 30, radius: 100, intensity: 0.5 },
    { x: 1530, y: TH - 294, radius: 120, intensity: 0.6 },
  ],
  papers: [
    { x: 150, y: TH - 25 },
  ],
  bottles: [
    { x: 300, y: TH - 25 },
  ],
  cartons: [
    { x: 780, y: TH - 25 },
  ],
  foregroundWires: [
    { x1: -10, y1: TH - 520, x2: 2010, y2: TH - 550 },
  ],
  tutorialGates: [
    { x: 400, phase: 1 },
    { x: 750, phase: 2 },
    { x: 1200, phase: 3 },
    { x: 1600, phase: 4 },
  ],
  tutorialHints: [
    { phase: 0, x: 200, y: TH - 100, desktop: 'tutHintMove', mobile: 'tutHintMoveMobile' },
    { phase: 1, x: 550, y: TH - 200, desktop: 'tutHintJump', mobile: 'tutHintJumpMobile' },
    { phase: 2, x: 950, y: TH - 340, desktop: 'tutHintLadder', mobile: 'tutHintLadderMobile' },
    { phase: 3, x: 1400, y: TH - 360, desktop: 'tutHintCollect', mobile: 'tutHintCollect' },
    { phase: 4, x: 1800, y: TH - 460, desktop: 'tutHintPaint', mobile: 'tutHintPaintMobile' },
  ],
  mapWidth: TW,
  mapHeight: TH,
};

export const LEVEL_1 = {
  name: 'lvlStreet',
  mode: 'stealth',
  description: 'lvlStreetDesc',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star', 'painting_Nowy'],

  platforms: [
    { x: 0, y: H - 156, w: 256 },
    { x: 300, y: H - 290, w: 573 },
    { x: 50, y: H - 416, w: 300 },
    { x: 620, y: H - 420, w: 170 },
    { x: 940, y: H - 160, w: 100 },
    { x: 1090, y: H - 260, w: 100 },
    { x: 1040, y: H - 500, w: 150 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 220, topY: H - 140, bottomY: H - 30, minX: 50, maxX: 260 },
    { x: 830, topY: H - 270, bottomY: H - 32, minX: 640, maxX: 920 },
    { x: 1140, topY: H - 500, bottomY: H - 262, minX: 950, maxX: 1190 },
    { x: 330, topY: H - 404, bottomY: H - 290, minX: 120, maxX: 380 },
  ],
  shadows: [
    { x: 80, y: H - 130, w: 75, h: 100 },
    { x: 710, y: H - 132, w: 75, h: 100 },
  ],
  fillWalls: [
    { x: 0, y: H - 124, w: 256, h: 92 },
    { x: 300, y: H - 260, w: 570, h: 230, depth: 0 },
    { x: 620, y: H - 388, w: 170, h: 102 },
    { x: 1090, y: H - 620, w: 100, h: 120 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 440, y: H - 140, w: 250, h: 210, paintingKey: 'painting_star' },
    { x: 1140, y: H - 560, w: 95, h: 110, paintingKey: 'painting_Nowy' },
  ],
  trashCans: [
    { x: 350, y: H - 53 },
    { x: 1060, y: H - 522 },
  ],
  cops: [
    { x: 400, y: H - 100, minX: 300, maxX: W - 40 },
  ],
  lamps: [
    { x: 1150, y: H - 25, radius: 120, intensity: 0.65 },
    { x: 80, y: H - 150, radius: 120, intensity: 0.65 },
  ],
  papers: [
    { x: 1060, y: H - 24 },
    { x: 200, y: H - 150 },
  ],
  bottles: [
    { x: 690, y: H - 30 },
  ],
  cartons: [
    { x: 976, y: H - 153 },
    { x: 100, y: H - 411 },
  ],
  foregroundWires: [
    { x1: -10, y1: H - 520, x2: 1270, y2: H - 550 },
  ],
};

const L2_W = 800;
const L2_H = 1300;

export const LEVEL_2 = {
  name: 'lvlSkyscraper',
  mode: 'stealth',
  description: 'lvlSkyscraperDesc',
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
    { x: 30, y: L2_H - 850, w: 66, h: 100 },
    { x: 730, y: L2_H - 850, w: 66, h: 100 },
    { x: 20, y: L2_H - 600, w: 66, h: 100 },
    { x: 630, y: L2_H - 350, w: 66, h: 100 },
    { x: 530, y: L2_H - 130, w: 66, h: 100 },
  ],
  fillWalls: [
    { x: 0, y: L2_H - 970, w: 800, h: 940 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 390, y: L2_H - 540, w: 480, h: 576, paintingKey: 'painting_mural_big' },
  ],
  trashCans: [
    { x: 620, y: L2_H - 55 },
    { x: 248, y: L2_H - 524 },
  ],
  cops: [
    { x: 500, y: L2_H - 200, minX: 100, maxX: L2_W - 40 },
    { x: 300, y: L2_H - 650, minX: 100, maxX: 500 },
    { x: 460, y: L2_H - 900, minX: 260, maxX: 660 },
  ],
  lamps: [
    { x: 100, y: L2_H - 990, radius: 120, intensity: 0.7 },
    { x: 50, y: L2_H - 244, radius: 120 },
    { x: 710, y: L2_H - 30, radius: 120 },
    { x: 710, y: L2_H - 500, radius: 120 },
  ],
  papers: [
    { x: 460, y: L2_H - 23 },
  ],
  bottles: [
    { x: 700, y: L2_H - 24 },
    { x: 710, y: L2_H - 500 },
  ],
  cartons: [
    { x: 80, y: L2_H - 244 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 380, x2: L2_W, y2: L2_H - 400 },
    { x1: 0, y1: L2_H - 880, x2: L2_W, y2: L2_H - 860 },
  ],
};

export const LEVEL_3 = {
  name: 'lvlPuzzle',
  mode: 'puzzle',
  description: 'lvlPuzzleDesc',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: H - 200, w: 250 },
    { x: 690, y: H - 200, w: 200 },
    { x: 1020, y: H - 290, w: 220 },
    { x: 100, y: H - 380, w: 180 },
    { x: 420, y: H - 380, w: 220 },
    { x: 1020, y: H - 490, w: 220 },
    { x: 920, y: H - 570, w: 70 },
    { x: 790, y: H - 640, w: 60 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 130, topY: H - 210, bottomY: H - 42, minX: 30, maxX: 280 },
    { x: 720, topY: H - 180, bottomY: H - 32, minX: 640, maxX: 840 },
    { x: 180, topY: H - 380, bottomY: H - 200, minX: 0, maxX: 280 },
    { x: 250, topY: H - 560, bottomY: H - 380, minX: 70, maxX: 350 },
  ],
  shadows: [
    { x: 30, y: H - 130, w: 80, h: 100 },
    { x: 1050, y: H - 130, w: 70, h: 100 },
  ],
  fillWalls: [
    { x: 0, y: H - 168, w: 250, h: 136 },
    { x: 690, y: H - 170, w: 200, h: 150 },
    { x: 1020, y: H - 258, w: 220, h: 226 },
    { x: 100, y: H - 550, w: 180, h: 900 },
    { x: 420, y: H - 550, w: 220, h: 800 },
    { x: 1020, y: H - 480, w: 220, h: 200 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 540, y: H - 470, w: 120, h: 150, paintingKey: 'painting_heart' },
    { x: 1100, y: H - 390, w: 120, h: 150, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 30, y: H - 220 },
    { x: 870, y: H - 210 },
    { x: 550, y: H - 56 },
    { x: 160, y: H - 404 },
  ],
  cops: [
  ],
  lamps: [
    { x: 65, y: H - 194, radius: 100 },
    { x: 600, y: H - 23, radius: 130, intensity: 0.5 },
    { x: 950, y: H - 24, radius: 110 },
  ],
  papers: [
    { x: 350, y: H - 25 },
  ],
  bottles: [
    { x: 970, y: H - 30 },
    { x: 1200, y: H - 490 },
  ],
  cartons: [
    { x: 480, y: H - 25 },
  ],
  foregroundWires: [
    { x1: 0, y1: H - 500, x2: W, y2: H - 520 },
  ],
};

const L4_W = 1280;
const L4_H = 1900;

export const LEVEL_4 = {
  name: 'lvlTower',
  mode: 'tower',
  description: 'lvlTowerDesc',
  worldWidth: L4_W,
  worldHeight: L4_H,
  checkpoint: { x: 60, y: L4_H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: L4_H - 200, w: 300 },
    { x: 400, y: L4_H - 200, w: 300 },
    { x: 0, y: L4_H - 450, w: 320 },
    { x: 380, y: L4_H - 450, w: 320 },
    { x: 0, y: L4_H - 700, w: 280 },
    { x: 420, y: L4_H - 700, w: 280 },
    { x: 0, y: L4_H - 1200, w: 350 },
    { x: 350, y: L4_H - 1200, w: 350 },
    { x: 0, y: L4_H - 1500, w: 700 },
    { x: 150, y: L4_H - 1800, w: 400 },
  ],
  ground: [
    { x: 0, y: L4_H - 32, w: L4_W },
  ],
  ladders: [
    { x: 200, topY: L4_H - 200, bottomY: L4_H - 32, minX: 50, maxX: 350 },
    { x: 550, topY: L4_H - 450, bottomY: L4_H - 200, minX: 400, maxX: 650 },
    { x: 150, topY: L4_H - 700, bottomY: L4_H - 450, minX: 50, maxX: 380 },
    { x: 550, topY: L4_H - 1200, bottomY: L4_H - 700, minX: 350, maxX: 700 },
    { x: 200, topY: L4_H - 1500, bottomY: L4_H - 1200, minX: 50, maxX: 400 },
    { x: 400, topY: L4_H - 1800, bottomY: L4_H - 1500, minX: 150, maxX: 550 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 0, y: L4_H - 168, w: 300, h: 136 },
    { x: 400, y: L4_H - 168, w: 300, h: 136 },
    { x: 0, y: L4_H - 418, w: 320, h: 218 },
    { x: 380, y: L4_H - 418, w: 320, h: 218 },
    { x: 0, y: L4_H - 668, w: 280, h: 218 },
    { x: 420, y: L4_H - 668, w: 280, h: 218 },
    { x: 0, y: L4_H - 1168, w: 350, h: 468 },
    { x: 350, y: L4_H - 1168, w: 350, h: 468 },
    { x: 0, y: L4_H - 1468, w: 700, h: 268 },
    { x: 150, y: L4_H - 1768, w: 400, h: 268 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 170, y: L4_H - 530, w: 140, h: 200, paintingKey: 'painting_heart' },
    { x: 520, y: L4_H - 790, w: 140, h: 200, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 500, y: L4_H - 45 },
    { x: 42, y: L4_H - 460 },
  ],
  cops: [
  ],
  bottles: [
    { x: 470, y: L4_H - 444 },
    { x: 600, y: L4_H - 27 },
  ],
  cartons: [
    { x: 720, y: L4_H - 30 },
    { x: 500, y: L4_H - 195 },
  ],
  foregroundWires: [
    { x1: 0, y1: L4_H - 350, x2: L4_W, y2: L4_H - 370 },
    { x1: 0, y1: L4_H - 900, x2: L4_W, y2: L4_H - 920 },
    { x1: 0, y1: L4_H - 1400, x2: L4_W, y2: L4_H - 1380 },
  ],
};

export const LEVELS = [LEVEL_TUTORIAL, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

export const STEALTH_LEVELS = [LEVEL_1, LEVEL_2];
export const PUZZLE_LEVELS = [LEVEL_3];
export const TOWER_LEVELS = [LEVEL_4];
