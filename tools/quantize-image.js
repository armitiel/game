#!/usr/bin/env node
/**
 * Shadow Tagger — Image Quantizer for Paint-by-Numbers
 *
 * Takes a source PNG and converts it into a grid JSON for the game.
 * Each pixel is mapped to the nearest of 4 game colors (or -1 for background).
 *
 * Usage:
 *   node tools/quantize-image.js <input.png> [cols] [rows] [output_name]
 *
 * Example:
 *   node tools/quantize-image.js my_cat.png 20 28 cat_mural
 *
 * Output:
 *   public/assets/paintings/<output_name>.json
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

// Game paint colors in RGB
const GAME_COLORS = {
  RED:    { r: 255, g: 51,  b: 68  },
  BLUE:   { r: 51,  g: 136, b: 255 },
  YELLOW: { r: 255, g: 221, b: 51  },
  GREEN:  { r: 51,  g: 255, b: 136 },
};

const COLOR_NAMES = Object.keys(GAME_COLORS);
const COLOR_VALUES = Object.values(GAME_COLORS);

// Background threshold — if a pixel is too dark/gray, treat it as "no paint"
const DARK_THRESHOLD = 80;     // max brightness to be considered dark
const SATURATION_THRESHOLD = 30; // min saturation to be considered colorful

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getBrightness(r, g, b) {
  return (r + g + b) / 3;
}

function getSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

function quantizePixel(r, g, b, a) {
  // Transparent pixels → background
  if (a < 128) return -1;

  // Dark or desaturated pixels → background
  if (getBrightness(r, g, b) < DARK_THRESHOLD && getSaturation(r, g, b) < SATURATION_THRESHOLD) {
    return -1;
  }

  // Find nearest game color
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < COLOR_VALUES.length; i++) {
    const c = COLOR_VALUES[i];
    const d = colorDistance(r, g, b, c.r, c.g, c.b);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node tools/quantize-image.js <input.png> [cols=20] [rows=28] [output_name]');
    process.exit(1);
  }

  const inputPath = args[0];
  const cols = parseInt(args[1]) || 20;
  const rows = parseInt(args[2]) || 28;
  const outputName = args[3] || path.basename(inputPath, path.extname(inputPath));

  console.log(`Loading: ${inputPath}`);
  console.log(`Grid: ${cols}x${rows} (${cols * rows} cells)`);

  const img = await loadImage(inputPath);

  // Draw image scaled to grid resolution
  const canvas = createCanvas(cols, rows);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cols, rows);
  const imageData = ctx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  // Quantize each pixel
  const grid = [];
  const colorUsed = new Set();

  for (let row = 0; row < rows; row++) {
    const gridRow = [];
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const colorIdx = quantizePixel(r, g, b, a);
      gridRow.push(colorIdx);
      if (colorIdx >= 0) colorUsed.add(colorIdx);
    }
    grid.push(gridRow);
  }

  // Build used colors list
  const usedColors = [...colorUsed].sort().map(i => COLOR_NAMES[i]);

  // Count cells
  let paintable = 0;
  let background = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell >= 0) paintable++;
      else background++;
    }
  }

  const result = {
    name: outputName,
    cols,
    rows,
    colors: usedColors,
    grid,
  };

  // Save JSON
  const outputDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'public', 'assets', 'paintings');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `${outputName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\nSaved: ${jsonPath}`);
  console.log(`Colors used: ${usedColors.join(', ')}`);
  console.log(`Paintable cells: ${paintable} / ${cols * rows} (${Math.round(paintable / (cols * rows) * 100)}%)`);
  console.log(`Background cells: ${background}`);

  // Generate preview PNG
  const previewScale = 8;
  const previewCanvas = createCanvas(cols * previewScale, rows * previewScale);
  const pctx = previewCanvas.getContext('2d');

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ci = grid[row][col];
      if (ci >= 0) {
        const c = COLOR_VALUES[ci];
        pctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      } else {
        pctx.fillStyle = '#333333';
      }
      pctx.fillRect(col * previewScale, row * previewScale, previewScale, previewScale);

      // Grid lines
      pctx.strokeStyle = 'rgba(0,0,0,0.3)';
      pctx.strokeRect(col * previewScale, row * previewScale, previewScale, previewScale);

      // Number label
      if (ci >= 0) {
        pctx.fillStyle = 'rgba(0,0,0,0.6)';
        pctx.font = `${previewScale * 0.6}px monospace`;
        pctx.textAlign = 'center';
        pctx.textBaseline = 'middle';
        pctx.fillText(
          String(ci + 1),
          col * previewScale + previewScale / 2,
          row * previewScale + previewScale / 2
        );
      }
    }
  }

  const previewPath = path.join(outputDir, `${outputName}_preview.png`);
  const buffer = previewCanvas.toBuffer('image/png');
  fs.writeFileSync(previewPath, buffer);
  console.log(`Preview: ${previewPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
