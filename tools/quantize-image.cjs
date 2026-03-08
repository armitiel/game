#!/usr/bin/env node
/**
 * Shadow Tagger — Auto Image Quantizer for Paint-by-Numbers
 *
 * Analyzes a PNG image, auto-detects N dominant colors (k-means),
 * quantizes to a grid, and outputs a painting JSON for the game.
 *
 * The game automatically registers palette colors and generates
 * paint can textures at runtime — no manual color config needed.
 *
 * Usage:
 *   node tools/quantize-image.js <input.png> [cols] [rows] [numColors] [output_name]
 *
 * Example:
 *   node tools/quantize-image.js pikachu.png 20 24 3 pikachu_mural
 *
 * Output:
 *   public/assets/paintings/<output_name>.json
 */

const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

// --- K-Means Color Clustering ---

function colorDistSq(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Simple k-means clustering on RGB pixel array.
 * Returns N cluster centroids as [[r,g,b], ...].
 */
function kMeans(pixels, k, maxIter = 20) {
  if (pixels.length === 0) return [];

  // Initialize centroids by picking spread-out pixels
  const centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[Math.min(i * step, pixels.length - 1)]]);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign pixels to nearest centroid
    const clusters = Array.from({ length: k }, () => []);
    for (const px of pixels) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < k; ci++) {
        const d = colorDistSq(px, centroids[ci]);
        if (d < bestDist) { bestDist = d; bestIdx = ci; }
      }
      clusters[bestIdx].push(px);
    }

    // Update centroids
    let converged = true;
    for (let ci = 0; ci < k; ci++) {
      if (clusters[ci].length === 0) continue;
      const avg = [0, 0, 0];
      for (const px of clusters[ci]) {
        avg[0] += px[0]; avg[1] += px[1]; avg[2] += px[2];
      }
      const n = clusters[ci].length;
      const newC = [Math.round(avg[0] / n), Math.round(avg[1] / n), Math.round(avg[2] / n)];
      if (colorDistSq(newC, centroids[ci]) > 4) converged = false;
      centroids[ci] = newC;
    }

    if (converged) break;
  }

  return centroids;
}

/**
 * Convert RGB to a human-readable color name based on hue.
 */
function autoColorName(r, g, b, index) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  const brightness = (r + g + b) / 3;

  if (sat < 30) {
    if (brightness > 200) return `WHITE_${index}`;
    if (brightness < 50) return `BLACK_${index}`;
    return `GRAY_${index}`;
  }

  // Compute hue (0-360)
  let hue;
  if (max === r) hue = 60 * ((g - b) / sat);
  else if (max === g) hue = 60 * (2 + (b - r) / sat);
  else hue = 60 * (4 + (r - g) / sat);
  if (hue < 0) hue += 360;

  const light = brightness > 170 ? 'LIGHT_' : brightness < 80 ? 'DARK_' : '';

  if (hue < 15 || hue >= 345) return `${light}RED_${index}`;
  if (hue < 45) return `${light}ORANGE_${index}`;
  if (hue < 75) return `${light}YELLOW_${index}`;
  if (hue < 150) return `${light}GREEN_${index}`;
  if (hue < 195) return `${light}CYAN_${index}`;
  if (hue < 270) return `${light}BLUE_${index}`;
  if (hue < 330) return `${light}PURPLE_${index}`;
  return `${light}RED_${index}`;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// --- Background Detection ---
const DARK_THRESHOLD = 60;
const SATURATION_THRESHOLD = 25;
const ALPHA_THRESHOLD = 128;

function isBackground(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return true;
  const brightness = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness < DARK_THRESHOLD && sat < SATURATION_THRESHOLD;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node tools/quantize-image.js <input.png> [cols=20] [rows=24] [colors=4] [output_name]');
    process.exit(1);
  }

  const inputPath = args[0];
  const cols = parseInt(args[1]) || 20;
  const rows = parseInt(args[2]) || 24;
  const numColors = parseInt(args[3]) || 4;
  const outputName = args[4] || path.basename(inputPath, path.extname(inputPath));

  console.log(`Loading: ${inputPath}`);
  console.log(`Grid: ${cols}x${rows} (${cols * rows} cells)`);
  console.log(`Auto-detecting ${numColors} colors...`);

  // Load image and resize to grid dimensions
  const img = await Jimp.read(inputPath);
  img.resize({ w: cols, h: rows });

  // Extract foreground pixels for color analysis
  const fgPixels = [];
  const allPixels = []; // {r,g,b,a} per grid cell

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const color = img.getPixelColor(x, y);
      const r = (color >> 24) & 0xFF;
      const g = (color >> 16) & 0xFF;
      const b = (color >> 8) & 0xFF;
      const a = color & 0xFF;
      allPixels.push({ r, g, b, a });
      if (!isBackground(r, g, b, a)) {
        fgPixels.push([r, g, b]);
      }
    }
  }

  console.log(`Foreground pixels: ${fgPixels.length} / ${cols * rows}`);

  if (fgPixels.length === 0) {
    console.error('Error: No foreground pixels found. Try adjusting thresholds.');
    process.exit(1);
  }

  // K-means clustering to find dominant colors
  const centroids = kMeans(fgPixels, numColors);

  // Sort centroids by brightness (darkest first) for consistent ordering
  centroids.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));

  // Generate palette
  const palette = {};
  const colorNames = [];
  console.log('\nDetected colors:');
  for (let i = 0; i < centroids.length; i++) {
    const [r, g, b] = centroids[i];
    const name = autoColorName(r, g, b, i);
    const hex = rgbToHex(r, g, b);
    palette[name] = hex;
    colorNames.push(name);
    console.log(`  ${i}: ${name} = ${hex} (rgb ${r},${g},${b})`);
  }

  // Quantize each pixel to nearest centroid
  const grid = [];
  let paintable = 0;

  for (let y = 0; y < rows; y++) {
    const gridRow = [];
    for (let x = 0; x < cols; x++) {
      const px = allPixels[y * cols + x];
      if (isBackground(px.r, px.g, px.b, px.a)) {
        gridRow.push(-1);
        continue;
      }

      // Find nearest centroid
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < centroids.length; ci++) {
        const d = colorDistSq([px.r, px.g, px.b], centroids[ci]);
        if (d < bestDist) { bestDist = d; bestIdx = ci; }
      }
      gridRow.push(bestIdx);
      paintable++;
    }
    grid.push(gridRow);
  }

  const result = {
    name: outputName,
    cols,
    rows,
    colors: colorNames,
    palette,
    grid,
  };

  // Save JSON
  const outputDir = path.join(__dirname, '..', 'public', 'assets', 'paintings');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `${outputName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\nSaved: ${jsonPath}`);
  console.log(`Paintable cells: ${paintable} / ${cols * rows} (${Math.round(paintable / (cols * rows) * 100)}%)`);

  // Generate preview PNG using Jimp
  const previewScale = 10;
  const previewImg = new Jimp({ width: cols * previewScale, height: rows * previewScale, color: 0x333333FF });

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ci = grid[y][x];
      let r = 0x33, g = 0x33, b = 0x33;
      if (ci >= 0) {
        [r, g, b] = centroids[ci];
      }
      const color = ((r << 24) | (g << 16) | (b << 8) | 0xFF) >>> 0;

      // Fill cell
      for (let py = 0; py < previewScale - 1; py++) {
        for (let px = 0; px < previewScale - 1; px++) {
          previewImg.setPixelColor(color, x * previewScale + px, y * previewScale + py);
        }
      }
    }
  }

  const previewPath = path.join(outputDir, `${outputName}_preview.png`);
  await previewImg.write(previewPath);
  console.log(`Preview: ${previewPath}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
