import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

const TW = 2000;
const TH = 720;

export const LEVEL_TUTORIAL = {
  name: 'Tutorial',
  mode: 'tutorial',
  description: 'Naucz sie podstaw gry',
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
    { x: 1000, y: TH - 56 },
  ],
  cops: [
  ],
  lamps: [
    { x: 180, y: TH - 23, radius: 100, intensity: 0.5 },
    { x: 900, y: TH - 272, radius: 100, intensity: 0.5 },
    { x: 1800, y: TH - 23, radius: 120, intensity: 0.6 },
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
    { phase: 0, x: 200, y: TH - 100, desktop: 'Uzyj ← → by sie poruszac', mobile: 'Przeciagnij joystick w lewo/prawo' },
    { phase: 1, x: 550, y: TH - 200, desktop: 'Nacisnij ↑ lub SPACJE by skoczyc!', mobile: 'Nacisnij przycisk JUMP by skoczyc!' },
    { phase: 2, x: 950, y: TH - 340, desktop: 'Wejdz na drabine (↑↓) | E = przesun kosz', mobile: 'Joystick ↑↓ = drabina | przycisk E = kosz' },
    { phase: 3, x: 1400, y: TH - 360, desktop: 'Zbierz puszki z farba!', mobile: 'Zbierz puszki z farba!' },
    { phase: 4, x: 1800, y: TH - 460, desktop: 'Podejdz do muralu i nacisnij SPACJE!', mobile: 'Podejdz do muralu i nacisnij ACT!' },
  ],
  mapWidth: TW,
  mapHeight: TH,
};

export const LEVEL_1 = {
  name: 'Ulica',
  mode: 'stealth',
  description: 'Pomaluj dwa murale w miescie',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star', 'painting_Nowy'],

  platforms: [
    { x: 0, y: H - 156, w: 256 },
    { x: 620, y: H - 286, w: 250 },
    { x: 300, y: H - 286, w: 300 },
    { x: 50, y: H - 416, w: 300 },
    { x: 620, y: H - 420, w: 170 },
    { x: 940, y: H - 160, w: 100 },
    { x: 1090, y: H - 260, w: 100 },
    { x: 1090, y: H - 500, w: 100 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 224, topY: H - 142, bottomY: H - 32, minX: 54, maxX: 264 },
    { x: 820, topY: H - 270, bottomY: H - 32, minX: 630, maxX: 870 },
    { x: 340, topY: H - 415, bottomY: H - 285, minX: 310, maxX: 590 },
    { x: 500, topY: H - 270, bottomY: H - 32, minX: 310, maxX: 590 },
    { x: 1140, topY: H - 500, bottomY: H - 262, minX: 950, maxX: 1190 },
  ],
  shadows: [
    { x: 80, y: H - 130, w: 75, h: 100 },
    { x: 568, y: H - 135, w: 75, h: 100 },
  ],
  fillWalls: [
    { x: 0, y: H - 124, w: 256, h: 92 },
    { x: 300, y: H - 254, w: 570, h: 222 },
    { x: 620, y: H - 388, w: 170, h: 102 },
    { x: 1090, y: H - 620, w: 100, h: 120 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 400, y: H - 150, w: 140, h: 200, paintingKey: 'painting_heart' },
    { x: 720, y: H - 140, w: 140, h: 222, paintingKey: 'painting_star' },
    { x: 1140, y: H - 560, w: 80, h: 100, paintingKey: 'painting_Nowy' },
  ],
  trashCans: [
    { x: 310, y: H - 56 },
    { x: 902, y: H - 56 },
  ],
  cops: [
    { x: 400, y: H - 55, minX: 300, maxX: W - 40 },
  ],
  lamps: [
    { x: 1120, y: H - 23, radius: 120, intensity: 0.65 },
    { x: 80, y: H - 147, radius: 120, intensity: 0.65 },
  ],
  papers: [
    { x: 550, y: H - 25 },
    { x: 200, y: H - 150 },
  ],
  bottles: [
    { x: 380, y: H - 25 },
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
  name: 'Wiezowiec',
  mode: 'stealth',
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
    { x: 500, y: L2_H - 55, minX: 100, maxX: L2_W - 40 },
    { x: 300, y: L2_H - 520, minX: 100, maxX: 500 },
    { x: 450, y: L2_H - 770, minX: 250, maxX: 650 },
  ],
  lamps: [
    { x: 100, y: L2_H - 990, radius: 120, intensity: 0.7 },
    { x: 50, y: L2_H - 244, radius: 120 },
    { x: 710, y: L2_H - 30, radius: 120 },
    { x: 530, y: L2_H - 744, radius: 120 },
  ],
  papers: [
    { x: 144, y: L2_H - 24 },
    { x: 460, y: L2_H - 23 },
  ],
  bottles: [
    { x: 320, y: L2_H - 24 },
    { x: 700, y: L2_H - 24 },
    { x: 200, y: L2_H - 244 },
  ],
  cartons: [
    { x: 550, y: L2_H - 24 },
    { x: 80, y: L2_H - 244 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 380, x2: L2_W, y2: L2_H - 400 },
    { x1: 0, y1: L2_H - 880, x2: L2_W, y2: L2_H - 860 },
  ],
};

export const LEVEL_3 = {
  name: 'Lamiglowka',
  mode: 'puzzle',
  description: 'Uzyj drabin i koszy by dotrzec do murali',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: H - 160, w: 300 },
    { x: 500, y: H - 160, w: 300 },
    { x: 0, y: H - 380, w: 350 },
    { x: 550, y: H - 380, w: 350 },
    { x: 200, y: H - 600, w: 500 },
    { x: 950, y: H - 280, w: 200 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 140, topY: H - 160, bottomY: H - 32, minX: 10, maxX: 300 },
    { x: 1020, topY: H - 280, bottomY: H - 32, minX: 900, maxX: 1150 },
    { x: 740, topY: H - 160, bottomY: H - 32, minX: 370, maxX: 1160 },
    { x: 200, topY: H - 380, bottomY: H - 160, minX: 10, maxX: 900 },
    { x: 700, topY: H - 600, bottomY: H - 380, minX: 200, maxX: 900 },
  ],
  shadows: [
  ],
  fillWalls: [
    { x: 500, y: H - 128, w: 300, h: 96 },
    { x: -4, y: H - 350, w: 350, h: 320 },
    { x: 550, y: H - 348, w: 350, h: 188 },
    { x: 200, y: H - 568, w: 500, h: 188 },
    { x: 950, y: H - 248, w: 200, h: 216 },
  ],
  paintCans: [
  ],
  paintSpots: [
    { x: 620, y: H - 260, w: 120, h: 180, paintingKey: 'painting_heart' },
    { x: 270, y: H - 480, w: 120, h: 180, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 460, y: H - 50 },
    { x: 80, y: H - 185 },
    { x: 779, y: H - 187 },
  ],
  cops: [
  ],
  lamps: [
    { x: 380, y: H - 594, radius: 120 },
    { x: 1068, y: H - 274, radius: 120 },
    { x: 80, y: H - 374, radius: 120 },
  ],
  papers: [
    { x: 240, y: H - 32 },
    { x: 1100, y: H - 32 },
  ],
  bottles: [
    { x: 430, y: H - 32 },
    { x: 850, y: H - 32 },
  ],
  cartons: [
    { x: 600, y: H - 32 },
    { x: 160, y: H - 160 },
  ],
  foregroundWires: [
    { x1: 0, y1: H - 520, x2: W, y2: H - 540 },
  ],
};

const L4_W = 1280;
const L4_H = 1900;

export const LEVEL_4 = {
  name: 'Wieza',
  mode: 'tower',
  description: 'Wspinaj sie i maluj — czas ucieka!',
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
