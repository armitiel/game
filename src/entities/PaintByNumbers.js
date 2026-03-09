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

    this.cellW = bounds.w / this.cols;
    this.cellH = bounds.h / this.rows;

    // Tracking
    this.filledGrid = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    this.filledCount = 0;
    this.totalPaintable = 0;

    // Count paintable cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.targetGrid[r][c] >= 0) this.totalPaintable++;
      }
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

    // Background: semi-transparent dark wall
    g.fillStyle(0x333344, 0.7);
    g.fillRect(b.x, b.y, b.w, b.h);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        const cx = b.x + c * this.cellW;
        const cy = b.y + r * this.cellH;

        if (ci >= 0) {
          // Light tint of the target color (hint)
          const hex = PAINT.COLORS[this.colorMap[ci]] || 0xffffff;
          g.fillStyle(hex, 0.12);
          g.fillRect(cx, cy, this.cellW, this.cellH);

          // Cell border
          g.lineStyle(0.5, 0xffffff, 0.2);
          g.strokeRect(cx, cy, this.cellW, this.cellH);
        }
      }
    }

    // Add number labels as text objects (grouped for cleanup)
    this.numberTexts = [];
    const fontSize = Math.max(5, Math.floor(Math.min(this.cellW, this.cellH) * 0.7));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ci = this.targetGrid[r][c];
        if (ci < 0) continue;

        const cx = b.x + c * this.cellW + this.cellW / 2;
        const cy = b.y + r * this.cellH + this.cellH / 2;

        const txt = this.scene.add.text(cx, cy, String(ci + 1), {
          font: `${fontSize}px monospace`,
          fill: '#ffffff',
        }).setOrigin(0.5).setDepth(7.2).setAlpha(0.5);

        this.numberTexts.push({ text: txt, row: r, col: c });
      }
    }
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
    const hex = PAINT.COLORS[this.colorMap[targetColor]] || 0xff3344;

    // Draw filled cell
    const alpha = Phaser.Math.FloatBetween(0.65, 0.9);
    this.paintGfx.fillStyle(hex, alpha);
    this.paintGfx.fillRect(cx, cy, this.cellW, this.cellH);

    // Random paint streaks
    if (Math.random() > 0.5) {
      this.paintGfx.fillStyle(0xffffff, 0.15);
      this.paintGfx.fillRect(cx + 1, cy + this.cellH * 0.3, this.cellW - 2, 1);
    }

    // Hide the number text for this cell
    const entry = this.numberTexts.find(t => t.row === row && t.col === col);
    if (entry) entry.text.setVisible(false);

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
        const hex = PAINT.COLORS[this.colorMap[ci]] || 0xff3344;
        this.paintGfx.fillStyle(hex, 0.5);
        this.paintGfx.fillRect(cx, cy, this.cellW, this.cellH);

        // Hide number
        const entry = this.numberTexts.find(t => t.row === r && t.col === c);
        if (entry) entry.text.setVisible(false);
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
    return PAINT.COLORS[this.getSelectedColorName()] || 0xffffff;
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
        const hex = PAINT.COLORS[this.colorMap[ci]] || 0xff3344;
        this.paintGfx.fillStyle(hex, 0.75);
        this.paintGfx.fillRect(cx, cy, this.cellW, this.cellH);

        // Hide number text
        const entry = this.numberTexts.find(t => t.row === r && t.col === c);
        if (entry) entry.text.setVisible(false);
      }
    }
  }

  /**
   * Destroy all graphics and text objects.
   */
  destroy() {
    this.templateGfx.destroy();
    this.paintGfx.destroy();
    this.numberTexts.forEach(t => t.text.destroy());
    this.numberTexts = [];
  }

  /**
   * Hide template+numbers but keep painted cells visible on the wall.
   */
  hide() {
    this.templateGfx.setVisible(false);
    // paintGfx stays visible — shows progress on the wall!
    this.numberTexts.forEach(t => t.text.setVisible(false));
  }

  /**
   * Show template+paint (used when restoring on re-entry).
   */
  show() {
    this.templateGfx.setVisible(true);
    this.paintGfx.setVisible(true);
    // Show only unfilled number texts
    this.numberTexts.forEach(t => {
      t.text.setVisible(!this.filledGrid[t.row][t.col]);
    });
  }
}
