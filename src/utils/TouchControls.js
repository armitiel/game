import Phaser from 'phaser';
import { PAINT } from '../config/gameConfig.js';

/**
 * Virtual touch controls for mobile devices.
 * Left half of screen: touch-zone D-pad (drag direction = movement)
 * Right side: large action buttons (JUMP, ACT, E)
 *
 * Exposes .left, .right, .up, .down (isDown booleans)
 * and .jumpJustPressed, .actionJustPressed (consumed on read)
 */
export default class TouchControls {
  constructor(scene) {
    this.scene = scene;

    // Direction state
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;

    // Proportional joystick intensity (0–1) for paint mode precision
    this.intensityX = 0;
    this.intensityY = 0;

    // "Just pressed" flags — consumed after read
    this._jumpJustPressed = false;
    this._actionJustPressed = false;
    this._eJustPressed = false;

    this._paintMode = false;

    // Paint fill button state (used in paint mode to trigger flood fill)
    this._paintFillJustPressed = false;
    this._paintFillHeld = false;

    // Don't create controls if no touch support
    if (!scene.sys.game.device.input.touch) return;

    this.enabled = true;
    this.buttons = [];

    this.createMovementZone(scene);
    this.createActionButtons(scene);
  }

  /**
   * Left half of screen = movement zone.
   * Touch and drag sets direction based on offset from touch origin.
   */
  createMovementZone(scene) {
    const cam = scene.cameras.main;
    // Responsive scale factor for touch controls.
    // Use height-based scaling with a mobile boost so buttons stay
    // finger-friendly on small screens (minimum ~70% of design size).
    const rawSS = Math.min(cam.width / 1280, cam.height / 720);
    const ss = Math.max(rawSS * 1.4, 0.7);
    this._ss = ss;

    const zoneW = cam.width * 0.45;
    const zoneH = cam.height;

    // Invisible touch zone covering left ~45% of screen (expands in paint mode)
    const zone = scene.add.rectangle(zoneW / 2, zoneH / 2, zoneW, zoneH, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(199)
      .setInteractive();
    this._moveZone = zone;
    this._moveZoneNormalW = zoneW;
    this._moveZoneFullW = cam.width;

    // --- Floating virtual joystick ---
    const BASE_RADIUS_NORMAL = Math.round(52 * ss);
    const BASE_RADIUS_PAINT = Math.round(120 * ss);
    const THUMB_RADIUS = Math.round(22 * ss);
    const HINT_RADIUS = Math.round(14 * ss);

    // Dynamic radius — grows in paint mode for more precise control
    const getRadius = () => this._paintMode ? BASE_RADIUS_PAINT : BASE_RADIUS_NORMAL;
    const getMaxDist = () => getRadius() - 4;

    // Orbit track — shows the path the thumb travels on
    this._joyOrbit = scene.add.circle(0, 0, getMaxDist(), 0x000000, 0)
      .setScrollFactor(0).setDepth(199).setVisible(false)
      .setStrokeStyle(Math.round(2 * ss), 0xffffff, 0.3);
    // Base ring — appears at touch origin
    this._joyBase = scene.add.circle(0, 0, getRadius(), 0xffffff, 0.15)
      .setScrollFactor(0).setDepth(199).setVisible(false)
      .setStrokeStyle(Math.round(2.5 * ss), 0xffffff, 0.4);
    // Thumb knob — follows finger within the ring
    this._joyThumb = scene.add.circle(0, 0, THUMB_RADIUS, 0xffffff, 0.45)
      .setScrollFactor(0).setDepth(200).setVisible(false);

    this.buttons.push(this._joyOrbit, this._joyBase, this._joyThumb);
    this._getRadius = getRadius;
    this._getMaxDist = getMaxDist;

    // Initial position — bottom-left corner, will move to touch point on first use
    const hintX = Math.round(110 * ss);
    const hintY = cam.height - Math.round(130 * ss);
    this._joyOrbit.setPosition(hintX, hintY).setVisible(true).setAlpha(0.25);
    this._joyBase.setPosition(hintX, hintY).setVisible(true).setAlpha(0.18);
    this._joyBase.setStrokeStyle(2.5, 0xffffff, 0.4);
    this._joyThumb.setPosition(hintX, hintY).setVisible(true).setAlpha(0.4);

    let originX = hintX, originY = hintY;
    const DEAD_ZONE = 12;
    const DEAD_ZONE_PAINT = 16;

    zone.on('pointerdown', (pointer) => {
      originX = pointer.x;
      originY = pointer.y;
      // Resize joystick ring for current mode
      const r = getRadius();
      const md = getMaxDist();
      this._joyOrbit.setRadius(md);
      this._joyBase.setRadius(r);
      // Move joystick to touch point, active opacity
      this._joyOrbit.setPosition(originX, originY).setAlpha(0.45);
      this._joyBase.setPosition(originX, originY).setAlpha(0.2);
      this._joyThumb.setPosition(originX, originY).setAlpha(0.6);
      const dz = this._paintMode ? DEAD_ZONE_PAINT : DEAD_ZONE;
      this._updateDirection(0, 0, dz, getMaxDist());
    });

    zone.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      const maxDist = getMaxDist();
      const dz = this._paintMode ? DEAD_ZONE_PAINT : DEAD_ZONE;

      // --- Dynamic origin recentering (paint mode only) ---
      // Origin drifts toward finger proportionally to distance — strong
      // when far away (fast sweeps), near-zero close to dead zone so
      // slow precise movements aren't eaten by the drift.
      if (this._paintMode) {
        const rawDx = pointer.x - originX;
        const rawDy = pointer.y - originY;
        const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
        const driftScale = Math.max(0, rawDist - dz) / (maxDist - dz);
        const drift = 0.05 * driftScale;
        originX += rawDx * drift;
        originY += rawDy * drift;
        this._joyBase.setPosition(originX, originY);
        this._joyOrbit.setPosition(originX, originY);
      }

      let dx = pointer.x - originX;
      let dy = pointer.y - originY;

      // Clamp thumb to circle radius (dynamic per mode)
      const dist = Math.sqrt(dx * dx + dy * dy);
      let clampedDx = dx, clampedDy = dy;
      if (dist > maxDist) {
        const ratio = maxDist / dist;
        clampedDx = dx * ratio;
        clampedDy = dy * ratio;
      }
      this._joyThumb.setPosition(originX + clampedDx, originY + clampedDy);

      this._updateDirection(dx, dy, dz, maxDist);
    });

    zone.on('pointerup', () => {
      this._restJoystick();
      this._clearDirection();
    });

    zone.on('pointerout', () => {
      this._restJoystick();
      this._clearDirection();
    });

    this.buttons.push(zone);
  }

  _restJoystick() {
    // Reset thumb to center of base, dim all — stay visible at last position
    if (this._joyOrbit) this._joyOrbit.setAlpha(0.25);
    if (this._joyBase) this._joyBase.setAlpha(0.18);
    if (this._joyThumb) {
      this._joyThumb.setPosition(this._joyBase.x, this._joyBase.y).setAlpha(0.4);
    }
  }

  _updateDirection(dx, dy, deadZone, maxDist) {
    // Reset all
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;

    // Apply directions based on offset from touch origin
    if (dx < -deadZone) this.left = true;
    if (dx > deadZone) this.right = true;
    if (dy < -deadZone) this.up = true;
    if (dy > deadZone) this.down = true;

    // Proportional intensity for paint mode (0 inside dead zone, ramps to 1 at maxDist)
    // In paint mode: quartic curve (t^4) — the first ~60% of joystick range only
    // produces ~13% speed, giving much more precision in the middle area.
    // Full speed requires near-full deflection.
    const range = (maxDist || 60) - deadZone;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let linX = range > 0 ? Math.min(1, Math.max(0, absDx - deadZone) / range) : 0;
    let linY = range > 0 ? Math.min(1, Math.max(0, absDy - deadZone) / range) : 0;
    if (this._paintMode) {
      linX = linX * linX;  // quadratic: 0.5 → 0.25, 0.7 → 0.49
      linY = linY * linY;
    }
    this.intensityX = linX;
    this.intensityY = linY;

    // Shadow bias: when near a shadow, diagonal-down → pure down
    // Makes it much easier to trigger hiding on a joystick
    if (this.shadowBias && this.down && (this.left || this.right)) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      // Only keep horizontal if it clearly dominates (2x stronger than vertical)
      if (absDx < absDy * 2) {
        this.left = false;
        this.right = false;
      }
    }
  }

  _clearDirection() {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    this.intensityX = 0;
    this.intensityY = 0;
  }

  createActionButtons(scene) {
    const cam = scene.cameras.main;
    const ss = this._ss || Math.min(cam.width / 1280, cam.height / 720);

    // Button positions — triangle layout in bottom-right corner, scaled
    const jumpX = cam.width - Math.round(85 * ss);
    const jumpY = cam.height - Math.round(95 * ss);
    const actX  = cam.width - Math.round(85 * ss);
    const actY  = cam.height - Math.round(225 * ss);
    const eX    = cam.width - Math.round(215 * ss);
    const eY    = cam.height - Math.round(90 * ss);

    const JUMP_R = Math.round(58 * ss);
    const ACT_R  = Math.round(42 * ss);
    const E_R    = Math.round(40 * ss);

    // Expose positions for tutorial overlay alignment
    this.layout = {
      joyX: Math.round(110 * ss), joyY: cam.height - Math.round(130 * ss),
      jumpX, jumpY, jumpR: JUMP_R,
      actX, actY, actR: ACT_R,
      eX, eY, eR: E_R,
      ss
    };

    // Helper: creates a pressable circle button with icon or text label
    const makeBtn = (x, y, r, color, label, iconKey) => {
      const bg = scene.add.circle(x, y, r, color, 0.15)
        .setScrollFactor(0).setDepth(200)
        .setStrokeStyle(Math.round(2 * ss), color, 0.4)
        .setInteractive();
      let el;
      if (iconKey) {
        el = scene.add.image(x, y, iconKey)
          .setDisplaySize(r * 1.1, r * 1.1)
          .setScrollFactor(0).setDepth(201).setAlpha(0.5);
      } else {
        const hex = '#' + color.toString(16).padStart(6, '0');
        el = scene.add.text(x, y, label, {
          fontFamily: 'Bungee, monospace', fontSize: `${Math.floor(r * 0.56)}px`, fontStyle: 'bold',
          color: hex, stroke: '#000000', strokeThickness: Math.round(4 * ss),
          padding: { x: Math.round(4 * ss), y: Math.round(4 * ss) }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.55);
      }
      const restAlpha  = iconKey ? 0.5  : 0.55;
      const pressAlpha = iconKey ? 1.0  : 1.0;
      bg.on('pointerdown', () => { bg.setAlpha(0.4);   el.setAlpha(pressAlpha); });
      bg.on('pointerup',   () => { bg.setAlpha(0.15);  el.setAlpha(restAlpha);  });
      bg.on('pointerout',  () => { bg.setAlpha(0.15);  el.setAlpha(restAlpha);  });
      return { bg, el };
    };

    // JUMP — large green
    const jump = makeBtn(jumpX, jumpY, JUMP_R, 0x00ff88, 'JUMP', null);
    jump.bg.on('pointerdown', () => { this._jumpJustPressed = true; });

    // ACT (spray/paint) — yellow
    const act = makeBtn(actX, actY, ACT_R, 0xffdd33, '', 'icon_spray');
    act.bg.on('pointerdown', () => { this._actionJustPressed = true; });

    // E (interact/hand) — orange
    const e = makeBtn(eX, eY, E_R, 0xff8833, '', 'icon_hand');
    e.bg.on('pointerdown', () => { this._eJustPressed = true; });

    this.buttons.push(jump.bg, jump.el, act.bg, act.el, e.bg, e.el);
    // Separate list of action buttons (hidden during paint mode, joystick stays active)
    this.actionButtons = [jump.bg, jump.el, act.bg, act.el, e.bg, e.el];

    // Save refs for highlightButton
    this._actBg   = act.bg;
    this._actIcon = act.el;
    this._eBg     = e.bg;
    this._eIcon   = e.el;
    this._eOrigIcon = e.el;          // original icon reference
    this._actOrigIcon = act.el;      // original icon reference
    this._paintHighlight = false;
    this._grabHighlight  = false;
    this._grabActive     = false;    // push mode currently active
    this._paintActive    = false;    // paint mode currently active

    // Glow circles behind icons — soft colored halo, hidden by default
    this._actGlow = scene.add.circle(actX, actY, ACT_R * 1.4, 0xffdd33, 0)
      .setScrollFactor(0).setDepth(199).setVisible(false);
    this._eGlow = scene.add.circle(eX, eY, E_R * 1.4, 0xff8833, 0)
      .setScrollFactor(0).setDepth(199).setVisible(false);
    this.buttons.push(this._actGlow, this._eGlow);
    this.actionButtons.push(this._actGlow, this._eGlow);

    // Pre-create "✕" exit labels (hidden by default) for grab and paint buttons
    const exitStyle = {
      fontFamily: 'Bungee, monospace', fontStyle: 'bold',
      color: '#ff4444', stroke: '#110000', strokeThickness: Math.round(4 * ss),
      padding: { x: Math.round(4 * ss), y: Math.round(4 * ss) }
    };
    this._eExitLabel = scene.add.text(eX, eY, '✕', {
      ...exitStyle, fontSize: `${Math.floor(E_R * 0.7)}px`
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0).setVisible(false);
    this._actExitLabel = scene.add.text(actX, actY, '✕', {
      ...exitStyle, fontSize: `${Math.floor(ACT_R * 0.7)}px`
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0).setVisible(false);

    this.buttons.push(this._eExitLabel, this._actExitLabel);
    this.actionButtons.push(this._eExitLabel, this._actExitLabel);
  }

  setPaintMode(on) {
    this._paintMode = on;
    // Expand movement zone to full screen in paint mode (action buttons are hidden)
    if (this._moveZone) {
      const w = on ? this._moveZoneFullW : this._moveZoneNormalW;
      this._moveZone.setSize(w, this._moveZone.height);
      this._moveZone.setPosition(w / 2, this._moveZone.y);
      this._moveZone.input.hitArea.setTo(0, 0, w, this._moveZone.height);
    }
  }

  /**
   * Highlight a button to signal proximity to an interactable.
   * Adds a pulsing glow animation and tints the icon.
   * Does NOT override active-mode styling.
   * @param {'paint'|'grab'} name
   * @param {boolean} on
   */
  highlightButton(name, on) {
    if (name === 'paint') {
      this._paintHighlight = on;
      if (this._paintActive) return; // active mode overrides highlight
      if (on) {
        if (this._actBg) this._actBg.setAlpha(0.45).setStrokeStyle(3.5, 0xffdd33, 1.0);
        if (this._actOrigIcon) { this._actOrigIcon.setAlpha(1.0); this._actOrigIcon.setTint(0xffdd33); }
        if (this._actGlow) this._actGlow.setVisible(true);
        this._startPulseTween('paint');
      } else {
        this._stopPulseTween('paint');
        if (this._actBg) this._actBg.setAlpha(0.15).setStrokeStyle(2, 0xffdd33, 0.4);
        if (this._actOrigIcon) { this._actOrigIcon.setAlpha(0.5); this._actOrigIcon.clearTint(); }
        if (this._actGlow) { this._actGlow.setVisible(false).setAlpha(0).setScale(1); }
      }
    } else if (name === 'grab') {
      this._grabHighlight = on;
      if (this._grabActive) return; // active mode overrides highlight
      if (on) {
        if (this._eBg) this._eBg.setAlpha(0.45).setStrokeStyle(3.5, 0xff8833, 1.0);
        if (this._eOrigIcon) { this._eOrigIcon.setAlpha(1.0); this._eOrigIcon.setTint(0xffaa33); }
        if (this._eGlow) this._eGlow.setVisible(true);
        this._startPulseTween('grab');
      } else {
        this._stopPulseTween('grab');
        if (this._eBg) this._eBg.setAlpha(0.15).setStrokeStyle(2, 0xff8833, 0.4);
        if (this._eOrigIcon) { this._eOrigIcon.setAlpha(0.5); this._eOrigIcon.clearTint(); }
        if (this._eGlow) { this._eGlow.setVisible(false).setAlpha(0).setScale(1); }
      }
    }
  }

  /**
   * Start a pulsing glow tween on a button's background circle.
   * @param {'paint'|'grab'} name
   */
  _startPulseTween(name) {
    const bg = name === 'paint' ? this._actBg : this._eBg;
    const glow = name === 'paint' ? this._actGlow : this._eGlow;
    const tweenKey = name === 'paint' ? '_paintPulseTween' : '_grabPulseTween';
    const glowTweenKey = name === 'paint' ? '_paintGlowTween' : '_grabGlowTween';
    // Don't start if already pulsing
    if (this[tweenKey]) return;
    if (!bg || !this.scene) return;

    // Pulse: oscillate alpha and scale of the bg circle
    this[tweenKey] = this.scene.tweens.add({
      targets: bg,
      alpha: { from: 0.3, to: 0.6 },
      scaleX: { from: 1.0, to: 1.12 },
      scaleY: { from: 1.0, to: 1.12 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Glow: soft halo pulses behind button
    if (glow) {
      this[glowTweenKey] = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.08, to: 0.25 },
        scaleX: { from: 1.0, to: 1.25 },
        scaleY: { from: 1.0, to: 1.25 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  /**
   * Stop the pulsing glow tween and reset scale.
   * @param {'paint'|'grab'} name
   */
  _stopPulseTween(name) {
    const bg = name === 'paint' ? this._actBg : this._eBg;
    const glow = name === 'paint' ? this._actGlow : this._eGlow;
    const tweenKey = name === 'paint' ? '_paintPulseTween' : '_grabPulseTween';
    const glowTweenKey = name === 'paint' ? '_paintGlowTween' : '_grabGlowTween';
    if (this[tweenKey]) {
      this[tweenKey].stop();
      this[tweenKey] = null;
    }
    if (this[glowTweenKey]) {
      this[glowTweenKey].stop();
      this[glowTweenKey] = null;
    }
    // Reset scale back to 1
    if (bg) { bg.setScale(1); }
    if (glow) { glow.setScale(1).setAlpha(0); }
  }

  /**
   * Set a button to "active" state — brighter, icon swapped to "✕".
   * @param {'paint'|'grab'} name
   * @param {boolean} on
   */
  setActiveMode(name, on) {
    if (name === 'grab') {
      this._grabActive = on;
      // Stop any pulse animation when entering/exiting active mode
      this._stopPulseTween('grab');
      if (this._eGlow) { this._eGlow.setVisible(false).setAlpha(0).setScale(1); }
      if (on) {
        // Show bright orange bg + "✕" exit label
        if (this._eBg) this._eBg.setAlpha(0.55).setStrokeStyle(3, 0xff4444, 0.95);
        if (this._eOrigIcon) { this._eOrigIcon.setVisible(false); this._eOrigIcon.clearTint(); }
        if (this._eExitLabel) { this._eExitLabel.setVisible(true).setAlpha(1); }
      } else {
        // Restore original icon + default dim state
        if (this._eOrigIcon) { this._eOrigIcon.setVisible(true).setAlpha(0.5); this._eOrigIcon.clearTint(); }
        if (this._eExitLabel) { this._eExitLabel.setVisible(false).setAlpha(0); }
        if (this._eBg) this._eBg.setAlpha(0.15).setStrokeStyle(2, 0xff8833, 0.4);
      }
    } else if (name === 'paint') {
      this._paintActive = on;
      this._stopPulseTween('paint');
      if (this._actGlow) { this._actGlow.setVisible(false).setAlpha(0).setScale(1); }
      if (on) {
        if (this._actBg) this._actBg.setAlpha(0.55).setStrokeStyle(3, 0xff4444, 0.95);
        if (this._actOrigIcon) { this._actOrigIcon.setVisible(false); this._actOrigIcon.clearTint(); }
        if (this._actExitLabel) { this._actExitLabel.setVisible(true).setAlpha(1); }
      } else {
        if (this._actOrigIcon) { this._actOrigIcon.setVisible(true).setAlpha(0.5); this._actOrigIcon.clearTint(); }
        if (this._actExitLabel) { this._actExitLabel.setVisible(false).setAlpha(0); }
        if (this._actBg) this._actBg.setAlpha(0.15).setStrokeStyle(2, 0xffdd33, 0.4);
      }
    }
  }

  get jumpJustPressed() {
    if (this._jumpJustPressed) {
      this._jumpJustPressed = false;
      return true;
    }
    return false;
  }

  get actionJustPressed() {
    if (this._actionJustPressed) {
      this._actionJustPressed = false;
      return true;
    }
    return false;
  }

  get eJustPressed() {
    if (this._eJustPressed) {
      this._eJustPressed = false;
      return true;
    }
    return false;
  }

  get paintFillJustPressed() {
    if (this._paintFillJustPressed) {
      this._paintFillJustPressed = false;
      return true;
    }
    return false;
  }

  get paintFillHeld() {
    return this._paintFillHeld;
  }

  // Call from HUD setup to make main camera ignore these elements
  getElements() {
    return this.buttons || [];
  }

  /**
   * Show/hide the main joystick + action buttons.
   * Called when entering/exiting paint mode.
   */
  _setMainButtonsVisible(visible) {
    // Only hide/show action buttons (JUMP, ACT, E) — joystick stays active for paint mode
    const list = this.actionButtons || this.buttons;
    if (!list) return;
    list.forEach(b => {
      if (!b || !b.setVisible) return;
      b.setVisible(visible);
      if (b.input) {
        if (visible) b.setInteractive();
        else b.disableInteractive();
      }
    });
  }

  /**
   * Create color selector buttons arranged in a circle for paint-by-numbers mode.
   * EXIT button ("✕") sits in the center of the circle.
   * Main controls (joystick + action buttons) are hidden until exit.
   */
  createColorButtons(scene, onSelect, colorNames, onExit, hasColorArr) {
    this.colorButtons = [];

    // Hide joystick + action buttons while selecting paint color (mobile only)
    if (this.enabled) this._setMainButtonsVisible(false);

    const numColors = colorNames ? colorNames.length : 4;
    const colorHexes = colorNames
      ? colorNames.map(name => PAINT.COLORS[name] || 0xffffff)
      : [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88, 0xff88ff, 0x88ffff];
    const cam = scene.cameras.main;
    const isMobile = this.enabled;

    // Responsive scale: color buttons don't need the big touch boost —
    // use a gentler multiplier so they don't dominate the paint screen.
    const rawSS = Math.min(cam.width / 1280, cam.height / 720);
    const ss = isMobile ? Math.max(rawSS * 0.95, 0.45) : rawSS;
    const scale = isMobile ? ss : ss * 0.85;
    const ORBIT_R = Math.round(140 * scale);
    const BTN_R   = Math.round(56 * scale);
    const EXIT_R  = Math.round(44 * scale);
    const fontSize = Math.round(48 * scale);
    const exitFontSize = Math.round(56 * scale);

    // Position: bottom-right corner with small margin from edges
    const margin = Math.round(20 * scale);
    const cx = cam.width - margin - ORBIT_R - BTN_R;
    const cy = cam.height - margin - ORBIT_R - BTN_R;

    // Color buttons around the circle
    for (let i = 0; i < numColors; i++) {
      const angle = -Math.PI / 2 - i * (2 * Math.PI / numColors);
      const x = cx + Math.cos(angle) * ORBIT_R;
      const y = cy + Math.sin(angle) * ORBIT_R;
      const color = colorHexes[i] || 0xffffff;
      const has = hasColorArr ? hasColorArr[i] : true;

      const bg = scene.add.circle(x, y, BTN_R, color, has ? 0.65 : 0.12)
        .setScrollFactor(0).setDepth(200)
        .setStrokeStyle(2, 0xffffff, has ? 0.45 : 0.12)
        .setInteractive();

      const text = scene.add.text(x, y, String(i + 1), {
        fontFamily: 'Bungee, monospace', fontSize: fontSize + 'px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: Math.round(6 * scale),
        padding: { x: 4, y: 4 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(has ? 0.95 : 0.2);

      bg.on('pointerdown', () => {
        if (hasColorArr && !hasColorArr[i]) return; // can't select unavailable color
        this.colorButtons.forEach((btn, idx) => {
          if (idx >= numColors) return;
          btn.bg.setStrokeStyle(idx === i ? 4 : 2, 0xffffff, idx === i ? 1 : 0.3);
          btn.text.setAlpha(idx === i ? 1 : 0.7);
        });
        onSelect(i);
      });

      this.colorButtons.push({ bg, text, hasColor: has });
    }

    // EXIT — "✕" in the center of the circle
    const exitBg = scene.add.circle(cx, cy, EXIT_R, 0x1a0000, 0.88)
      .setScrollFactor(0).setDepth(202)
      .setStrokeStyle(3, 0xff4444, 0.85)
      .setInteractive();
    const exitText = scene.add.text(cx, cy, '✕', {
      fontFamily: 'Bungee, monospace', fontSize: exitFontSize + 'px', fontStyle: 'bold',
      color: '#ff4444', stroke: '#110000', strokeThickness: Math.round(7 * scale),
      padding: { x: 4, y: 4 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(203).setAlpha(1);

    exitBg.on('pointerdown', () => { if (onExit) onExit(); });
    exitBg.on('pointerover', () => exitBg.setFillStyle(0x330000, 0.95));
    exitBg.on('pointerout',  () => exitBg.setFillStyle(0x1a0000, 0.88));

    this.colorButtons.push({ bg: exitBg, text: exitText });

    // PAINT / FILL button removed — mobile now auto-paints when hand moves over
    // matching color regions. No manual fill button needed.
  }

  destroyColorButtons() {
    if (this.colorButtons) {
      this.colorButtons.forEach(btn => {
        btn.bg.destroy();
        btn.text.destroy();
      });
      this.colorButtons = null;
      this._paintFillBtn = null;
      this._paintFillJustPressed = false;
      this._paintFillHeld = false;
      // Restore main controls when leaving paint mode
      this._setMainButtonsVisible(true);
    }
  }

  destroy() {
    this._stopPulseTween('paint');
    this._stopPulseTween('grab');
    if (this.buttons) {
      this.buttons.forEach(b => b.destroy());
    }
    this.destroyColorButtons();
  }
}
