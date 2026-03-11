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
    { x: 80, y: H - 135, w: 60, h: 100 },
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
    { x: 510, y: L2_H - 170, w: 60, h: 140 },
    { x: 690, y: L2_H - 390, w: 50, h: 140 },
    { x: 30, y: L2_H - 640, w: 60, h: 140 },
    { x: 40, y: L2_H - 890, w: 60, h: 140 },
    { x: 730, y: L2_H - 890, w: 60, h: 140 },
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
    { x: 620, y: L2_H - 50 },
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

export const LEVELS = [LEVEL_1, LEVEL_2];
