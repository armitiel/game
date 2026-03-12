import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

export const LEVEL_1 = {
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
    { x: 80, y: H - 135, w: 75, h: 100 },
    { x: 568, y: H - 135, w: 75, h: 100 },
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
    { x: 310, y: H - 56 },
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

export const LEVEL_3 = {
  name: 'Lamiglowka',
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
    { x: 380, topY: H - 160, bottomY: H - 32, minX: 10, maxX: 800 },
    { x: 200, topY: H - 380, bottomY: H - 160, minX: 10, maxX: 900 },
    { x: 1000, topY: H - 380, bottomY: H - 280, minX: 900, maxX: 1150 },
    { x: 700, topY: H - 600, bottomY: H - 380, minX: 200, maxX: 900 },
  ],
  shadows: [
  ],
  paintCans: [
    { x: 100, y: H - 60 },
    { x: 700, y: H - 200 },
    { x: 300, y: H - 420 },
    { x: 450, y: H - 640 },
  ],
  paintSpots: [
    { x: 650, y: H - 220, w: 120, h: 180, paintingKey: 'painting_heart' },
    { x: 170, y: H - 480, w: 120, h: 180, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 150, y: H - 56 },
    { x: 80, y: H - 185 },
    { x: 750, y: H - 405 },
  ],
  cops: [
  ],
  foregroundWires: [
    { x1: 0, y1: H - 520, x2: W, y2: H - 540 },
  ],
};

export const LEVEL_4 = {
  name: 'Wieza',
  description: 'Wspinaj sie i maluj — czas ucieka!',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: H - 200, w: 300 },
    { x: 400, y: H - 200, w: 300 },
    { x: 0, y: H - 450, w: 320 },
    { x: 380, y: H - 450, w: 320 },
    { x: 0, y: H - 700, w: 280 },
    { x: 420, y: H - 700, w: 280 },
    { x: 0, y: H - 1200, w: 350 },
    { x: 350, y: H - 1200, w: 350 },
    { x: 0, y: H - 1500, w: 700 },
    { x: 150, y: H - 1800, w: 400 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 200, topY: H - 200, bottomY: H - 32, minX: 50, maxX: 350 },
    { x: 550, topY: H - 450, bottomY: H - 200, minX: 400, maxX: 650 },
    { x: 150, topY: H - 700, bottomY: H - 450, minX: 50, maxX: 380 },
    { x: 550, topY: H - 1200, bottomY: H - 700, minX: 350, maxX: 700 },
    { x: 200, topY: H - 1500, bottomY: H - 1200, minX: 50, maxX: 400 },
    { x: 400, topY: H - 1800, bottomY: H - 1500, minX: 150, maxX: 550 },
  ],
  shadows: [
  ],
  paintCans: [
    { x: 100, y: H - 60 },
    { x: 300, y: H - 60 },
    { x: 500, y: H - 60 },
    { x: 350, y: H - 740 },
  ],
  paintSpots: [
    { x: 170, y: H - 530, w: 140, h: 200, paintingKey: 'painting_heart' },
    { x: 520, y: H - 790, w: 140, h: 200, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 500, y: H - 56 },
    { x: 100, y: H - 475 },
  ],
  cops: [
  ],
  foregroundWires: [
    { x1: 0, y1: H - 350, x2: W, y2: H - 370 },
    { x1: 0, y1: H - 900, x2: W, y2: H - 920 },
    { x1: 0, y1: H - 1400, x2: W, y2: H - 1380 },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];
