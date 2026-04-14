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
    // Step 0 = tutorial-first hub; Step 1 = mode picker; Step 2 = level list
    // Default is step 0 on fresh entry; `showModes: true` jumps to step 1
    // If tutorial was completed (this session or previously), skip hub.
    let tutDone = false;
    try { tutDone = sessionStorage.getItem('st_tutorialDone') === '1'; } catch (e) {}
    if (!tutDone) {
      try { tutDone = localStorage.getItem('st_tutorialDone') === '1'; } catch (e) {}
    }
    this._tutorialDone = tutDone;
    this._showModes = !!(data && data.showModes) || tutDone;
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

    if (this._selectedMode) {
      this.showLevelCards(W, H, this._selectedMode);
    } else if (this._showModes) {
      this.showModeSelect(W, H);
    } else {
      this.showTutorialHub(W, H);
    }

    this.input.keyboard.on('keydown-ESC', () => {
      if (this._selectedMode) this.scene.restart({ mode: null, showModes: true });
      else if (this._showModes && !this._tutorialDone) this.scene.restart({ mode: null, showModes: false });
      else this.scene.start('MenuScene');
    });

    this._initW = W; this._initH = H;
    this._resizeHandler = (gs) => {
      if (!this.sys || !this.sys.isActive()) return;
      if (Math.abs(gs.width - this._initW) > 2 || Math.abs(gs.height - this._initH) > 2) {
        this.scene.restart({ mode: this._selectedMode, showModes: this._showModes });
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

  // === TUTORIAL HUB (first screen) ===
  //
  // UI-design rationale:
  // New players land here first. A single large TUTORIAL card dominates the
  // screen (hero element). Below it sits a secondary action — a pill button
  // that continues to the mode picker. This hierarchy uses scale + isolation
  // to communicate "start here" without hiding the advanced modes.
  // Keyboard: SPACE/ENTER → tutorial, M → modes. ESC → main menu.
  showTutorialHub(W, H) {
    const cx = W / 2;
    const isPortrait = H > W;

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

    const tutIdx = LEVELS.indexOf(LEVEL_TUTORIAL);
    const tutorialMode = {
      key: 'tutorial',
      name: t('tutorialName') || 'TUTORIAL',
      desc: t('tutorialDesc') || '',
      icon: 'icon_tutorial',
      ...MODE_COLORS.tutorial,
      levels: [LEVEL_TUTORIAL],
    };

    // Hero card: large, centered, with gentle pulsing glow to invite interaction.
    const heroW = Math.min(isPortrait ? W * 0.86 : 460, 520);
    const heroH = Math.min(isPortrait ? H * 0.48 : 340, 380);
    const heroY = titleY + 60 + heroH / 2;
    this._buildTutorialHeroCard(cx, heroY, heroW, heroH, tutorialMode, tutIdx);

    // Secondary action: "Choose a mode" pill button — smaller, below hero.
    const pillY = Math.min(H - 90, heroY + heroH / 2 + 70);
    const modesBtn = UIPill.create(this, {
      x: cx, y: pillY,
      label: t('playModes') || 'CHOOSE A MODE',
      labelSize: 22,
      fill: COLORS.pillDark,
      textColor: '#ffffff',
      stroke: COLORS.border,
      borderWidth: 4,
      height: 54,
      paddingX: 28,
    });
    modesBtn.setDepth(DEPTH.content);

    const modesHit = this.add.rectangle(cx, pillY, modesBtn._w + 30, modesBtn._h + 20, 0x000000, 0)
      .setDepth(DEPTH.content + 1);
    this.time.delayedCall(300, () => {
      if (modesHit && modesHit.scene) modesHit.setInteractive({ useHandCursor: true });
    });
    let _mPressed = false;
    modesHit.on('pointerover', () => this.tweens.add({ targets: modesBtn, scale: 1.05, duration: 120 }));
    modesHit.on('pointerout', () => { _mPressed = false; this.tweens.add({ targets: modesBtn, scale: 1, duration: 120 }); });
    modesHit.on('pointerdown', () => { _mPressed = true; this.tweens.add({ targets: modesBtn, scale: 0.95, duration: 80 }); });
    modesHit.on('pointerupoutside', () => { _mPressed = false; this.tweens.add({ targets: modesBtn, scale: 1, duration: 80 }); });
    modesHit.on('pointerup', () => {
      if (!_mPressed) return;
      this.scene.restart({ mode: null, showModes: true });
    });

    // Tiny caption under the pill for affordance
    this.add.text(cx, pillY + 42, t('playModesHint') || '', {
      fontFamily: FONTS.body,
      fontSize: '14px',
      color: '#bbccdd',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH.content).setAlpha(0.8);

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-T', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-M', () => this.scene.restart({ mode: null, showModes: true }));
  }

  _buildTutorialHeroCard(x, y, w, h, m, tutIdx) {
    const panel = UIPanel.create(this, {
      x: 0, y: 0, width: w, height: h,
      tint: m.tint,
    });

    // Large icon, centered-top
    const iconSize = Math.min(h * 0.48, w * 0.45);
    if (this.textures.exists(m.icon)) {
      const icon = this.add.image(0, -h * 0.16, m.icon).setDisplaySize(iconSize, iconSize);
      panel.add(icon);
    }

    // Title pill
    const titlePillW = Math.min(w * 0.7, 280);
    const titlePill = UIPanel.create(this, {
      x: 0, y: h * 0.14,
      width: titlePillW, height: SIZES.pillH + 6,
      slicePrefix: 'label',
      nativeCorner: 31,
      tint: 0xffffff,
    });
    panel.add(titlePill);

    const titleLabel = this.add.text(0, h * 0.14, m.name, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.accentStroke),
      strokeThickness: 5,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    panel.add(titleLabel);

    // Descriptor line
    if (m.desc) {
      const desc = this.add.text(0, h * 0.34, m.desc, {
        fontFamily: FONTS.body,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: w - 40 },
      }).setOrigin(0.5).setAlpha(0.95);
      panel.add(desc);
    }

    const card = panel.bake(x, y);
    card.setDepth(DEPTH.panel);
    card._pressed = false;

    // Gentle pulse so the user sees this is the recommended starting point
    this.tweens.add({
      targets: card,
      scale: 1.03,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(DEPTH.panel + 1);
    this.time.delayedCall(300, () => {
      if (hit && hit.scene) hit.setInteractive({ useHandCursor: true });
    });

    hit.on('pointerover', () => { try { this.tweens.killTweensOf(card); } catch(e){} this.tweens.add({ targets: card, scale: 1.07, duration: 120 }); });
    hit.on('pointerout',  () => {
      card._pressed = false;
      try { this.tweens.killTweensOf(card); } catch(e){}
      this.tweens.add({ targets: card, scale: 1.03, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    hit.on('pointerdown', () => { card._pressed = true; this.tweens.add({ targets: card, scale: 0.96, duration: 80 }); });
    hit.on('pointerupoutside', () => { card._pressed = false; });
    hit.on('pointerup', () => {
      if (!card._pressed) return;
      card._pressed = false;
      this.scene.start('IntroScene', { levelIndex: tutIdx });
    });

    return card;
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

    // Back button (top-left) — returns to tutorial hub (only if not yet completed)
    if (!this._tutorialDone) {
      const backPill = UIPill.create(this, {
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
      backPill.setDepth(DEPTH.content);
      const backHit = this.add.rectangle(70, 60, backPill._w + 20, backPill._h + 20, 0x000000, 0)
        .setDepth(DEPTH.content + 1);
      this.time.delayedCall(300, () => {
        if (backHit && backHit.scene) backHit.setInteractive({ useHandCursor: true });
      });
      let _bPressed = false;
      backHit.on('pointerdown', () => { _bPressed = true; this.tweens.add({ targets: backPill, scale: 0.94, duration: 80 }); });
      backHit.on('pointerout',  () => { _bPressed = false; this.tweens.add({ targets: backPill, scale: 1, duration: 80 }); });
      backHit.on('pointerupoutside', () => { _bPressed = false; this.tweens.add({ targets: backPill, scale: 1, duration: 80 }); });
      backHit.on('pointerup', () => {
        if (!_bPressed) return;
        this.scene.restart({ mode: null, showModes: false });
      });
    }

    const tutIdx = LEVELS.indexOf(LEVEL_TUTORIAL);
    if (tutIdx >= 0) {
      // Tutorial shortcut at the bottom — only show once hub is retired
      if (this._tutorialDone) {
        const tutY = H - 50;
        const tutBtn = this.add.text(cx, tutY, t('tutorial'), {
          fontFamily: FONTS.display,
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#aaffdd',
          stroke: '#000000',
          strokeThickness: 5,
          shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 6, fill: true },
        }).setOrigin(0.5).setDepth(DEPTH.content).setAlpha(0.85)
          .setInteractive({ useHandCursor: true });

        tutBtn.on('pointerover', () => this.tweens.add({ targets: tutBtn, scale: 1.08, alpha: 1, duration: 120 }));
        tutBtn.on('pointerout',  () => this.tweens.add({ targets: tutBtn, scale: 1, alpha: 0.85, duration: 120 }));
        tutBtn.on('pointerup',   () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
      }

      this.input.keyboard.on('keydown-T', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
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
    const titlePillY = isRow ? h * 0.16 : -h * 0.12;

    const titlePillW = Math.min(w * 0.62, 180);
    const titlePillH = SIZES.pillH;
    const titlePill = UIPanel.create(this, {
      x: pillsX, y: titlePillY,
      width: titlePillW, height: titlePillH,
      slicePrefix: 'label',
      nativeCorner: 31,
      tint: 0xffffff,
    });
    panel.add(titlePill);

    const titleLabel = this.add.text(pillsX, titlePillY, m.name, {
      fontFamily: FONTS.display,
      fontSize: `${isRow ? 22 : 24}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.accentStroke),
      strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    panel.add(titleLabel);

    const lvlCount = m.levels.length;
    const countText = `${lvlCount} ${lvlCount === 1 ? 'LEVEL' : 'LEVELS'}`;
    const countY = isRow ? h * 0.30 : h * 0.20;

    const countPill = UIPill.create(this, {
      x: pillsX, y: countY,
      label: countText,
      labelSize: 18,
      fill: m.pillFill,
      textColor: m.pillText,
      textStroke: '#000000',
      textStrokeWidth: 4,
      stroke: COLORS.border,
      borderWidth: 4,
      height: 42,
      paddingX: 20,
    });
    panel.add(countPill);

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

    return card;
  }
}