import { GAME } from './gameConfig.js';

const H = GAME.HEIGHT;
const W = GAME.WIDTH;

/**
 * Level 1 — Original city level (two small murals)
 */
export const LEVEL_1 = {
  name: 'Ulica',
  description: 'Pomaluj dwa murale w mieście',
  worldWidth: W,
  worldHeight: H,
  checkpoint: { x: 60, y: H - 80 },
  paintings: ['painting_heart', 'painting_star'],

  platforms: [
    { x: 0, y: H - 156, w: 256 },
    { x: 300, y: H - 286, w: 300 },
    { x: 50, y: H - 416, w: 300 },
    { x: 600, y: H - 436, w: 170 },
  ],
  ground: [
    { x: 0, y: H - 32, w: W },
  ],
  ladders: [
    { x: 200, topY: H - 140, bottomY: H - 32, minX: 30, maxX: 240 },
    { x: 340, topY: H - 400, bottomY: H - 270, minX: 310, maxX: 590 },
    { x: 500, topY: H - 270, bottomY: H - 32, minX: 310, maxX: 590 },
  ],
  shadows: [
    { x: 80, y: H - 135, w: 60, h: 100 },
    { x: 540, y: H - 310, w: 50, h: 40 },
  ],
  paintCans: [
    { x: 120, y: H - 170, color: 'red' },
    { x: 250, y: H - 430, color: 'blue' },
    { x: 550, y: H - 300, color: 'yellow' },
    { x: 650, y: H - 450, color: 'green' },
  ],
  paintSpots: [
    { x: 450, y: H - 175, w: 140, h: 190, paintingKey: 'painting_heart' },
    { x: 700, y: H - 240, w: 140, h: 200, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 170, y: H - 32 - 18 },
    { x: 850, y: H - 32 - 18 },
  ],
  cops: [
    { x: 400, y: H - 55, minX: 300, maxX: W - 40 },
  ],
  foregroundWires: [
    { x1: 0, y1: H - 350, x2: W, y2: H - 380 },
  ],
};

/**
 * Level 2 — Tall mural level (one big painting split across platforms)
 * World is taller than the screen — vertical scrolling
 */
const L2_W = 800;
const L2_H = 2400;  // tall vertical level

export const LEVEL_2 = {
  name: 'Wieżowiec',
  description: 'Pokoloruj wielki mural na ścianie wieżowca',
  worldWidth: L2_W,
  worldHeight: L2_H,
  checkpoint: { x: 60, y: L2_H - 80 },
  paintings: ['painting_mural_big'],

  // Ground + platforms going upward
  ground: [
    { x: 0, y: L2_H - 32, w: L2_W },
  ],
  platforms: [
    // Floor 1
    { x: 0, y: L2_H - 200, w: 250 },
    { x: 400, y: L2_H - 200, w: 400 },
    // Floor 2
    { x: 0, y: L2_H - 450, w: 350 },
    { x: 500, y: L2_H - 450, w: 300 },
    // Floor 3
    { x: 100, y: L2_H - 700, w: 300 },
    { x: 500, y: L2_H - 700, w: 300 },
    // Floor 4
    { x: 0, y: L2_H - 950, w: 250 },
    { x: 400, y: L2_H - 950, w: 400 },
    // Floor 5
    { x: 50, y: L2_H - 1200, w: 300 },
    { x: 500, y: L2_H - 1200, w: 300 },
    // Floor 6
    { x: 0, y: L2_H - 1450, w: 350 },
    { x: 450, y: L2_H - 1450, w: 350 },
    // Floor 7
    { x: 100, y: L2_H - 1700, w: 250 },
    { x: 500, y: L2_H - 1700, w: 300 },
    // Floor 8 — top
    { x: 0, y: L2_H - 1950, w: L2_W },
  ],
  ladders: [
    // Ground → Floor 1
    { x: 350, topY: L2_H - 200, bottomY: L2_H - 32, minX: 280, maxX: 420 },
    // Floor 1 → Floor 2
    { x: 150, topY: L2_H - 450, bottomY: L2_H - 200, minX: 50, maxX: 380 },
    // Floor 2 → Floor 3
    { x: 600, topY: L2_H - 700, bottomY: L2_H - 450, minX: 450, maxX: 700 },
    // Floor 3 → Floor 4
    { x: 250, topY: L2_H - 950, bottomY: L2_H - 700, minX: 100, maxX: 420 },
    // Floor 4 → Floor 5
    { x: 650, topY: L2_H - 1200, bottomY: L2_H - 950, minX: 450, maxX: 750 },
    // Floor 5 → Floor 6
    { x: 200, topY: L2_H - 1450, bottomY: L2_H - 1200, minX: 50, maxX: 380 },
    // Floor 6 → Floor 7
    { x: 600, topY: L2_H - 1700, bottomY: L2_H - 1450, minX: 450, maxX: 700 },
    // Floor 7 → Floor 8
    { x: 300, topY: L2_H - 1950, bottomY: L2_H - 1700, minX: 100, maxX: 520 },
  ],
  shadows: [
    { x: 50, y: L2_H - 180, w: 60, h: 140 },
    { x: 600, y: L2_H - 430, w: 50, h: 140 },
    { x: 150, y: L2_H - 680, w: 60, h: 140 },
    { x: 650, y: L2_H - 930, w: 50, h: 140 },
    { x: 100, y: L2_H - 1180, w: 60, h: 140 },
    { x: 550, y: L2_H - 1430, w: 50, h: 140 },
    { x: 200, y: L2_H - 1680, w: 60, h: 140 },
  ],
  paintCans: [
    { x: 100, y: L2_H - 220, color: 'red' },
    { x: 650, y: L2_H - 470, color: 'blue' },
    { x: 200, y: L2_H - 720, color: 'yellow' },
    { x: 700, y: L2_H - 970, color: 'green' },
    { x: 150, y: L2_H - 1220, color: 'red' },
    { x: 600, y: L2_H - 1470, color: 'blue' },
    { x: 250, y: L2_H - 1720, color: 'yellow' },
    { x: 500, y: L2_H - 1970, color: 'green' },
  ],
  paintSpots: [
    // One big mural — placeholder, will be updated when image is provided
    { x: L2_W - 80, y: L2_H - 1000, w: 140, h: 1800, paintingKey: 'painting_mural_big' },
  ],
  trashCans: [
    { x: 500, y: L2_H - 32 - 18 },
    { x: 200, y: L2_H - 450 - 18 },
  ],
  cops: [
    { x: 500, y: L2_H - 55, minX: 100, maxX: L2_W - 40 },
    { x: 300, y: L2_H - 470, minX: 100, maxX: 500 },
    { x: 400, y: L2_H - 970, minX: 100, maxX: L2_W - 40 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 350, x2: L2_W, y2: L2_H - 380 },
    { x1: 0, y1: L2_H - 850, x2: L2_W, y2: L2_H - 820 },
    { x1: 0, y1: L2_H - 1350, x2: L2_W, y2: L2_H - 1380 },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2];
