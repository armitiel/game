import Phaser from 'phaser';
import { COLORS, FONTS, SIZES } from '../config/theme.js';

// Cartoon-style pill — rounded label container.
// Used for: title pills (mode name), level count pills (X LEVELS), tags.
//
// Usage:
//   const pill = UIPill.create(scene, {
//     x: 0, y: 100,
//     label: 'SKRADANKA',
//     fill: 0x0a1830,        // background color
//     textColor: '#3dccff',
//     stroke: 0x000000,      // outer border color
//     borderWidth: 4,
//     height: 48,
//     paddingX: 24,
//   });
//
// Auto-sizes to text width + padding unless `width` is given.

export default class UIPill {
  static create(scene, opts = {}) {
    const cfg = {
      x: 0, y: 0,
      label: '',
      labelSize: 22,
      fontFamily: FONTS.display,
      fill: COLORS.pillDark,
      textColor: '#ffffff',
      textStroke: '#000000',
      textStrokeWidth: 4,
      stroke: COLORS.border,
      borderWidth: SIZES.pillBorder,
      height: SIZES.pillH,
      paddingX: SIZES.pillPadX,
      width: null,             // auto if null
      shadow: true,
      ...opts,
    };

    const container = scene.add.container(cfg.x, cfg.y);
    container._cfg = cfg;

    // Text first to measure
    const text = scene.add.text(0, 0, cfg.label, {
      fontFamily: cfg.fontFamily,
      fontSize: `${cfg.labelSize}px`,
      fontStyle: 'bold',
      color: cfg.textColor,
      stroke: cfg.textStroke,
      strokeThickness: cfg.textStrokeWidth,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);

    const w = cfg.width || (text.width + cfg.paddingX * 2);
    const h = cfg.height;
    const r = h / 2; // fully rounded ends

    const shadowGfx = scene.add.graphics();
    const borderGfx = scene.add.graphics();
    const fillGfx   = scene.add.graphics();

    if (cfg.shadow) {
      shadowGfx.fillStyle(0x000000, 0.45);
      shadowGfx.fillRoundedRect(-w / 2 + 1, -h / 2 + 4, w, h, r);
    }
    borderGfx.fillStyle(cfg.stroke, 1);
    borderGfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // Two-stop vertical gradient: light top, fill bottom
    const top  = _lighten(cfg.fill, 0.18);
    const bot  = cfg.fill;
    const innerW = w - cfg.borderWidth * 2;
    const innerH = h - cfg.borderWidth * 2;
    const innerR = r - cfg.borderWidth;
    fillGfx.fillStyle(bot, 1);
    fillGfx.fillRoundedRect(-w / 2 + cfg.borderWidth, -h / 2 + cfg.borderWidth, innerW, innerH, innerR);
    fillGfx.fillStyle(top, 1);
    fillGfx.fillRoundedRect(-w / 2 + cfg.borderWidth, -h / 2 + cfg.borderWidth, innerW, innerH * 0.55, innerR);

    // Top gloss line
    fillGfx.lineStyle(2, 0xffffff, 0.4);
    fillGfx.beginPath();
    fillGfx.moveTo(-w / 2 + cfg.borderWidth + r * 0.6, -h / 2 + cfg.borderWidth + 3);
    fillGfx.lineTo( w / 2 - cfg.borderWidth - r * 0.6, -h / 2 + cfg.borderWidth + 3);
    fillGfx.strokePath();

    container.add(shadowGfx);
    container.add(borderGfx);
    container.add(fillGfx);
    container.add(text);

    container._w = w;
    container._h = h;
    container._text = text;

    container.setLabel = (txt) => text.setText(txt);
    container.getSize = () => ({ width: w, height: h });

    return container;
  }
}

function _lighten(color, amount) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (Math.min(255, Math.round(r + (255 - r) * amount)) << 16)
       | (Math.min(255, Math.round(g + (255 - g) * amount)) << 8)
       |  Math.min(255, Math.round(b + (255 - b) * amount));
}
