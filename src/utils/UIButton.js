import Phaser from 'phaser';
import { COLORS, FONTS, SIZES, hex } from '../config/theme.js';
import UIPanel from './UIPanel.js';

// Procedural button — uses UIPanel for the body + label + state machine.
//
// Variants:
//   primary   — neon-filled, used for main CTA (START, PLAY)
//   secondary — outlined, neutral content
//   ghost     — text only, for links / minor actions
//   danger    — red accent, destructive
//
// Usage:
//   const btn = UIButton.create(scene, {
//     x: 400, y: 300,
//     label: 'PLAY',
//     variant: 'primary',
//     width: 240, height: 64,
//     onClick: () => scene.scene.start('GameScene'),
//   });
//
// State machine handles: idle / hover / pressed / disabled.
// Touch + mouse + keyboard friendly. Press requires pointerdown→pointerup on same target.

const VARIANT_PRESETS = {
  primary:   { tint: COLORS.accent,  fill: 0x0a2a18, label: '#00ff88', stroke: '#001a08' },
  secondary: { tint: 0x88aacc,        fill: COLORS.panelFill, label: '#ffffff', stroke: '#000000' },
  ghost:     { tint: 0x000000,        fill: 0x000000, label: '#88aacc', stroke: '#000000', noPanel: true },
  danger:    { tint: COLORS.danger,   fill: 0x2a0a0a, label: '#ff6666', stroke: '#330000' },
  mode:      { tint: COLORS.accent,   fill: COLORS.panelFill, label: '#ffffff', stroke: '#000000' },
};

export default class UIButton {
  static create(scene, opts = {}) {
    const variant = opts.variant || 'primary';
    const preset = VARIANT_PRESETS[variant] || VARIANT_PRESETS.primary;

    const cfg = {
      x: 0, y: 0,
      width: opts.width || 240,
      height: opts.height || SIZES.btnHeight,
      label: opts.label || '',
      labelSize: opts.labelSize || 28,
      onClick: opts.onClick || (() => {}),
      tint: opts.tint || preset.tint,
      fill: opts.fill || preset.fill,
      labelColor: opts.labelColor || preset.label,
      strokeColor: opts.strokeColor || preset.stroke,
      noPanel: preset.noPanel || false,
      icon: opts.icon || null,
      iconSize: opts.iconSize || 32,
      enabled: opts.enabled !== false,
      ...opts,
    };

    const container = scene.add.container(cfg.x, cfg.y);
    container._cfg = cfg;
    container._pressed = false;
    container._enabled = cfg.enabled;

    // Body — UIPanel unless ghost variant
    let panel = null;
    if (!cfg.noPanel) {
      panel = UIPanel.create(scene, {
        x: 0, y: 0,
        width: cfg.width, height: cfg.height,
        tint: cfg.tint,
        fill: cfg.fill,
        radius: SIZES.btnRadius,
        borderWidth: SIZES.btnBorder,
      });
      container.add(panel);
      container._panel = panel;
    }

    // Optional icon (left of label)
    let labelOffsetX = 0;
    if (cfg.icon && scene.textures.exists(cfg.icon)) {
      const ic = scene.add.image(-cfg.width / 2 + cfg.iconSize, 0, cfg.icon)
        .setDisplaySize(cfg.iconSize, cfg.iconSize);
      container.add(ic);
      labelOffsetX = cfg.iconSize / 2;
      container._icon = ic;
    }

    // Label
    const label = scene.add.text(labelOffsetX, 0, cfg.label, {
      fontFamily: FONTS.display,
      fontSize: `${cfg.labelSize}px`,
      fontStyle: 'bold',
      color: cfg.labelColor,
      stroke: cfg.strokeColor,
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    container.add(label);
    container._label = label;

    // Hit area (interactive zone covers the whole button)
    const hit = scene.add.rectangle(0, 0, cfg.width, cfg.height, 0x000000, 0);
    container.add(hit);
    container._hit = hit;

    // Defer interactive enable to avoid inheriting pointerdown from previous scene
    scene.time.delayedCall(150, () => {
      if (hit && hit.scene && container._enabled) {
        hit.setInteractive({ useHandCursor: true });
      }
    });

    // Press animation
    const animTo = (scale) => {
      scene.tweens.add({
        targets: container,
        scaleX: scale, scaleY: scale,
        duration: 80, ease: 'Quad.easeOut',
      });
    };

    hit.on('pointerover', () => {
      if (!container._enabled) return;
      animTo(1.04);
      if (panel) panel.setNeon(_lighten(cfg.tint, 0.3));
    });
    hit.on('pointerout', () => {
      if (!container._enabled) return;
      container._pressed = false;
      animTo(1);
      if (panel) panel.setNeon(cfg.tint);
    });
    hit.on('pointerdown', () => {
      if (!container._enabled) return;
      container._pressed = true;
      animTo(0.94);
    });
    hit.on('pointerupoutside', () => {
      container._pressed = false;
      animTo(1);
      if (panel) panel.setNeon(cfg.tint);
    });
    hit.on('pointerup', () => {
      if (!container._enabled || !container._pressed) return;
      container._pressed = false;
      // Bounce back, then fire
      scene.tweens.add({
        targets: container,
        scaleX: 1.08, scaleY: 1.08,
        duration: 90, yoyo: true, ease: 'Quad.easeOut',
        onComplete: () => {
          if (container.scene && container._enabled) cfg.onClick();
        }
      });
    });

    // Public API
    container.setLabel = (txt) => label.setText(txt);
    container.setEnabled = (on) => {
      container._enabled = on;
      container.setAlpha(on ? 1 : 0.4);
      if (on) hit.setInteractive({ useHandCursor: true });
      else hit.disableInteractive();
    };
    container.setNeon = (color) => {
      cfg.tint = color;
      if (panel) panel.setNeon(color);
    };
    container.resize = (w, h) => {
      cfg.width = w; cfg.height = h;
      if (panel) panel.resize(w, h);
      hit.setSize(w, h);
    };

    return container;
  }
}

// Lighten a hex int color toward white by `amount` (0..1)
function _lighten(color, amount) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}
