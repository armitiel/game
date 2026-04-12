import Phaser from 'phaser';
import { PAINT } from '../config/gameConfig.js';

/**
 * PaintByNumbers — paint-by-numbers grid overlay for a paint spot.
 *
 * RENDERING: Single RenderTexture ("masterRT") holds both paint and numbers.
 * After each paint operation the RT is refreshed:
 *   1) all accumulated paint cells are already baked into the RT
 *   2) number labels are redrawn ON TOP inside the same RT
 *
 * Because everything lives in ONE object there is zero cross-pipeline
 * depth-sorting — the GPU receives a single quad.
 */

const DEFAULT_COLOR_MAP = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

export default class PaintByNumbers {
  constructor(scene, bounds, gridData) {
    this.scene = scene;
    this.bounds = bounds;
    this.cols = gridData.cols;
    this.rows = gridData.rows;
    this.targetGrid = gridData.grid;
    this.colorMap = gridData.colors || DEFAULT_COLOR_MAP;

    this._resolvedColors = { ...PAINT.COLORS };
    if (gridData.palette) {
      for (const [name, hexStr] of Object.entries(gridData.palette)) {
        this._resolvedColors[name] = parseInt(hexStr.replace('#', ''), 16);
      }
    }

    this.cellW = bounds.w / this.cols;
    this.cellH = bounds.h / this.rows;

    this.filledGrid = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    this.filledCount = 0;
    this.totalPaintable = 0;

    this.cellsPerColor = {};
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.targetGrid[r][c] >= 0) {
          this.totalPaintable++;
          const ci = this.targetGrid[r][c];
          this.cellsPerColor[ci] = (this.cellsPerColor[ci] || 0) + 1;
        }
      }
    }

    this.costPerCell = {};
    const paintPerCan = PAINT.PAINT_PER_CAN || 100;
    const surplus = PAINT.PAINT_SURPLUS || 1.15;
    for (const [ci, count] of Object.entries(this.cellsPerColor)) {
      this.costPerCell[ci] = paintPerCan / (count * surplus);
    }

    this.selectedColorIndex = 0;
    this._flashCells = [];
    this.numberTexts = [];

    this._initRendering();
  }

  /* ------------------------------------------------------------------ */
  /*  RENDERING INIT                                                     */
  /* ------------------------------------------------------------------ */
  _initRendering() {
    const b = this.bounds;

    // Hi-res scale factor — RT is rendered at S× and displayed at 1×
    this._rtScale = 3;
    const S = this._rtScale;

    // ---- Master RenderTexture (the ONE object on screen) ----
    this.masterRT = this.scene.add.renderTexture(b.x, b.y, b.w * S, b.h * S)
      .setOrigin(0, 0).setDepth(2).setDisplaySize(b.w, b.h);

    // Use LINEAR filtering so downscaled text looks smooth (not blocky pixel-art)
    this.masterRT.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    // ---- Off-screen Graphics for drawing cells (not added to scene) ----
    this._gfx = this.scene.make.graphics({ add: false });

    // ---- BFS regions + labels ----
    this._buildRegions();
    this._buildLabels();

    // ---- Draw template colour hints ----
    this._drawTemplateHints();

    // ---- Stamp number labels on top ----
    this._stampLabels();
  }

  /* ------------------------------------------------------------------ */
  /*  REGION DETECTION (BFS)                                            */
  /* ------------------------------------------------------------------ */
  _buildRegions() {
    const regionIdGrid = Array.from({ length: this.rows }, () => new Int16Array(this.cols).fill(-1));
    const regions = [];
    const visited = Array.from({ length: this.rows }, () => new Uint8Array(this.cols));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0 || visited[r][c]) continue;
        const id = regions.length;
        const queue = [{ r, c }];
        visited[r][c] = 1;
        const cells = [];
        while (queue.length) {
          const cur = queue.shift();
          cells.push(cur);
          regionIdGrid[cur.r][cur.c] = id;
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = cur.r + dr, nc = cur.c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
                !visited[nr][nc] && this.targetGrid[nr][nc] === ci) {
              visited[nr][nc] = 1;
              queue.push({ r: nr, c: nc });
            }
          }
        }
        regions.push({ id, colorIndex: ci, cells, totalCells: cells.length });
      }
    }
    this._regionIdGrid = regionIdGrid;
    this._regions = regions;
    this._regionFillCount = new Int32Array(regions.length);
  }

  /* ------------------------------------------------------------------ */
  /*  LABEL GENERATION                                                  */
  /* ------------------------------------------------------------------ */
  _buildLabels() {
    const LABEL_SPACING = 8;
    const MIN_DIST = 3;
    const regions = this._regions;
    const candidates = [];

    for (const reg of regions) {
      const n = Math.max(1, Math.round(reg.totalCells / (LABEL_SPACING * LABEL_SPACING)));
      if (n <= 1) {
        // Single label at region centroid
        let sR = 0, sC = 0;
        for (const cl of reg.cells) { sR += cl.r; sC += cl.c; }
        const cR = sR / reg.cells.length, cC = sC / reg.cells.length;
        let bR = reg.cells[0].r, bC = reg.cells[0].c, bD = Infinity;
        for (const cl of reg.cells) {
          const d = (cl.r - cR) ** 2 + (cl.c - cC) ** 2;
          if (d < bD) { bD = d; bR = cl.r; bC = cl.c; }
        }
        candidates.push({ r: bR, c: bC, regionId: reg.id, ci: reg.colorIndex, label: String(reg.colorIndex + 1) });
      } else {
        // Grid of labels for large region
        const cs = new Set(reg.cells.map(cl => cl.r * 10000 + cl.c));
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        for (const cl of reg.cells) { minR = Math.min(minR, cl.r); maxR = Math.max(maxR, cl.r); minC = Math.min(minC, cl.c); maxC = Math.max(maxC, cl.c); }
        const bH = maxR - minR + 1, bW = maxC - minC + 1;
        const gR = Math.max(1, Math.round(bH / LABEL_SPACING));
        const gC = Math.max(1, Math.round(bW / LABEL_SPACING));
        const sR = bH / gR, sC = bW / gC;
        for (let gr = 0; gr < gR; gr++) {
          for (let gc = 0; gc < gC; gc++) {
            const tR = minR + (gr + 0.5) * sR, tC = minC + (gc + 0.5) * sC;
            let bR2 = -1, bC2 = -1, bD2 = Infinity;
            const sr = Math.round(tR), sc = Math.round(tC), rad = Math.ceil(Math.max(sR, sC));
            for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
              const tr = sr + dr, tc = sc + dc;
              if (tr >= 0 && tr < this.rows && tc >= 0 && tc < this.cols && cs.has(tr * 10000 + tc)) {
                const d = (tr - tR) ** 2 + (tc - tC) ** 2;
                if (d < bD2) { bD2 = d; bR2 = tr; bC2 = tc; }
              }
            }
            if (bR2 >= 0) candidates.push({ r: bR2, c: bC2, regionId: reg.id, ci: reg.colorIndex, label: String(reg.colorIndex + 1) });
          }
        }
      }
    }

    // Prune close labels
    const cSize = Math.min(this.cellW, this.cellH);
    const dSqDiff = (MIN_DIST * cSize) ** 2;
    const dSqSame = (MIN_DIST * cSize * 1.5) ** 2;
    candidates.sort((a, b) => regions[b.regionId].totalCells - regions[a.regionId].totalCells);
    const final = [];
    for (const cl of candidates) {
      let close = false;
      for (const p of final) {
        const dx = (cl.c - p.c) * this.cellW, dy = (cl.r - p.r) * this.cellH;
        const dSq = dx * dx + dy * dy;
        const th = (p.regionId === cl.regionId || p.ci !== cl.ci) ? dSqDiff : dSqSame;
        if (dSq < th) { close = true; break; }
      }
      if (!close || !final.some(f => f.regionId === cl.regionId)) final.push(cl);
    }

    // Mark as visible (will be hidden when region completes)
    for (const l of final) l.visible = true;
    this._labels = final;
  }

  /* ------------------------------------------------------------------ */
  /*  DRAW TEMPLATE HINTS (subtle colour tints)                         */
  /* ------------------------------------------------------------------ */
  _drawTemplateHints() {
    const g = this._gfx;
    const S = this._rtScale;
    g.clear();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0) continue;
        const hex = this._resolvedColors[this.colorMap[ci]] || 0xffffff;
        g.fillStyle(hex, 0.06);
        g.fillRect(c * this.cellW * S, r * this.cellH * S, this.cellW * S, this.cellH * S);
      }
    }
    this.masterRT.draw(g, 0, 0);
    g.clear();
  }

  /* ------------------------------------------------------------------ */
  /*  STAMP LABELS — render numbers onto masterRT (on top of paint)    */
  /* ------------------------------------------------------------------ */
  _stampLabels() {
    // Build an off-screen canvas with all VISIBLE labels, then draw it
    // onto the masterRT as a single image. Because it's drawn LAST,
    // labels sit on top of paint fills inside the same texture.

    const b = this.bounds;
    const S = this._rtScale;
    const RES = S;  // Label canvas matches RT internal resolution
    const cw = Math.ceil(b.w * RES);
    const ch = Math.ceil(b.h * RES);
    const fontSize = Math.max(12, Math.round(RES * 9));
    const strokeW = Math.max(2, Math.round(RES * 1.5));

    // Create (or reuse) off-screen canvas
    if (!this._labelCanvas || this._labelCanvas.width !== cw) {
      this._labelCanvas = document.createElement('canvas');
      this._labelCanvas.width = cw;
      this._labelCanvas.height = ch;
    }
    const ctx = this._labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px monospace, sans-serif`;

    const pillPadX = fontSize * 0.2;
    const pillPadY = fontSize * 0.1;

    for (const lbl of this._labels) {
      // Labels disappear only when entire region is painted (set by _trackRegion)
      if (!lbl.visible) continue;
      const lx = (lbl.c * this.cellW + this.cellW / 2) * RES;
      const ly = (lbl.r * this.cellH + this.cellH / 2) * RES;

      // Dark pill background
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#000000';
      const tw = ctx.measureText(lbl.label).width;
      const rx = lx - tw / 2 - pillPadX;
      const ry = ly - fontSize / 2 - pillPadY;
      const rw = tw + pillPadX * 2;
      const rh = fontSize + pillPadY * 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, Math.min(rw, rh) * 0.3);
      ctx.fill();

      // Number text — use paint colour, but ensure contrast on dark pill
      ctx.globalAlpha = 1.0;
      const hex = this._resolvedColors[this.colorMap[lbl.ci]] || 0xffffff;
      const lr = (hex >> 16) & 0xff, lg = (hex >> 8) & 0xff, lb = hex & 0xff;
      // Perceived brightness — if too dark, use white instead
      const bright = lr * 0.299 + lg * 0.587 + lb * 0.114;
      const hexStr = bright < 80 ? '#ffffff' : '#' + hex.toString(16).padStart(6, '0');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';
      ctx.strokeText(lbl.label, lx, ly);
      ctx.fillStyle = hexStr;
      ctx.fillText(lbl.label, lx, ly);
    }

    // Stamp canvas onto masterRT as an Image
    const texKey = '__pbn_lbl_' + Date.now();
    this.scene.textures.addCanvas(texKey, this._labelCanvas);
    const img = this.scene.make.image({ x: 0, y: 0, key: texKey, add: false })
      .setOrigin(0, 0).setDisplaySize(b.w * S, b.h * S);
    this.masterRT.draw(img, 0, 0);
    img.destroy();
    this.scene.textures.remove(texKey);
  }

  /* ------------------------------------------------------------------ */
  /*  PAINT A CELL — draw directly into masterRT, then re-stamp labels */
  /* ------------------------------------------------------------------ */
  _drawPaintCell(col, row, hexColor) {
    const S = this._rtScale;
    const lx = col * this.cellW * S;
    const ly = row * this.cellH * S;
    const lw = Math.ceil(this.cellW * S) + 1;
    const lh = Math.ceil(this.cellH * S) + 1;

    const v = 0.82 + Math.random() * 0.18;
    const r = ((hexColor >> 16) & 0xff) * v | 0;
    const g = ((hexColor >> 8) & 0xff) * v | 0;
    const b2 = (hexColor & 0xff) * v | 0;
    const varied = (r << 16) | (g << 8) | b2;

    this.masterRT.fill(varied, 1, lx, ly, lw, lh);
  }

  /**
   * Full redraw: all painted cells + active labels.
   * Called after batch fills or when labels change.
   */
  _fullRedraw() {
    this.masterRT.clear();
    this._drawTemplateHints();

    // Redraw all painted cells
    const S = this._rtScale;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.filledGrid[r][c]) continue;
        const ci = this.targetGrid[r][c];
        if (ci < 0) continue;
        const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;
        // Use consistent colour (no random variation on redraw)
        this.masterRT.fill(hex, 1, c * this.cellW * S, r * this.cellH * S,
          Math.ceil(this.cellW * S) + 1, Math.ceil(this.cellH * S) + 1);
      }
    }

    // Stamp labels on top
    this._stampLabels();
  }

  /* ------------------------------------------------------------------ */
  /*  PUBLIC API                                                        */
  /* ------------------------------------------------------------------ */

  tryFillCell(worldX, worldY) {
    const b = this.bounds;
    const col = Math.floor((worldX - b.x) / this.cellW);
    const row = Math.floor((worldY - b.y) / this.cellH);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;

    const targetColor = this.targetGrid[row][col];
    if (targetColor < 0 || this.filledGrid[row][col]) return false;

    if (this.selectedColorIndex !== targetColor) {
      this._flashWrongCell(row, col);
      return 'wrong';
    }

    this.filledGrid[row][col] = true;
    this.filledCount++;
    const hex = this._resolvedColors[this.colorMap[targetColor]] || 0xff3344;
    this._drawPaintCell(col, row, hex);
    this._trackRegion(col, row);

    // If a region just completed, do full redraw to erase old baked-in labels
    if (this._needsFullRedraw) {
      this._needsFullRedraw = false;
      this._fullRedraw();
    } else {
      this._stampLabels();
    }
    return true;
  }

  fillCellDirect(row, col, skipRedraw) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    const ci = this.targetGrid[row][col];
    if (ci < 0 || this.filledGrid[row][col]) return false;
    this.filledGrid[row][col] = true;
    this.filledCount++;
    const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;
    this._drawPaintCell(col, row, hex);
    this._trackRegion(col, row);
    if (!skipRedraw) this._stampLabels();
    return true;
  }

  /** Call after batch fillCellDirect(…, true) */
  updateDisplay() {
    if (this._needsFullRedraw) {
      this._needsFullRedraw = false;
      this._fullRedraw();
    } else {
      this._stampLabels();
    }
  }

  _trackRegion(col, row) {
    const regionId = this._regionIdGrid[row]?.[col];
    if (regionId == null || regionId < 0) return;
    this._regionFillCount[regionId]++;
    const reg = this._regions[regionId];
    if (!reg) return;
    if (this._regionFillCount[regionId] >= reg.totalCells) {
      // Region complete — hide its labels
      for (const lbl of this._labels) {
        if (lbl.regionId === regionId) lbl.visible = false;
      }
      // Flag: need full redraw to erase old baked-in labels from RT
      this._needsFullRedraw = true;
    }
  }

  fillRemaining() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0 || this.filledGrid[r][c]) continue;
        this.filledGrid[r][c] = true;
        this._trackRegion(c, r);
      }
    }
    this.filledCount = this.totalPaintable;
    this._fullRedraw();
  }

  _flashWrongCell(row, col) {
    const b = this.bounds;
    const cx = b.x + col * this.cellW;
    const cy = b.y + row * this.cellH;
    const flash = this.scene.add.rectangle(
      cx + this.cellW / 2, cy + this.cellH / 2, this.cellW, this.cellH
    ).setStrokeStyle(2, 0xff0000, 0.9).setFillStyle(0xff0000, 0).setDepth(5);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
  }

  /* ------------------------------------------------------------------ */
  /*  FLOOD FILL BFS                                                    */
  /* ------------------------------------------------------------------ */

  getFloodRegion(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const targetCI = this.targetGrid[row][col];
    if (targetCI < 0 || this.filledGrid[row][col]) return null;

    const GAP = 3;
    const vis = Array.from({ length: this.rows }, () => new Uint8Array(this.cols));
    const inR = Array.from({ length: this.rows }, () => new Uint8Array(this.cols));
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    const all = [], seeds = [{ r: row, c: col }];
    vis[row][col] = 1;

    while (seeds.length) {
      const fq = [seeds.shift()], rc = [];
      while (fq.length) {
        const { r, c } = fq.shift();
        if (inR[r][c]) continue;
        inR[r][c] = 1; rc.push({ r, c });
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
              !inR[nr][nc] && !vis[nr][nc] && !this.filledGrid[nr][nc] &&
              this.targetGrid[nr][nc] === targetCI) { vis[nr][nc] = 1; fq.push({ r: nr, c: nc }); }
        }
      }
      all.push(...rc);
      for (const { r, c } of rc) {
        for (let dr = -GAP; dr <= GAP; dr++) for (let dc = -GAP; dc <= GAP; dc++) {
          if (Math.abs(dr) + Math.abs(dc) > GAP) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
              !vis[nr][nc] && !inR[nr][nc] && !this.filledGrid[nr][nc] &&
              this.targetGrid[nr][nc] === targetCI) { vis[nr][nc] = 1; seeds.push({ r: nr, c: nc }); }
        }
      }
    }
    if (!all.length) return null;

    // BFS layers from tap point
    const lv = Array.from({ length: this.rows }, () => new Uint8Array(this.cols));
    const cs = new Set(all.map(c => `${c.r},${c.c}`));
    const layers = [], bq = [{ r: row, c: col }];
    lv[row][col] = 1;
    while (bq.length) {
      const layer = [], sz = bq.length;
      for (let i = 0; i < sz; i++) {
        const { r, c } = bq.shift(); layer.push({ r, c });
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols &&
              !lv[nr][nc] && cs.has(`${nr},${nc}`)) { lv[nr][nc] = 1; bq.push({ r: nr, c: nc }); }
        }
      }
      if (layer.length) layers.push(layer);
    }
    const reached = new Set();
    for (const l of layers) for (const c of l) reached.add(`${c.r},${c.c}`);
    const rem = all.filter(c => !reached.has(`${c.r},${c.c}`));
    if (rem.length) layers.push(rem);

    return { layers, colorIndex: targetCI, totalCells: all.length };
  }

  /* ------------------------------------------------------------------ */
  /*  HELPERS                                                           */
  /* ------------------------------------------------------------------ */

  getProgress() { return this.totalPaintable ? this.filledCount / this.totalPaintable : 1; }
  isComplete() { return this.getProgress() >= (PAINT.PBN_COMPLETION_THRESHOLD || 0.75); }
  setSelectedColor(i) { this.selectedColorIndex = Phaser.Math.Clamp(i, 0, this.colorMap.length - 1); }
  getSelectedColorName() { return this.colorMap[this.selectedColorIndex]; }
  getSelectedColorHex() { return this._resolvedColors[this.getSelectedColorName()] || 0xffffff; }
  getCellCost() { return this.costPerCell[this.selectedColorIndex] || 1; }
  getFloodCost(region) { return region ? (this.costPerCell[region.colorIndex] || 1) * region.totalCells : 0; }

  getCellAt(worldX, worldY) {
    const col = Math.floor((worldX - this.bounds.x) / this.cellW);
    const row = Math.floor((worldY - this.bounds.y) / this.cellH);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  serialize() {
    return { filledGrid: this.filledGrid.map(r => [...r]), filledCount: this.filledCount, selectedColorIndex: this.selectedColorIndex };
  }

  restore(saved) {
    if (!saved) return;
    this.filledGrid = saved.filledGrid;
    this.filledCount = saved.filledCount;
    this.selectedColorIndex = saved.selectedColorIndex || 0;
    // Re-count region fills + hide completed labels
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.filledGrid[r][c]) this._trackRegion(c, r);
      }
    }
    this._fullRedraw();
  }

  destroy() {
    if (this.masterRT) this.masterRT.destroy();
    if (this._gfx) this._gfx.destroy();
    this._labelCanvas = null;
    this.numberTexts = [];
  }

  hide() {
    // Keep paint visible — just hide labels by clearing and redrawing without them
    if (!this.masterRT) return;
    const S = this._rtScale;
    this.masterRT.clear();
    this._drawTemplateHints();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.filledGrid[r][c]) continue;
        const ci = this.targetGrid[r][c];
        if (ci < 0) continue;
        const hex = this._resolvedColors[this.colorMap[ci]] || 0xff3344;
        this.masterRT.fill(hex, 1, c * this.cellW * S, r * this.cellH * S,
          Math.ceil(this.cellW * S) + 1, Math.ceil(this.cellH * S) + 1);
      }
    }
    // No _stampLabels() — labels hidden
  }

  show() {
    if (this.masterRT) {
      this.masterRT.setVisible(true);
      this._fullRedraw(); // redraw with labels
    }
  }
}
