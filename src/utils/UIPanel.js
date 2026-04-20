import Phaser from 'phaser';

// 9-slice panel using 9 pre-sliced images (corners fixed, edges stretched, center fills).
// Supports multiple slicesets (frame, label, etc.) via slicePrefix option.
//
// Expected texture keys: `${slicePrefix}_tl`, _t, _tr, _l, _c, _r, _bl, _b, _br
//
// Usage:
//   const card = UIPanel.create(scene, {
//     x, y, width: 300, height: 380,
//     slicePrefix: 'frame',     // texture key prefix (default: 'frame')
//     nativeCorner: 133,        // native corner size of source (default: 133)
//     tint: 0xffffff,           // white = untinted (native color)
//     cornerSize: 48,           // rendered corner size (auto if null)
//   });
//
//   card.resize(w, h);
//   card.setTint(color);

const DEFAULT_NATIVE_CORNER = 133;

export default class UIPanel {
  static create(scene, opts = {}) {
    const cfg = {
      x: 0, y: 0,
      width: 320, height: 200,
      tint: 0xffffff,
      cornerSize: null,            // auto if null
      slicePrefix: 'frame',        // texture key prefix
      nativeCorner: DEFAULT_NATIVE_CORNER,
      ...opts,
    };

    const container = scene.add.container(cfg.x, cfg.y);
    container._cfg = cfg;

    // Fallback check — if slices not loaded, draw a placeholder rectangle
    if (!scene.textures.exists(`${cfg.slicePrefix}_c`)) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0xff00ff, 0.5);
      gfx.fillRect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height);
      container.add(gfx);
      container._gfx = gfx;
      container.resize = (w, h) => {
        cfg.width = w; cfg.height = h;
        gfx.clear();
        gfx.fillStyle(0xff00ff, 0.5);
        gfx.fillRect(-w / 2, -h / 2, w, h);
      };
      container.setTint = () => {};
      container.getSize = () => ({ width: cfg.width, height: cfg.height });
      return container;
    }

    // Create 9 image children (order: center first so corners render on top)
    const parts = ['c', 't', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'];
    const images = {};
    for (const p of parts) {
      const img = scene.add.image(0, 0, `${cfg.slicePrefix}_${p}`).setOrigin(0, 0);
      container.add(img);
      images[p] = img;
    }
    container._images = images;

    UIPanel._layout(container);
    UIPanel._applyTint(container, cfg.tint);

    // Public API
    container.resize = (w, h) => {
      cfg.width = w; cfg.height = h;
      UIPanel._layout(container);
    };
    container.setTint = (color) => {
      cfg.tint = color;
      UIPanel._applyTint(container, color);
    };
    container.clearTint = () => {
      cfg.tint = 0xffffff;
      for (const img of Object.values(container._images)) img.clearTint();
    };
    container.getSize = () => ({ width: cfg.width, height: cfg.height });
    container.setCornerSize = (s) => {
      cfg.cornerSize = s;
      UIPanel._layout(container);
    };

    // Flatten 9-slice + any children into a single RenderTexture so hover tweens
    // scale one sprite instead of 9 separate images — removes seams between slices.
    container.bake = (worldX, worldY) => {
      const w = cfg.width, h = cfg.height;
      const rt = scene.add.renderTexture(worldX, worldY, w, h).setOrigin(0.5);
      rt.draw(container, w / 2, h / 2);
      // Use LINEAR filtering so baked panels don't look pixelated when scaled
      if (rt.texture) rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      container.destroy();
      return rt;
    };

    return container;
  }

  static _layout(container) {
    const cfg = container._cfg;
    const imgs = container._images;
    const w = cfg.width, h = cfg.height;
    const hw = w / 2, hh = h / 2;

    // Auto corner size: clamp so corners never overlap
    let cs = cfg.cornerSize;
    if (cs == null) cs = Math.min(cfg.nativeCorner, Math.floor(Math.min(w, h) * 0.4));
    cs = Math.max(6, Math.min(cs, Math.floor(Math.min(w, h) / 2) - 1));

    const midW = Math.max(1, w - cs * 2);
    const midH = Math.max(1, h - cs * 2);

    // Top row
    imgs.tl.setPosition(-hw, -hh).setDisplaySize(cs, cs);
    imgs.t .setPosition(-hw + cs, -hh).setDisplaySize(midW, cs);
    imgs.tr.setPosition( hw - cs, -hh).setDisplaySize(cs, cs);

    // Middle row
    imgs.l .setPosition(-hw, -hh + cs).setDisplaySize(cs, midH);
    imgs.c .setPosition(-hw + cs, -hh + cs).setDisplaySize(midW, midH);
    imgs.r .setPosition( hw - cs, -hh + cs).setDisplaySize(cs, midH);

    // Bottom row
    imgs.bl.setPosition(-hw, hh - cs).setDisplaySize(cs, cs);
    imgs.b .setPosition(-hw + cs, hh - cs).setDisplaySize(midW, cs);
    imgs.br.setPosition( hw - cs, hh - cs).setDisplaySize(cs, cs);
  }

  static _applyTint(container, color) {
    if (!container._images) return;
    for (const img of Object.values(container._images)) {
      if (color === 0xffffff) img.clearTint();
      else img.setTint(color);
    }
  }
}
