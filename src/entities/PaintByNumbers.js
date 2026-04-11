import Phaser from 'phaser';
import { PAINT } from '../config/gameConfig.js';

/**
 * PaintByNumbers — manages a paint-by-numbers grid overlay for a paint spot.
 *
 * Renders a numbered grid template and tracks which cells the player fills.
 * Each cell has a required color (index 0-3) or -1 for background (no paint).
 * Player must select the correct color to fill each cell.
 */

// Fallback map if painting JSON has no colors array
const DEFAULT_COLOR_MAP = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

export default class PaintByNumbers {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ x: number, y: number, w: number, h: number }} bounds - paint area (top-left + size)
   * @param {object} gridData - JSON from quantize tool { name, cols, rows, colors, grid }
   */
  constructor(scene, bounds, gridData) {
    this.scene = scene;
    this.bounds = bounds;
    this.cols = gridData.cols;
    this.rows = gridData.rows;
    this.targetGrid = gridData.grid;         // 2D: [row][col] → color index or -1
    this.colorMap = gridData.colors || DEFAULT_COLOR_MAP;  // painting's own color list

    // Build resolved color lookup: start with PAINT.COLORS, then OVERRIDE with palette from JSON
    // Palette always wins — it has the exact colors from the mural editor's image conversion
    this._resolvedColors = { ...PAINT.COLORS };
    if (gridData.palette) {
      for (const [name, hexStr] of Object.entries(gridData.palette)) {
        // Convert "#rrggbb" hex string to 0xRRGGBB number — always override
        this._resolvedColors[name] = parseInt(hexStr.replace('#', ''), 16);
      }
    }
    console.log('[PBN] colorMap:', this.colorMap, 'palette:', gridData.palette, 'resolved:', Object.fromEntries(
      this.colorMap.map(c => [c, '0x' + (this._resolvedColors[c] || 0).toString(16).padStart(6, '0')])
    ));

    this.cellW = bounds.w / this.cols;
    this.cellH = bounds.h / this.rows;

    // Tracking
    this.filledGrid = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    this.filledCount = 0;
    this.totalPaintable = 0;

    // Count paintable cells (total and per color index)
    this.cellsPerColor = {};  // { colorIndex: count }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci >= 0) {
          this.totalPaintable++;
          this.cellsPerColor[ci] = (this.cellsPerColor[ci] || 0) + 1;
        }
      }
    }

    // Pre-calculate paint cost per cell for each color
    // Cost = PAINT_PER_CAN / (cells of that color) / SURPLUS factor
    // So 1 can covers exactly its share of the mural (with surplus margin)
    this.costPerCell = {};
    const paintPerCan = PAINT.PAINT_PER_CAN || 100;
    const surplus = PAINT.PAINT_SURPLUS || 1.15;
    for (const [ci, count] of Object.entries(this.cellsPerColor)) {
      this.costPerCell[ci] = paintPerCan / (count * surplus);
    }

    // Currently selected color (index into this.colorMap)
    this.selectedColorIndex = 0;

    // Graphics layers
    this.templateGfx = scene.add.graphics().setDepth(1.5);
    this.paintGfx = scene.add.graphics().setDepth(2);

    // Wrong-color flash tracking
    this._flashCells = []; // { r, c, timer }

    this.createTemplate();
  }

  /**
   * Draw the numbered grid template (outlines + numbers).
   */
  createTemplate() {
    const g = this.templateGfx;
    const b = this.bounds;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        const cx = b.x + c * this.cellW;
        const cy = b.y + r * this.cellH;

        if (ci >= 0) {
          // Very subtle tint of the target color (hint) — numbers do the real guiding
          const hex = this._resolvedColors[this.colorMap[ci]] || 0xffffff;
          g.fillStyle(hex, 0.06);
          g.fillRect(cx, cy, this.cellW, this.cellH);
        }
      }
    }

    // Draw number labels — multiple per large region, spaced evenly.
    // Labels disappear only when their entire region is painted (not per-cell).
    this.numberTexts = []; // kept empty for compat
    const RES = 3;
    this._canvasRes = RES;

    const fontSize = Math.max(12, Math.round(RES * 7));
    const strokeW = Math.max(2, Math.round(RES * 1.2));
    const LABEL_SPACING = 8;
    const MIN_LABEL_DIST_CELLS = 3; // min distance between labels of DIFFERENT colors

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(b.w * RES);
    canvas.height = Math.ceil(b.h * RES);

    // --- Step 1: BFS to find all connected regions, assign region IDs ---
    const regionIdGrid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(-1));
    const regions = []; // { id, colorIndex, cells: [{r,c}], totalCells }
    const visited = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0 || visited[r][c]) continue;

        const regionId = regions.length;
        const queue = [{ r, c }];
        visited[r][c] = true;
        const cells = [];

        while (queue.length > 0) {
          const cur = queue.shift();
          cells.push(cur);
          regionIdGrid[cur.r][cur.c] = regionId;

          const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
          for (const [dr, dc] of dirs) {
            const nr = cur.r + dr;
            const nc = cur.c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
                !visited[nr][nc] && this.targetGrid[nr][nc] === ci) {
              visited[nr][nc] = true;
              queue.push({ r: nr, c: nc });
            }
          }
        }

        regions.push({ id: regionId, colorIndex: ci, cells, totalCells: cells.length, filledCells: 0 });
      }
    }

    // Store for region-aware clearing
    this._regionIdGrid = regionIdGrid;
    this._regions = regions;
    this._regionFillCount = regions.map(() => 0);

    // --- Step 2: Generate candidate label positions per region ---
    const candidateLabels = []; // { lx, ly, row, col, regionId, colorIndex, label }

    for (const reg of regions) {
      const numLabels = Math.max(1, Math.round(reg.totalCells / (LABEL_SPACING * LABEL_SPACING)));

      if (numLabels <= 1) {
        let sumR = 0, sumC = 0;
        for (const cl of reg.cells) { sumR += cl.r; sumC += cl.c; }
        const centR = sumR / reg.cells.length;
        const centC = sumC / reg.cells.length;
        let bestR = reg.cells[0].r, bestC = reg.cells[0].c, bestDist = Infinity;
        for (const cl of reg.cells) {
          const dist = (cl.r - centR) ** 2 + (cl.c - centC) ** 2;
          if (dist < bestDist) { bestDist = dist; bestR = cl.r; bestC = cl.c; }
        }
        candidateLabels.push({
          lx: (bestC * this.cellW + this.cellW / 2) * RES,
          ly: (bestR * this.cellH + this.cellH / 2) * RES,
          row: bestR, col: bestC, regionId: reg.id,
          colorIndex: reg.colorIndex, label: String(reg.colorIndex + 1)
        });
      } else {
        const cellSet = new Set(reg.cells.map(cl => cl.r * 10000 + cl.c));
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        for (const cl of reg.cells) {
          if (cl.r < minR) minR = cl.r;
          if (cl.r > maxR) maxR = cl.r;
          if (cl.c < minC) minC = cl.c;
          if (cl.c > maxC) maxC = cl.c;
        }
        const bboxH = maxR - minR + 1;
        const bboxW = maxC - minC + 1;
        const gridCols = Math.max(1, Math.round(bboxW / LABEL_SPACING));
        const gridRows = Math.max(1, Math.round(bboxH / LABEL_SPACING));
        const stepR = bboxH / gridRows;
        const stepC = bboxW / gridCols;

        for (let gr = 0; gr < gridRows; gr++) {
          for (let gc = 0; gc < gridCols; gc++) {
            const targetR = minR + (gr + 0.5) * stepR;
            const targetC = minC + (gc + 0.5) * stepC;
            let bestR = -1, bestC = -1, bestDist = Infinity;
            const sr = Math.round(targetR);
            const sc = Math.round(targetC);
            const searchRad = Math.ceil(Math.max(stepR, stepC));
            for (let dr = -searchRad; dr <= searchRad; dr++) {
              for (let dc = -searchRad; dc <= searchRad; dc++) {
                const tr = sr + dr;
                const tc = sc + dc;
                if (tr >= 0 && tr < this.rows && tc >= 0 && tc < this.cols &&
                    cellSet.has(tr * 10000 + tc)) {
                  const dist = (tr - targetR) ** 2 + (tc - targetC) ** 2;
                  if (dist < bestDist) { bestDist = dist; bestR = tr; bestC = tc; }
                }
              }
            }
            if (bestR >= 0) {
              candidateLabels.push({
                lx: (bestC * this.cellW + this.cellW / 2) * RES,
                ly: (bestR * this.cellH + this.cellH / 2) * RES,
                row: bestR, col: bestC, regionId: reg.id,
                colorIndex: reg.colorIndex, label: String(reg.colorIndex + 1)
              });
            }
          }
        }
      }
    }

    // --- Step 3: Filter out labels that are too close to each other ---
    const finalLabels = [];
    const cellSize = Math.min(this.cellW, this.cellH) * RES;
    const minDistDiffColor = MIN_LABEL_DIST_CELLS * cellSize; // between different colors
    const minDistSameColor = MIN_LABEL_DIST_CELLS * cellSize * 1.5; // between same color (stricter!)
    const minDistSqDiff = minDistDiffColor * minDistDiffColor;
    const minDistSqSame = minDistSameColor * minDistSameColor;

    // Sort by region size descending — bigger regions keep their labels first
    candidateLabels.sort((a, b) => {
      const regA = regions[a.regionId];
      const regB = regions[b.regionId];
      return regB.totalCells - regA.totalCells;
    });

    for (const cl of candidateLabels) {
      let tooClose = false;
      for (const placed of finalLabels) {
        const dx = cl.lx - placed.lx;
        const dy = cl.ly - placed.ly;
        const distSq = dx * dx + dy * dy;
        // Same region labels can be closer; different region same-color must be far apart
        if (placed.regionId === cl.regionId) {
          // Same region — use moderate spacing
          if (distSq < minDistSqDiff) { tooClose = true; break; }
        } else if (placed.colorIndex === cl.colorIndex) {
          // Different region, same color — strictest spacing to avoid overlaps
          if (distSq < minDistSqSame) { tooClose = true; break; }
        } else {
          // Different color — moderate spacing
          if (distSq < minDistSqDiff) { tooClose = true; break; }
        }
      }
      // Always keep at least 1 label per region even if close
      const regionHasLabel = finalLabels.some(fl => fl.regionId === cl.regionId);
      if (!tooClose || !regionHasLabel) {
        finalLabels.push(cl);
      }
    }

    // Store labels for region-aware clearing
    this._labelData = finalLabels;

    // --- Step 4: Draw labels ---
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px Bungee, monospace`;
    ctx.globalAlpha = 0.65;

    for (const rl of finalLabels) {
      const targetHex = this._resolvedColors[this.colorMap[rl.colorIndex]] || 0xffffff;
      const hexStr = '#' + targetHex.toString(16).padStart(6, '0');

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';
      ctx.strokeText(rl.label, rl.lx, rl.ly);
      ctx.fillStyle = hexStr;
      ctx.fillText(rl.label, rl.lx, rl.ly);
    }

    const texKey = '__pbn_nums_' + b.x + '_' + b.y;
    if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
    this.scene.textures.addCanvas(texKey, canvas);
    this._numbersTexKey = texKey;
    this._fontSize = fontSize;
    this.numbersImage = this.scene.add.image(b.x, b.y, texKey)
      .setOrigin(0, 0).setDisplaySize(b.w, b.h).setDepth(7.2);
  }

  /**
   * Try to fill the cell at the given world position with the selected color.
   * @param {number} worldX
   * @param {number} worldY
   * @returns {true|'wrong'|false} - true=filled, 'wrong'=wrong color, false=already filled or background
   */
  tryFillCell(worldX, worldY) {
    const b = this.bounds;
    const col = Math.floor((worldX - b.x) / this.cellW);
    const row = Math.floor((worldY - b.y) / this.cellH);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;

    const targetColor = this.targetGrid[row][col];
    if (targetColor < 0) return false;            // background cell
    if (this.filledGrid[row][col]) return false;   // already filled

    if (this.selectedColorIndex !== targetColor) {
      // Wrong color — trigger flash
      this._flashWrongCell(row, col);
      return 'wrong';
    }

    // Correct color — fill it!
    this.filledGrid[row][col] = true;
    this.filledCount++;

    const cx = b.x + col * this.cellW;
    const cy = b.y + row * this.cellH;
    const hex = this._resolvedColors[this.colorMap[targetColor]] || 0xff3344;

    // Draw filled cell — extend by 1px to avoid sub-pixel gaps, fully opaque
    const pad = 1;
    // Solid dark base to fully cover template lines underneath
    this.paintGfx.fillStyle(0x000000, 1);
    this.paintGfx.fillRect(cx - pad, cy - pad, this.cellW + pad * 2, this.cellH + pad * 2);
    // Color layer on top — slight brightness variation for paint texture feel
    const variation = Phaser.Math.FloatBetween(0.82, 1.0);
    const r = ((hex >> 16) & 0xff) * variation | 0;
    const g = ((hex >> 8) & 0xff) * variation | 0;
    const b2 = (hex & 0xff) * variation | 0;
    const variedHex = (r << 16) | (g << 8) | b2;
    this.paintGfx.fillStyle(variedHex, 1);
    this.paintGfx.fillRect(cx - pad, cy - pad, this.cellW + pad * 2, this.cellH + pad * 2);

    // No paint streaks — they create visible bright lines on dark colors

    // Clear number from canvas for this cell
    this._clearNumberCell(col, row);

    return true;
  }

  /**
   * Flash a cell red briefly when wrong color is used.
   */
  _flashWrongCell(row, col) {
    const b = this.bounds;
    const cx = b.x + col * this.cellW;
    const cy = b.y + row * this.cellH;

    const flash = this.scene.add.rectangle(
      cx + this.cellW / 2, cy + this.cellH / 2,
      this.cellW, this.cellH
    ).setStrokeStyle(2, 0xff0000, 0.9).setFillStyle(0xff0000, 0).setDepth(3);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * Fill all remaining cells (visual completeness at threshold).
   */
  fillRemaining() {
    const b = this.bounds;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0 || this.filledGrid[r][c]) continue;

        this.filledGrid[r][c] = true;
        const cx = b.x + c * this.cellW;
        const cy = b.y + r * this.cellH;
        const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;
        this.paintGfx.fillStyle(0x000000, 1);
        this.paintGfx.fillRect(cx - 1, cy - 1, this.cellW + 2, this.cellH + 2);
        this.paintGfx.fillStyle(hex, 1);
        this.paintGfx.fillRect(cx - 1, cy - 1, this.cellW + 2, this.cellH + 2);

        // Track region fill
        this._clearNumberCell(c, r);
      }
    }
    this.filledCount = this.totalPaintable;
  }

  getProgress() {
    if (this.totalPaintable === 0) return 1;
    return this.filledCount / this.totalPaintable;
  }

  isComplete() {
    return this.getProgress() >= (PAINT.PBN_COMPLETION_THRESHOLD || 0.75);
  }

  setSelectedColor(index) {
    this.selectedColorIndex = Phaser.Math.Clamp(index, 0, this.colorMap.length - 1);
  }

  getSelectedColorName() {
    return this.colorMap[this.selectedColorIndex];
  }

  getSelectedColorHex() {
    return this._resolvedColors[this.getSelectedColorName()] || 0xffffff;
  }

  /**
   * Get paint cost for one cell of the currently selected color.
   */
  getCellCost() {
    return this.costPerCell[this.selectedColorIndex] || 1;
  }

  /**
   * Get the grid cell (row, col) at a world position without modifying anything.
   * @returns {{ row: number, col: number } | null}
   */
  getCellAt(worldX, worldY) {
    const b = this.bounds;
    const col = Math.floor((worldX - b.x) / this.cellW);
    const row = Math.floor((worldY - b.y) / this.cellH);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  /**
   * Flood-fill BFS from a cell — find all connected unfilled cells of the same color.
   * Bridges small gaps: nearby same-color regions within GAP_BRIDGE distance
   * are merged into one super-region so clicking one fills them all.
   * Returns array of layers (each layer = array of {r, c}), ordered by BFS distance.
   * @param {number} row
   * @param {number} col
   * @returns {{ layers: Array<Array<{r:number, c:number}>>, colorIndex: number, totalCells: number } | null}
   */
  getFloodRegion(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const targetCI = this.targetGrid[row][col];
    if (targetCI < 0) return null;           // background cell
    if (this.filledGrid[row][col]) return null; // already filled

    const GAP_BRIDGE = 3; // max cells to jump across to merge nearby same-color regions
    const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const inRegion = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    // Collect all cells that belong to this super-region
    const allCells = [];
    const seedQueue = [{ r: row, c: col }];
    visited[row][col] = true;

    while (seedQueue.length > 0) {
      // Standard BFS flood from current seed
      const floodQueue = [seedQueue.shift()];
      const regionCells = [];

      while (floodQueue.length > 0) {
        const { r, c } = floodQueue.shift();
        if (inRegion[r][c]) continue;
        inRegion[r][c] = true;
        regionCells.push({ r, c });

        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
          if (inRegion[nr][nc] || visited[nr][nc]) continue;
          if (this.filledGrid[nr][nc]) continue;
          if (this.targetGrid[nr][nc] !== targetCI) continue;
          visited[nr][nc] = true;
          floodQueue.push({ r: nr, c: nc });
        }
      }

      allCells.push(...regionCells);

      // Bridge: from each cell at the edge of this region, search within GAP_BRIDGE
      // distance for unfilled same-color cells that haven't been visited yet
      for (const { r, c } of regionCells) {
        for (let dr = -GAP_BRIDGE; dr <= GAP_BRIDGE; dr++) {
          for (let dc = -GAP_BRIDGE; dc <= GAP_BRIDGE; dc++) {
            if (Math.abs(dr) + Math.abs(dc) > GAP_BRIDGE) continue; // Manhattan distance
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            if (visited[nr][nc] || inRegion[nr][nc]) continue;
            if (this.filledGrid[nr][nc]) continue;
            if (this.targetGrid[nr][nc] !== targetCI) continue;
            // Found a nearby same-color cell — add as new seed
            visited[nr][nc] = true;
            seedQueue.push({ r: nr, c: nc });
          }
        }
      }
    }

    if (allCells.length === 0) return null;

    // Re-order cells into BFS layers from the original tap point for wave animation
    const layerVisited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const cellSet = new Set(allCells.map(c => `${c.r},${c.c}`));
    const layers = [];
    const bfsQueue = [{ r: row, c: col }];
    layerVisited[row][col] = true;

    while (bfsQueue.length > 0) {
      const layer = [];
      const size = bfsQueue.length;
      for (let i = 0; i < size; i++) {
        const { r, c } = bfsQueue.shift();
        layer.push({ r, c });

        // Expand to all neighbors in the cell set (including gap-bridged, use GAP_BRIDGE range)
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
            if (layerVisited[nr][nc]) continue;
            if (!cellSet.has(`${nr},${nc}`)) continue;
            layerVisited[nr][nc] = true;
            bfsQueue.push({ r: nr, c: nc });
          }
        }
      }
      if (layer.length > 0) layers.push(layer);
    }

    // Any cells not reached by BFS (disconnected clusters) — add as final layer
    const reached = new Set();
    for (const layer of layers) for (const c of layer) reached.add(`${c.r},${c.c}`);
    const remaining = allCells.filter(c => !reached.has(`${c.r},${c.c}`));
    if (remaining.length > 0) layers.push(remaining);

    const totalCells = layers.reduce((sum, l) => sum + l.length, 0);
    return { layers, colorIndex: targetCI, totalCells };
  }

  /**
   * Fill a single cell by row/col (used by flood paint animated fill).
   * Does NOT check selected color — caller is responsible for correctness.
   * @returns {boolean} true if cell was filled
   */
  fillCellDirect(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    const ci = this.targetGrid[row][col];
    if (ci < 0 || this.filledGrid[row][col]) return false;

    this.filledGrid[row][col] = true;
    this.filledCount++;

    const b = this.bounds;
    const cx = b.x + col * this.cellW;
    const cy = b.y + row * this.cellH;
    const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;

    const pad = 1;
    this.paintGfx.fillStyle(0x000000, 1);
    this.paintGfx.fillRect(cx - pad, cy - pad, this.cellW + pad * 2, this.cellH + pad * 2);
    const variation = Phaser.Math.FloatBetween(0.82, 1.0);
    const r = ((hex >> 16) & 0xff) * variation | 0;
    const g = ((hex >> 8) & 0xff) * variation | 0;
    const b2 = (hex & 0xff) * variation | 0;
    const variedHex = (r << 16) | (g << 8) | b2;
    this.paintGfx.fillStyle(variedHex, 1);
    this.paintGfx.fillRect(cx - pad, cy - pad, this.cellW + pad * 2, this.cellH + pad * 2);

    this._clearNumberCell(col, row);
    return true;
  }

  /**
   * Get the total paint cost for a flood region.
   * @param {{ layers: Array, colorIndex: number, totalCells: number }} region
   * @returns {number}
   */
  getFloodCost(region) {
    if (!region) return 0;
    return (this.costPerCell[region.colorIndex] || 1) * region.totalCells;
  }

  /**
   * Serialize state for saving when player cancels painting.
   */
  serialize() {
    return {
      filledGrid: this.filledGrid.map(row => [...row]),
      filledCount: this.filledCount,
      selectedColorIndex: this.selectedColorIndex,
    };
  }

  /**
   * Restore state from a previous session.
   */
  restore(savedState) {
    if (!savedState) return;
    this.filledGrid = savedState.filledGrid;
    this.filledCount = savedState.filledCount;
    this.selectedColorIndex = savedState.selectedColorIndex || 0;

    // Redraw filled cells
    const b = this.bounds;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.filledGrid[r][c]) continue;
        const ci = this.targetGrid[r][c];
        if (ci < 0) continue;

        const cx = b.x + c * this.cellW;
        const cy = b.y + r * this.cellH;
        const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;
        this.paintGfx.fillStyle(0x000000, 1);
        this.paintGfx.fillRect(cx - 1, cy - 1, this.cellW + 2, this.cellH + 2);
        this.paintGfx.fillStyle(hex, 1);
        this.paintGfx.fillRect(cx - 1, cy - 1, this.cellW + 2, this.cellH + 2);

        // Clear number from canvas
        this._clearNumberCell(c, r);
      }
    }
  }

  /**
   * Notify that a cell was painted — update region fill tracking.
   * Labels are only cleared when an entire region is fully painted.
   */
  _clearNumberCell(col, row) {
    if (!this._regionIdGrid || !this._regions) return;
    const regionId = this._regionIdGrid[row]?.[col];
    if (regionId == null || regionId < 0) return;

    // Increment fill count for this region
    if (!this._regionFillCount) return;
    this._regionFillCount[regionId]++;
    const reg = this._regions[regionId];
    if (!reg) return;

    // Only clear labels when region is fully painted
    if (this._regionFillCount[regionId] < reg.totalCells) return;

    // Region complete — clear all labels belonging to this region
    this._clearRegionLabels(regionId);
  }

  /** Clear all labels for a completed region from the canvas texture */
  _clearRegionLabels(regionId) {
    if (!this._numbersTexKey || !this._labelData) return;
    const tex = this.scene.textures.get(this._numbersTexKey);
    if (!tex || !tex.source || !tex.source[0]) return;
    const canvas = tex.source[0].image;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const res = this._canvasRes || 1;
    const clearRadius = (this._fontSize || 20) * 1.2; // clear area around label center

    for (const lbl of this._labelData) {
      if (lbl.regionId !== regionId) continue;
      ctx.clearRect(
        lbl.lx - clearRadius, lbl.ly - clearRadius,
        clearRadius * 2, clearRadius * 2
      );
    }
    tex.update();
  }

  /**
   * Destroy all graphics and text objects.
   */
  destroy() {
    this.templateGfx.destroy();
    this.paintGfx.destroy();
    if (this.numbersImage) this.numbersImage.destroy();
    if (this._numbersTexKey && this.scene.textures.exists(this._numbersTexKey)) {
      this.scene.textures.remove(this._numbersTexKey);
    }
    this.numberTexts = [];
  }

  /**
   * Hide template+numbers but keep painted cells visible on the wall.
   */
  hide() {
    this.templateGfx.setVisible(false);
    if (this.numbersImage) this.numbersImage.setVisible(false);
  }

  /**
   * Show template+paint (used when restoring on re-entry).
   */
  show() {
    this.templateGfx.setVisible(true);
    this.paintGfx.setVisible(true);
    if (this.numbersImage) this.numbersImage.setVisible(true);
  }
}
