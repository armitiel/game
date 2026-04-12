import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

const TW = 1800;
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
    { x: 445, y: TH - 80, w: 70 },
    { x: 1050, y: TH - 280, w: 350 },
    { x: 1450, y: TH - 280, w: 300 },
  ],
  ground: [
    { x: 0, y: TH - 32, w: 420 },
    { x: 540, y: TH - 32, w: 300 },
    { x: 940, y: TH - 32, w: 860 },
  ],
  ladders: [
    { x: 1000, topY: TH - 280, bottomY: TH - 32, minX: 900, maxX: 1100 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 1050, y: TH - 440, w: 700, h: 408 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 1600, y: TH - 355, w: 120, h: 120, paintingKey: 'painting_heart' },
  ],
  trashCans: [
  ],
  cops: [
  ],
  lamps: [
    { x: 200, y: TH - 23, radius: 100, intensity: 0.5 },
    { x: 700, y: TH - 23, radius: 100, intensity: 0.5 },
    { x: 1300, y: TH - 274, radius: 120, intensity: 0.6 },
  ],
  papers: [
    { x: 150, y: TH - 25 },
  ],
  bottles: [
    { x: 350, y: TH - 25 },
  ],
  cartons: [
    { x: 650, y: TH - 25 },
  ],
  foregroundWires: [
    { x1: -10, y1: TH - 520, x2: 1810, y2: TH - 550 },
  ],
  tutorialGates: [
    { x: 400, phase: 1 },
    { x: 900, phase: 2 },
    { x: 1400, phase: 3 },
    { x: 1430, phase: 4 },
  ],
  tutorialHints: [
    { phase: 0, x: 200, y: TH - 100, desktop: 'tutHintMove', mobile: 'tutHintMoveMobile' },
    { phase: 1, x: 470, y: TH - 140, desktop: 'tutHintJump', mobile: 'tutHintJumpMobile' },
    { phase: 2, x: 980, y: TH - 120, desktop: 'tutHintLadder', mobile: 'tutHintLadderMobile' },
    { phase: 3, x: 1250, y: TH - 340, desktop: 'tutHintCollect', mobile: 'tutHintCollect' },
    { phase: 4, x: 1600, y: TH - 520, desktop: 'tutHintPaint', mobile: 'tutHintPaintMobile' },
  ],
  mapWidth: TW,
  mapHeight: TH,
};

export const LEVEL_1 = {
  name: 'lvlDarkAlley',
  mode: 'stealth',
  description: 'lvlDarkAlleyDesc',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_flower', 'painting_fish'],

  platforms: [
    { x: 600, y: H - 280, w: 500 },
    { x: 0, y: H - 230, w: 150 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 80, topY: H - 230, bottomY: H - 32, minX: 0, maxX: 160 },
    { x: 1050, topY: H - 280, bottomY: H - 32, minX: 950, maxX: 1150 },
  ],
  shadows: [
    { x: 20, y: H - 130, w: 80, h: 100 },
    { x: 910, y: H - 130, w: 80, h: 100 },
  ],
  fillWalls: [
    { x: 600, y: H - 440, w: 500, h: 408 },
    { x: 0, y: H - 198, w: 150, h: 166 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 350, y: H - 107, w: 140, h: 120, paintingKey: 'painting_flower' },
    { x: 800, y: H - 350, w: 130, h: 120, paintingKey: 'painting_fish' },
  ],
  trashCans: [
    { x: 800, y: H - 53 },
  ],
  cops: [
    { x: 600, y: H - 100, minX: 180, maxX: 1220 },
  ],
  lamps: [
    { x: 100, y: H - 23, radius: 100, intensity: 0.5 },
    { x: 980, y: H - 274, radius: 130, intensity: 0.6 },
    { x: 1150, y: H - 25, radius: 100, intensity: 0.5 },
  ],
  papers: [
    { x: 300, y: H - 25 },
    { x: 900, y: H - 274 },
  ],
  bottles: [
    { x: 1050, y: H - 30 },
  ],
  cartons: [
    { x: 200, y: H - 25 },
  ],
  foregroundWires: [
    { x1: -10, y1: H - 480, x2: 1290, y2: H - 510 },
  ],
};

const L2_W = 900;
const L2_H = 1400;

export const LEVEL_2 = {
  name: 'lvlStairwell',
  mode: 'stealth',
  description: 'lvlStairwellDesc',
  worldWidth: L2_W,
  worldHeight: L2_H,
  checkpoint: { x: 60, y: L2_H - 101 },
  paintings: ['painting_butterfly'],

  platforms: [
    { x: 0, y: L2_H - 290, w: 900 },
    { x: 0, y: L2_H - 550, w: 900 },
    { x: 0, y: L2_H - 810, w: 900 },
    { x: 0, y: L2_H - 1070, w: 900 },
  ],
  ground: [
    { x: 0, y: L2_H - 32, w: L2_W },
  ],
  ladders: [
    { x: 750, topY: L2_H - 290, bottomY: L2_H - 32, minX: 650, maxX: 850 },
    { x: 150, topY: L2_H - 550, bottomY: L2_H - 290, minX: 50, maxX: 250 },
    { x: 750, topY: L2_H - 810, bottomY: L2_H - 550, minX: 650, maxX: 850 },
    { x: 450, topY: L2_H - 1070, bottomY: L2_H - 810, minX: 350, maxX: 550 },
  ],
  shadows: [
    { x: 30, y: L2_H - 130, w: 70, h: 100 },
    { x: 650, y: L2_H - 390, w: 70, h: 100 },
    { x: 30, y: L2_H - 650, w: 70, h: 100 },
    { x: 800, y: L2_H - 910, w: 70, h: 100 },
  ],
  fillWalls: [
    { x: 0, y: L2_H - 1220, w: 900, h: 1188 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 450, y: L2_H - 1145, w: 160, h: 120, paintingKey: 'painting_butterfly' },
  ],
  trashCans: [
    { x: 400, y: L2_H - 55 },
    { x: 600, y: L2_H - 570 },
  ],
  cops: [
    { x: 400, y: L2_H - 360, minX: 50, maxX: 700 },
    { x: 500, y: L2_H - 620, minX: 200, maxX: 840 },
    { x: 400, y: L2_H - 880, minX: 50, maxX: 840 },
  ],
  lamps: [
    { x: 630, y: L2_H - 25, radius: 120 },
    { x: 800, y: L2_H - 284, radius: 100 },
    { x: 220, y: L2_H - 543, radius: 100 },
    { x: 700, y: L2_H - 1064, radius: 130, intensity: 0.7 },
  ],
  papers: [
    { x: 500, y: L2_H - 23 },
  ],
  bottles: [
    { x: 800, y: L2_H - 24 },
    { x: 350, y: L2_H - 544 },
  ],
  cartons: [
    { x: 200, y: L2_H - 284 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 420, x2: L2_W, y2: L2_H - 440 },
    { x1: 0, y1: L2_H - 940, x2: L2_W, y2: L2_H - 920 },
  ],
};

export const LEVEL_3 = {
  name: 'lvlYard',
  mode: 'puzzle',
  description: 'lvlYardDesc',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_moon', 'painting_tree'],

  platforms: [
    { x: 0, y: H - 150, w: 200 },
    { x: 850, y: H - 330, w: 300 },
  ],
  ground: [
    { x: 0, y: H - 32, w: 450 },
    { x: 650, y: H - 32, w: 630 },
  ],
  ladders: [
    { x: 50, topY: H - 150, bottomY: H - 32, minX: 0, maxX: 130 },
    { x: 1050, topY: H - 330, bottomY: H - 32, minX: 950, maxX: 1150 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 0, y: H - 290, w: 200, h: 258 },
    { x: 850, y: H - 480, w: 300, h: 448 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 100, y: H - 220, w: 120, h: 110, paintingKey: 'painting_moon' },
    { x: 1000, y: H - 405, w: 130, h: 120, paintingKey: 'painting_tree' },
  ],
  trashCans: [
    { x: 300, y: H - 53 },
    { x: 350, y: H - 53 },
    { x: 800, y: H - 53 },
  ],
  cops: [
  ],
  lamps: [
    { x: 200, y: H - 23, radius: 100, intensity: 0.5 },
    { x: 900, y: H - 23, radius: 130, intensity: 0.5 },
  ],
  papers: [
    { x: 150, y: H - 25 },
  ],
  bottles: [
    { x: 750, y: H - 30 },
  ],
  cartons: [
    { x: 400, y: H - 25 },
  ],
  foregroundWires: [
    { x1: -10, y1: H - 500, x2: 1290, y2: H - 480 },
  ],
};

const L4_W = 900;
const L4_H = 1800;

export const LEVEL_4 = {
  name: 'lvlClockTower',
  mode: 'tower',
  description: 'lvlClockTowerDesc',
  worldWidth: L4_W,
  worldHeight: L4_H,
  checkpoint: { x: 60, y: L4_H - 101 },
  paintings: ['painting_star', 'painting_cat'],

  platforms: [
    { x: 0, y: L4_H - 280, w: 900 },
    { x: 0, y: L4_H - 530, w: 900 },
    { x: 0, y: L4_H - 830, w: 900 },
    { x: 0, y: L4_H - 1080, w: 900 },
    { x: 0, y: L4_H - 1330, w: 900 },
    { x: 0, y: L4_H - 1580, w: 900 },
  ],
  ground: [
    { x: 0, y: L4_H - 32, w: L4_W },
  ],
  ladders: [
    { x: 200, topY: L4_H - 280, bottomY: L4_H - 32, minX: 100, maxX: 300 },
    { x: 700, topY: L4_H - 530, bottomY: L4_H - 280, minX: 600, maxX: 800 },
    { x: 200, topY: L4_H - 830, bottomY: L4_H - 530, minX: 100, maxX: 300 },
    { x: 700, topY: L4_H - 1080, bottomY: L4_H - 830, minX: 600, maxX: 800 },
    { x: 200, topY: L4_H - 1330, bottomY: L4_H - 1080, minX: 100, maxX: 300 },
    { x: 700, topY: L4_H - 1580, bottomY: L4_H - 1330, minX: 600, maxX: 800 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 0, y: L4_H - 1548, w: 900, h: 1516 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 450, y: L4_H - 605, w: 150, h: 120, paintingKey: 'painting_star' },
    { x: 450, y: L4_H - 1155, w: 150, h: 120, paintingKey: 'painting_cat' },
  ],
  trashCans: [
    { x: 750, y: L4_H - 55 },
  ],
  cops: [
  ],
  bottles: [
    { x: 600, y: L4_H - 27 },
    { x: 400, y: L4_H - 524 },
  ],
  cartons: [
    { x: 100, y: L4_H - 27 },
    { x: 800, y: L4_H - 274 },
  ],
  foregroundWires: [
    { x1: 0, y1: L4_H - 400, x2: L4_W, y2: L4_H - 420 },
    { x1: 0, y1: L4_H - 950, x2: L4_W, y2: L4_H - 930 },
    { x1: 0, y1: L4_H - 1450, x2: L4_W, y2: L4_H - 1430 },
  ],
};

export const LEVELS = [LEVEL_TUTORIAL, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

export const STEALTH_LEVELS = [LEVEL_1, LEVEL_2];
export const PUZZLE_LEVELS = [LEVEL_3];
export const TOWER_LEVELS = [LEVEL_4];
