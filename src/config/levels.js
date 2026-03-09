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
  checkpoint: { x: 60, y: H - 101 },
  paintings: ['painting_heart', 'painting_star'],
  // colors auto-derived from paintings

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
    { x: 720, y: H - 135, w: 60, h: 100 },
  ],
  paintCans: [
    { x: 120, y: H - 170 },
    { x: 250, y: H - 430 },
    { x: 550, y: H - 300 },
  ],
  paintSpots: [
    { x: 450, y: H - 175, w: 140, h: 190, paintingKey: 'painting_heart' },
    { x: 700, y: H - 240, w: 140, h: 200, paintingKey: 'painting_star' },
  ],
  trashCans: [
    { x: 170, y: H - 32 - 24 },
    { x: 850, y: H - 32 - 24 },
  ],
  cops: [
    { x: 400, y: H - 55, minX: 300, maxX: W - 40 },
  ],
  foregroundWires: [
    { x1: 0, y1: H - 350, x2: W, y2: H - 380 },
  ],
};

/**
 * Level 2 — Mural level (compact, focused around the big painting)
 * World is taller than the screen — vertical scrolling
 */
const L2_W = 800;
const L2_H = 1300;  // compact vertical level

export const LEVEL_2 = {
  name: 'Wieżowiec',
  description: 'Pokoloruj wielki mural na ścianie wieżowca',
  worldWidth: L2_W,
  worldHeight: L2_H,
  checkpoint: { x: 60, y: L2_H - 101 },
  paintings: ['painting_mural_big'],

  ground: [
    { x: 0, y: L2_H - 32, w: L2_W },
  ],
  platforms: [
    // Floor 1 — lower scaffolding
    { x: 0,   y: L2_H - 250, w: 280 },
    { x: 420, y: L2_H - 250, w: 380 },
    // Floor 2 — mid scaffolding
    { x: 0,   y: L2_H - 500, w: 320 },
    { x: 480, y: L2_H - 500, w: 320 },
    // Floor 3 — upper scaffolding
    { x: 0,   y: L2_H - 750, w: 280 },
    { x: 420, y: L2_H - 750, w: 380 },
    // Top — roof
    { x: 0, y: L2_H - 1000, w: L2_W },
  ],
  ladders: [
    // Ground → Floor 1
    { x: 350, topY: L2_H - 250, bottomY: L2_H - 32,  minX: 280, maxX: 420 },
    // Floor 1 → Floor 2
    { x: 150, topY: L2_H - 500, bottomY: L2_H - 250, minX: 50,  maxX: 380 },
    // Floor 2 → Floor 3
    { x: 620, topY: L2_H - 750, bottomY: L2_H - 500, minX: 450, maxX: 720 },
    // Floor 3 → Top
    { x: 250, topY: L2_H - 1000, bottomY: L2_H - 750, minX: 80, maxX: 420 },
  ],
  shadows: [
    { x: 50,  y: L2_H - 220, w: 60, h: 140 },
    { x: 620, y: L2_H - 480, w: 50, h: 140 },
    { x: 100, y: L2_H - 730, w: 60, h: 140 },
  ],
  paintCans: [
    { x: 120, y: L2_H - 270 },
    { x: 650, y: L2_H - 520 },
    { x: 180, y: L2_H - 520 },
    { x: 600, y: L2_H - 770 },
    { x: 150, y: L2_H - 770 },
    { x: 400, y: L2_H - 1020 },
  ],
  paintSpots: [
    // Pikachu mural — 20x24 grid, 24px cells → 480x576
    // Centered horizontally, spans from floor 1 area to floor 3 area
    { x: L2_W / 2, y: L2_H - 620, w: 480, h: 576, paintingKey: 'painting_mural_big' },
  ],
  trashCans: [
    { x: 500, y: L2_H - 32 - 24 },
    { x: 200, y: L2_H - 500 - 24 },
  ],
  cops: [
    { x: 500, y: L2_H - 55,  minX: 100, maxX: L2_W - 40 },
    { x: 300, y: L2_H - 520, minX: 100, maxX: 500 },
  ],
  foregroundWires: [
    { x1: 0, y1: L2_H - 380, x2: L2_W, y2: L2_H - 400 },
    { x1: 0, y1: L2_H - 880, x2: L2_W, y2: L2_H - 860 },
  ],
};

export const LEVELS = [LEVEL_1, LEVEL_2];
