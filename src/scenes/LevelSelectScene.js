import Phaser from 'phaser';
import { LEVELS, STEALTH_LEVELS, PUZZLE_LEVELS, TOWER_LEVELS, LEVEL_TUTORIAL } from '../config/levels.js';
import { t } from '../config/i18n.js';
import { COLORS, MODE_COLORS, FONTS, SIZES, DEPTH, hex } from '../config/theme.js';
import UIPanel from '../utils/UIPanel.js';
import UIPill from '../utils/UIPill.js';

export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data) {
    this._selectedMode = (data && data.mode) || null;
  }

  create() {
    try {
      document.querySelectorAll('div[data-intro-overlay]').forEach(el => {
        try { el.remove(); } catch (e) {}
      });
    } catch (e) {}

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;

    // Background — cartoon city night
    const bgKey = this.textures.exists('bg_menu') ? 'bg_menu' : 'bckg';
    const bg = this.add.image(cx, H / 2, bgKey);
    const scale = Math.max(W / bg.width, H / bg.height);
    bg.setScale(scale).setDepth(DEPTH.bg);

    // Soft dark vignette for contrast
    this.add.rectangle(cx, H / 2, W, H, COLORS.bgDeep, 0.35).setDepth(DEPTH.bgFx);

    if (!this._selectedMode) {
      this.showModeSelect(W, H);
    } else {
      this.showLevelCards(W, H, this._selectedMode);
    }

    this.input.keyboard.on('keydown-ESC', () => {
      if (this._selectedMode) this.scene.restart({ mode: null });
      else this.scene.start('MenuScene');
    });

    this._initW = W; this._initH = H;
    this._resizeHandler = (gs) => {
      if (!this.sys || !this.sys.isActive()) return;
      if (Math.abs(gs.width - this._initW) > 2 || Math.abs(gs.height - this._initH) > 2) {
        this.scene.restart({ mode: this._selectedMode });
      }
    };
    this.scale.on('resize', this._resizeHandler);
    this.events.once('shutdown', () => {
      try { this.scale.off('resize', this._resizeHandler); } catch (e) {}
    });
  }

  getLevelsForMode(modeKey) {
    if (modeKey === 'stealth') return STEALTH_LEVELS;
    if (modeKey === 'puzzle') return PUZZLE_LEVELS;
    if (modeKey === 'tower') return TOWER_LEVELS;
    return LEVELS.filter(l => (l.mode || 'stealth') === modeKey);
  }

  // === MODE SELECT ===

  showModeSelect(W, H) {
    const cx = W / 2;
    const isPortrait = H > W;

    // Title — bold Bungee with white→accent gradient + dark stroke
    const titleY = Math.max(60, H * 0.085);
    const titleSize = Math.min(60, W * 0.07);
    this.add.text(cx, titleY, t('chooseMode'), {
      fontFamily: FONTS.display,
      fontSize: `${titleSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.borderDeep),
      strokeThickness: 7,
      shadow: { offsetX: 3, offsetY: 4, color: '#000000', blur: 12, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(DEPTH.content)
      .setTint(0xffffff, 0xffffff, COLORS.accent, COLORS.accent);

    const modes = [
      { key: 'stealth', name: t('stealthName'), icon: 'icon_stealth', ...MODE_COLORS.stealth, levels: this.getLevelsForMode('stealth') },
      { key: 'puzzle',  name: t('puzzleName'),  icon: 'icon_puzzle',  ...MODE_COLORS.puzzle,  levels: this.getLevelsForMode('puzzle')  },
      { key: 'tower',   name: t('towerName'),   icon: 'icon_tower',   ...MODE_COLORS.tower,   levels: this.getLevelsForMode('tower')   },
    ];

    // Layout
    const tutH = 60;
    const availH = H - titleY - tutH - 80;
    const availW = W - 40;

    let cardW, cardH, layout;
    if (isPortrait) {
      layout = 'column';
      cardW = Math.min(380, availW);
      cardH = Math.min(180, (availH - 2 * SIZES.cardGap) / 3);
    } else {
      layout = 'row';
      const totalGap = 2 * SIZES.cardGap;
      cardW = Math.min(SIZES.cardW, (availW - totalGap) / 3);
      cardH = Math.min(SIZES.cardH, availH);
    }

    const startY = titleY + 70 + cardH / 2;
    const startX = layout === 'row'
      ? cx - (3 * cardW + 2 * SIZES.cardGap) / 2 + cardW / 2
      : cx;

    modes.forEach((m, i) => {
      const x = layout === 'row' ? startX + i * (cardW + SIZES.cardGap) : cx;
      const y = layout === 'row' ? startY : startY + i * (cardH + SIZES.cardGap);
      this._buildModeCard(x, y, cardW, cardH, m, layout);

      this.input.keyboard.on(`keydown-${i + 1}`, () => this._selectMode(m));
    });

    // Tutorial — small ghost link at the bottom
    const tutIdx = LEVELS.indexOf(LEVEL_TUTORIAL);
    if (tutIdx >= 0) {
      const tutY = H - 50;
      const tutBtn = this.add.text(cx, tutY, t('tutorial'), {
        fontFamily: FONTS.display,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 6, fill: true },
      }).setOrigin(0.5).setDepth(DEPTH.content)
        .setInteractive({ useHandCursor: true });

      tutBtn.on('pointerover', () => this.tweens.add({ targets: tutBtn, scale: 1.08, duration: 120 }));
      tutBtn.on('pointerout',  () => this.tweens.add({ targets: tutBtn, scale: 1, duration: 120 }));
      tutBtn.on('pointerup',   () => this.scene.start('GameScene', { levelIndex: tutIdx }));

      this.input.keyboard.on('keydown-T', () => this.scene.start('GameScene', { levelIndex: tutIdx }));
    }
  }

  _buildModeCard(x, y, w, h, m, layout) {
    // Build panel + children at local (0,0), then flatten to a single RenderTexture.
    // Scaling one sprite on hover avoids subpixel seams between 9-slice pieces.
    const panel = UIPanel.create(this, {
      x: 0, y: 0, width: w, height: h,
      tint: m.tint,
    });

    const isRow = (layout === 'row');
    const iconSize = isRow ? Math.min(h * 0.45, w * 0.55) : Math.min(h * 0.7, w * 0.32);
    const iconX = isRow ? 0 : -w / 2 + iconSize * 0.7 + 14;
    const iconY = isRow ? -h * 0.18 : 0;

    if (this.textures.exists(m.icon)) {
      const icon = this.add.image(iconX, iconY, m.icon).setDisplaySize(iconSize, iconSize);
      panel.add(icon);
    }

    const pillsX = isRow ? 0 : -w / 2 + iconSize + 32 + (w - iconSize - 50) / 2;
    const titlePillY = isRow ? h * 0.18 : -h * 0.16;

    const titlePill = UIPill.create(this, {
      x: pillsX, y: titlePillY,
      label: m.name,
      labelSize: isRow ? 22 : 24,
      fill: m.pillFill,
      textColor: m.pillText,
      textStroke: '#000000',
      textStrokeWidth: 4,
      stroke: COLORS.border,
      borderWidth: 4,
      height: SIZES.pillH,
      paddingX: 24,
    });
    panel.add(titlePill);

    const lvlCount = m.levels.length;
    const countText = `${lvlCount} ${lvlCount === 1 ? 'LEVEL' : 'LEVELS'}`;
    const countY = isRow ? h * 0.36 : h * 0.16;

    const countPillW = Math.min(w * 0.62, 160);
    const countPillH = 42;
    const countPill = UIPanel.create(this, {
      x: pillsX, y: countY,
      width: countPillW, height: countPillH,
      slicePrefix: 'label',
      nativeCorner: 31,
      tint: 0xffffff,
    });
    panel.add(countPill);

    const countLabel = this.add.text(pillsX, countY, countText, {
      fontFamily: FONTS.display,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.accentStroke),
      strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    panel.add(countLabel);

    // Flatten to single sprite positioned at (x, y)
    const card = panel.bake(x, y);
    card.setDepth(DEPTH.panel);
    card._pressed = false;

    // Hit area as sibling at fixed size — hover stays stable
    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(DEPTH.panel + 1);

    this.time.delayedCall(300, () => {
      if (hit && hit.scene) hit.setInteractive({ useHandCursor: true });
    });

    const animTo = (s) => this.tweens.add({ targets: card, scaleX: s, scaleY: s, duration: 100, ease: 'Quad.easeOut' });

    hit.on('pointerover', () => animTo(1.04));
    hit.on('pointerout', () => { card._pressed = false; animTo(1); });
    hit.on('pointerdown', () => { card._pressed = true; animTo(0.96); });
    hit.on('pointerupoutside', () => { card._pressed = false; animTo(1); });
    hit.on('pointerup', () => {
      if (!card._pressed) return;
      card._pressed = false;
      this.tweens.add({
        targets: card, scaleX: 1.08, scaleY: 1.08,
        duration: 90, yoyo: true,
        onComplete: () => this._selectMode(m),
      });
    });

    return card;
  }

  _selectMode(m) {
    if (m.levels.length === 1) {
      const idx = LEVELS.indexOf(m.levels[0]);
      this.scene.start('IntroScene', { levelIndex: idx });
    } else {
      this.scene.restart({ mode: m.key });
    }
  }

  // === LEVEL CARDS ===

  showLevelCards(W, H, modeKey) {
    const cx = W / 2;
    const isPortrait = H > W;
    const levels = this.getLevelsForMode(modeKey);
    const modeNames = { stealth: t('stealthName'), puzzle: t('puzzleName'), tower: t('towerName') };
    const mc = MODE_COLORS[modeKey] || MODE_COLORS.stealth;

    // Home (back) button — top-left
    const homePill = UIPill.create(this, {
      x: 70, y: 60,
      label: '< BACK',
      labelSize: 18,
      fill: COLORS.pillDark,
      textColor: '#ffffff',
      stroke: COLORS.border,
      borderWidth: 4,
      height: 44,
      paddingX: 18,
    });
    homePill.setDepth(DEPTH.content);

    const homeHit = this.add.rectangle(70, 60, homePill._w + 20, homePill._h + 20, 0x000000, 0)
      .setDepth(DEPTH.content);
    this.time.delayedCall(300, () => {
      if (homeHit && homeHit.scene) homeHit.setInteractive({ useHandCursor: true });
    });
    let _homePressed = false;
    homeHit.on('pointerdown', () => { _homePressed = true; this.tweens.add({ targets: homePill, scale: 0.94, duration: 80 }); });
    homeHit.on('pointerout',  () => { _homePressed = false; this.tweens.add({ targets: homePill, scale: 1, duration: 80 }); });
    homeHit.on('pointerupoutside', () => { _homePressed = false; this.tweens.add({ targets: homePill, scale: 1, duration: 80 }); });
    homeHit.on('pointerup', () => {
      if (!_homePressed) return;
      this.scene.restart({ mode: null });
    });

    // Title
    const titleY = Math.max(70, H * 0.09);
    this.add.text(cx, titleY, modeNames[modeKey] || modeKey.toUpperCase(), {
      fontFamily: FONTS.display,
      fontSize: `${Math.min(54, W * 0.06)}px`,
      fontStyle: 'bold',
      color: mc.cssText,
      stroke: hex(COLORS.borderDeep),
      strokeThickness: 7,
      shadow: { offsetX: 3, offsetY: 4, color: '#000000', blur: 10, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(DEPTH.content);

    // Layout
    const availH = H - titleY - 120;
    const availW = W - 80;

    let cols, cardW, cardH;
    if (isPortrait) {
      cols = Math.min(2, levels.length);
      cardW = Math.min(360, (availW - (cols - 1) * SIZES.cardGap) / cols);
      cardH = cardW * 1.2;
    } else {
      cols = Math.min(levels.length, 4);
      cardW = Math.min(SIZES.cardW, (availW - (cols - 1) * SIZES.cardGap) / cols);
      cardH = Math.min(SIZES.cardH, availH * 0.85);
    }

    const startY = titleY + 80 + cardH / 2;
    const totalRowW = cols * cardW + (cols - 1) * SIZES.cardGap;
    const startX = cx - totalRowW / 2 + cardW / 2;

    levels.forEach((level, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + SIZES.cardGap);
      const y = startY + row * (cardH + SIZES.cardGap);
      const globalIdx = LEVELS.indexOf(level);

      this._buildLevelCard(x, y, cardW, cardH, level, globalIdx, mc);

      if (i < 9) {
        this.input.keyboard.on(`keydown-${i + 1}`, () => {
          this.scene.start('IntroScene', { levelIndex: globalIdx });
        });
      }
    });
  }

  _buildLevelCard(x, y, w, h, level, globalIdx, mc) {
    const panel = UIPanel.create(this, {
      x: 0, y: 0, width: w, height: h,
      tint: mc.tint,
    });

    const name = this.add.text(0, -h * 0.15, t(level.name), {
      fontFamily: FONTS.display,
      fontSize: `${Math.min(36, w * 0.14)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.borderDeep),
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 3, color: '#000000', blur: 6, fill: true },
      align: 'center',
      wordWrap: { width: w - 30 },
    }).setOrigin(0.5);
    panel.add(name);

    const desc = this.add.text(0, h * 0.18, t(level.description), {
      fontFamily: FONTS.body,
      fontSize: `${Math.min(18, w * 0.07)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: w - 30 },
    }).setOrigin(0.5).setAlpha(0.92);
    panel.add(desc);

    const card = panel.bake(x, y);
    card.setDepth(DEPTH.panel);
    card._pressed = false;

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(DEPTH.panel + 1);

    this.time.delayedCall(300, () => {
      if (hit && hit.scene) hit.setInteractive({ useHandCursor: true });
    });

    const animTo = (s) => this.tweens.add({ targets: card, scaleX: s, scaleY: s, duration: 100, ease: 'Quad.easeOut' });
    hit.on('pointerover', () => animTo(1.05));
    hit.on('pointerout', () => { card._pressed = false; animTo(1); });
    hit.on('pointerdown', () => { card._pressed = true; animTo(0.95); });
    hit.on('pointerupoutside', () => { card._pressed = false; animTo(1); });
    hit.on('pointerup', () => {
      if (!card._pressed) return;
      card._pressed = false;
      this.scene.start('IntroScene', { levelIndex: globalIdx });
    });
  }
}
