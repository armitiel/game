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
    // Responsive scale factor — design base is 1280×720
    const ss = Math.min(W / 1280, H / 720);
    this._ss = ss; // store for sub-methods

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
    const ss = this._ss;
    const isPortrait = H > W;

    const titleY = Math.max(Math.round(60 * ss), H * 0.085);
    const titleSize = Math.min(Math.round(60 * ss), W * 0.07);
    this.add.text(cx, titleY, t('chooseMode'), {
      fontFamily: FONTS.display,
      fontSize: `${titleSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.borderDeep),
      strokeThickness: Math.round(7 * ss),
      shadow: { offsetX: 3 * ss, offsetY: 4 * ss, color: '#000000', blur: 12 * ss, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(DEPTH.content).setResolution(2)
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
    const heroW = Math.min(isPortrait ? W * 0.86 : Math.round(460 * ss), Math.round(520 * ss));
    const heroH = Math.min(isPortrait ? H * 0.48 : Math.round(340 * ss), Math.round(380 * ss));
    const heroY = titleY + Math.round(60 * ss) + heroH / 2;
    this._buildTutorialHeroCard(cx, heroY, heroW, heroH, tutorialMode, tutIdx);

    // Secondary action: "Choose a mode" pill button — smaller, below hero.
    const pillY = Math.min(H - Math.round(90 * ss), heroY + heroH / 2 + Math.round(70 * ss));
    const modesBtn = UIPill.create(this, {
      x: cx, y: pillY,
      label: t('playModes') || 'CHOOSE A MODE',
      labelSize: Math.round(22 * ss),
      fill: COLORS.pillDark,
      textColor: '#ffffff',
      stroke: COLORS.border,
      borderWidth: Math.round(4 * ss),
      height: Math.round(54 * ss),
      paddingX: Math.round(28 * ss),
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

    // Keyboard shortcuts
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-T', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    this.input.keyboard.on('keydown-M', () => this.scene.restart({ mode: null, showModes: true }));
  }

  _buildTutorialHeroCard(x, y, w, h, m, tutIdx) {
    const ss = this._ss;
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
    const titlePillW = Math.min(w * 0.7, Math.round(280 * ss));
    const titlePill = UIPanel.create(this, {
      x: 0, y: h * 0.14,
      width: titlePillW, height: Math.round((SIZES.pillH + 6) * ss),
      slicePrefix: 'label',
      nativeCorner: 31,
      tint: 0xffffff,
    });
    panel.add(titlePill);

    const titleLabel = this.add.text(0, h * 0.14, m.name, {
      fontFamily: FONTS.display,
      fontSize: `${Math.round(30 * ss)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.accentStroke),
      strokeThickness: Math.round(5 * ss),
      shadow: { offsetX: 1 * ss, offsetY: 2 * ss, color: '#000000', blur: 4 * ss, fill: true },
    }).setOrigin(0.5).setResolution(2);
    panel.add(titleLabel);

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
    const ss = this._ss;
    const isPortrait = H > W;

    // Title — bold Bungee with white→accent gradient + dark stroke
    const titleY = Math.max(Math.round(60 * ss), H * 0.085);
    const titleSize = Math.min(Math.round(60 * ss), W * 0.07);
    this.add.text(cx, titleY, t('chooseMode'), {
      fontFamily: FONTS.display,
      fontSize: `${titleSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.borderDeep),
      strokeThickness: Math.round(7 * ss),
      shadow: { offsetX: 3 * ss, offsetY: 4 * ss, color: '#000000', blur: 12 * ss, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(DEPTH.content).setResolution(2)
      .setTint(0xffffff, 0xffffff, COLORS.accent, COLORS.accent);

    const modes = [
      { key: 'stealth', name: t('stealthName'), icon: 'icon_stealth', ...MODE_COLORS.stealth, levels: this.getLevelsForMode('stealth') },
      { key: 'puzzle',  name: t('puzzleName'),  icon: 'icon_puzzle',  ...MODE_COLORS.puzzle,  levels: this.getLevelsForMode('puzzle')  },
      { key: 'tower',   name: t('towerName'),   icon: 'icon_tower',   ...MODE_COLORS.tower,   levels: this.getLevelsForMode('tower')   },
    ];

    // Layout — scale card sizes with ss
    const gap = Math.round(SIZES.cardGap * ss);
    const tutH = Math.round(75 * ss);
    const availH = H - titleY - tutH - Math.round(80 * ss);
    const availW = W - Math.round(40 * ss);

    let cardW, cardH, layout;
    if (isPortrait) {
      layout = 'column';
      cardW = Math.min(Math.round(460 * ss), availW);
      cardH = Math.min(Math.round(220 * ss), (availH - 2 * gap) / 3);
    } else {
      layout = 'row';
      const totalGap = 2 * gap;
      cardW = Math.min(Math.round(380 * ss), (availW - totalGap) / 3);
      cardH = Math.min(Math.round(480 * ss), availH);
    }

    const startY = titleY + Math.round(70 * ss) + cardH / 2;
    const startX = layout === 'row'
      ? cx - (3 * cardW + 2 * gap) / 2 + cardW / 2
      : cx;

    modes.forEach((m, i) => {
      const x = layout === 'row' ? startX + i * (cardW + gap) : cx;
      const y = layout === 'row' ? startY : startY + i * (cardH + gap);
      this._buildModeCard(x, y, cardW, cardH, m, layout);

      this.input.keyboard.on(`keydown-${i + 1}`, () => this._selectMode(m));
    });

    // Back button (top-left) — returns to tutorial hub (only if not yet completed)
    if (!this._tutorialDone) {
      const backPill = UIPill.create(this, {
        x: Math.round(70 * ss), y: Math.round(60 * ss),
        label: '< BACK',
        labelSize: Math.round(18 * ss),
        fill: COLORS.pillDark,
        textColor: '#ffffff',
        stroke: COLORS.border,
        borderWidth: Math.round(4 * ss),
        height: Math.round(44 * ss),
        paddingX: Math.round(18 * ss),
      });
      backPill.setDepth(DEPTH.content);
      const backHit = this.add.rectangle(Math.round(70 * ss), Math.round(60 * ss), backPill._w + 20, backPill._h + 20, 0x000000, 0)
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
        const tutY = H - Math.round(45 * ss);
        const tutBtn = this.add.text(cx, tutY, t('tutorial'), {
          fontFamily: FONTS.display,
          fontSize: `${Math.round(34 * ss)}px`,
          fontStyle: 'bold',
          color: '#aaffdd',
          stroke: '#000000',
          strokeThickness: Math.round(6 * ss),
          shadow: { offsetX: 2 * ss, offsetY: 2 * ss, color: '#000000', blur: 6 * ss, fill: true },
        }).setOrigin(0.5).setDepth(DEPTH.content).setAlpha(0.85).setResolution(2)
          .setInteractive({ useHandCursor: true });

        tutBtn.on('pointerover', () => this.tweens.add({ targets: tutBtn, scale: 1.08, alpha: 1, duration: 120 }));
        tutBtn.on('pointerout',  () => this.tweens.add({ targets: tutBtn, scale: 1, alpha: 0.85, duration: 120 }));
        tutBtn.on('pointerup',   () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
      }

      this.input.keyboard.on('keydown-T', () => this.scene.start('IntroScene', { levelIndex: tutIdx }));
    }
  }

  _buildModeCard(x, y, w, h, m, layout) {
    const ss = this._ss;
    const panel = UIPanel.create(this, {
      x: 0, y: 0, width: w, height: h,
      tint: m.tint,
    });

    const isRow = (layout === 'row');
    const iconSize = isRow ? Math.min(h * 0.45, w * 0.55) : Math.min(h * 0.7, w * 0.32);
    const iconX = isRow ? 0 : -w / 2 + iconSize * 0.7 + Math.round(14 * ss);
    const iconY = isRow ? -h * 0.18 : 0;

    if (this.textures.exists(m.icon)) {
      const icon = this.add.image(iconX, iconY, m.icon).setDisplaySize(iconSize, iconSize);
      panel.add(icon);
    }

    const pillsX = isRow ? 0 : -w / 2 + iconSize + Math.round(32 * ss) + (w - iconSize - Math.round(50 * ss)) / 2;
    const titlePillY = isRow ? h * 0.16 : -h * 0.12;

    const titlePillW = Math.min(w * 0.80, Math.round(260 * ss));
    const titlePillH = Math.round(SIZES.pillH * 1.35 * ss);
    const titlePill = UIPanel.create(this, {
      x: pillsX, y: titlePillY,
      width: titlePillW, height: titlePillH,
      slicePrefix: 'label',
      nativeCorner: 31,
      tint: 0xffffff,
    });
    panel.add(titlePill);

    const titleFontSize = Math.round((isRow ? 30 : 32) * ss);
    const titleLabel = this.add.text(pillsX, titlePillY, m.name, {
      fontFamily: FONTS.display,
      fontSize: `${titleFontSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.accentStroke),
      strokeThickness: Math.round(5 * ss),
      shadow: { offsetX: 1 * ss, offsetY: 2 * ss, color: '#000000', blur: 4 * ss, fill: true },
    }).setOrigin(0.5).setResolution(2);
    panel.add(titleLabel);

    const lvlCount = m.levels.length;
    const countText = `${lvlCount} ${lvlCount === 1 ? 'LEVEL' : 'LEVELS'}`;
    const countY = isRow ? h * 0.30 : h * 0.20;

    const countPill = UIPill.create(this, {
      x: pillsX, y: countY,
      label: countText,
      labelSize: Math.round(18 * ss),
      fill: m.pillFill,
      textColor: m.pillText,
      textStroke: '#000000',
      textStrokeWidth: Math.round(4 * ss),
      stroke: COLORS.border,
      borderWidth: Math.round(4 * ss),
      height: Math.round(42 * ss),
      paddingX: Math.round(20 * ss),
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
    const ss = this._ss;
    const isPortrait = H > W;
    const levels = this.getLevelsForMode(modeKey);
    const modeNames = { stealth: t('stealthName'), puzzle: t('puzzleName'), tower: t('towerName') };
    const mc = MODE_COLORS[modeKey] || MODE_COLORS.stealth;
    const gap = Math.round(SIZES.cardGap * ss);

    // Home (back) button — top-left
    const homePill = UIPill.create(this, {
      x: Math.round(70 * ss), y: Math.round(60 * ss),
      label: '< BACK',
      labelSize: Math.round(18 * ss),
      fill: COLORS.pillDark,
      textColor: '#ffffff',
      stroke: COLORS.border,
      borderWidth: Math.round(4 * ss),
      height: Math.round(44 * ss),
      paddingX: Math.round(18 * ss),
    });
    homePill.setDepth(DEPTH.content);

    const homeHit = this.add.rectangle(Math.round(70 * ss), Math.round(60 * ss), homePill._w + 20, homePill._h + 20, 0x000000, 0)
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
    const titleY = Math.max(Math.round(70 * ss), H * 0.09);
    this.add.text(cx, titleY, modeNames[modeKey] || modeKey.toUpperCase(), {
      fontFamily: FONTS.display,
      fontSize: `${Math.min(Math.round(54 * ss), W * 0.06)}px`,
      fontStyle: 'bold',
      color: mc.cssText,
      stroke: hex(COLORS.borderDeep),
      strokeThickness: Math.round(7 * ss),
      shadow: { offsetX: 3 * ss, offsetY: 4 * ss, color: '#000000', blur: 10 * ss, fill: true, stroke: true },
    }).setOrigin(0.5).setDepth(DEPTH.content).setResolution(2);

    // Layout
    const availH = H - titleY - Math.round(120 * ss);
    const availW = W - Math.round(80 * ss);

    let cols, cardW, cardH;
    if (isPortrait) {
      cols = Math.min(2, levels.length);
      cardW = Math.min(Math.round(360 * ss), (availW - (cols - 1) * gap) / cols);
      cardH = cardW * 1.2;
    } else {
      cols = Math.min(levels.length, 4);
      cardW = Math.min(Math.round(SIZES.cardW * ss), (availW - (cols - 1) * gap) / cols);
      cardH = Math.min(Math.round(SIZES.cardH * ss), availH * 0.85);
    }

    const startY = titleY + Math.round(80 * ss) + cardH / 2;
    const totalRowW = cols * cardW + (cols - 1) * gap;
    const startX = cx - totalRowW / 2 + cardW / 2;

    levels.forEach((level, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
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
    const ss = this._ss;
    const panel = UIPanel.create(this, {
      x: 0, y: 0, width: w, height: h,
      tint: mc.tint,
    });

    const name = this.add.text(0, -h * 0.15, t(level.name), {
      fontFamily: FONTS.display,
      fontSize: `${Math.min(Math.round(36 * ss), w * 0.14)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: hex(COLORS.borderDeep),
      strokeThickness: Math.round(6 * ss),
      shadow: { offsetX: 2 * ss, offsetY: 3 * ss, color: '#000000', blur: 6 * ss, fill: true },
      align: 'center',
      wordWrap: { width: w - Math.round(30 * ss) },
    }).setOrigin(0.5).setResolution(2);
    panel.add(name);

    const desc = this.add.text(0, h * 0.18, t(level.description), {
      fontFamily: FONTS.body,
      fontSize: `${Math.min(Math.round(18 * ss), w * 0.07)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: Math.round(3 * ss),
      align: 'center',
      lineSpacing: Math.round(5 * ss),
      wordWrap: { width: w - Math.round(30 * ss) },
    }).setOrigin(0.5).setAlpha(0.92).setResolution(2);
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