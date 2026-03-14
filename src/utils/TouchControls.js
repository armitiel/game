import Phaser from 'phaser';

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

    // "Just pressed" flags — consumed after read
    this._jumpJustPressed = false;
    this._actionJustPressed = false;
    this._eJustPressed = false;

    this._paintMode = false;

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
    const zoneW = cam.width * 0.45;
    const zoneH = cam.height;

    // Invisible touch zone covering left ~45% of screen
    const zone = scene.add.rectangle(zoneW / 2, zoneH / 2, zoneW, zoneH, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(199)
      .setInteractive();

    // --- Floating virtual joystick ---
    const BASE_RADIUS = 52;   // outer ring radius
    const THUMB_RADIUS = 22;  // inner knob radius
    const HINT_RADIUS = 14;   // small direction hint circles
    const MAX_DIST = BASE_RADIUS - 4; // max thumb travel from center

    // Base ring — appears at touch origin
    this._joyBase = scene.add.circle(0, 0, BASE_RADIUS, 0xffffff, 0.08)
      .setScrollFactor(0).setDepth(199).setVisible(false)
      .setStrokeStyle(2, 0xffffff, 0.25);
    // Thumb knob — follows finger within the ring
    this._joyThumb = scene.add.circle(0, 0, THUMB_RADIUS, 0xffffff, 0.25)
      .setScrollFactor(0).setDepth(200).setVisible(false);

    this.buttons.push(this._joyBase, this._joyThumb);

    // Initial position — bottom-left corner, will move to touch point on first use
    const hintX = 110;
    const hintY = cam.height - 130;
    this._joyBase.setPosition(hintX, hintY).setVisible(true).setAlpha(0.06);
    this._joyBase.setStrokeStyle(2, 0xffffff, 0.2);
    this._joyThumb.setPosition(hintX, hintY).setVisible(true).setAlpha(0.15);

    let originX = hintX, originY = hintY;
    const DEAD_ZONE = 12;
    const DEAD_ZONE_PAINT = 30;

    zone.on('pointerdown', (pointer) => {
      originX = pointer.x;
      originY = pointer.y;
      // Move joystick to touch point, full opacity
      this._joyBase.setPosition(originX, originY).setAlpha(0.08);
      this._joyThumb.setPosition(originX, originY).setAlpha(0.25);
      const dz = this._paintMode ? DEAD_ZONE_PAINT : DEAD_ZONE;
      this._updateDirection(0, 0, dz);
    });

    zone.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      let dx = pointer.x - originX;
      let dy = pointer.y - originY;

      // Clamp thumb to circle radius
      const dist = Math.sqrt(dx * dx + dy * dy);
      let clampedDx = dx, clampedDy = dy;
      if (dist > MAX_DIST) {
        const ratio = MAX_DIST / dist;
        clampedDx = dx * ratio;
        clampedDy = dy * ratio;
      }
      this._joyThumb.setPosition(originX + clampedDx, originY + clampedDy);

      const dz = this._paintMode ? DEAD_ZONE_PAINT : DEAD_ZONE;
      this._updateDirection(dx, dy, dz);
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
    // Reset thumb to center of base, dim both — stay visible at last position
    if (this._joyBase) this._joyBase.setAlpha(0.06);
    if (this._joyThumb) {
      this._joyThumb.setPosition(this._joyBase.x, this._joyBase.y).setAlpha(0.15);
    }
  }

  _updateDirection(dx, dy, deadZone) {
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
  }

  createActionButtons(scene) {
    const cam = scene.cameras.main;

    // Fixed button positions — triangle layout in bottom-right corner
    const jumpX = cam.width - 85;
    const jumpY = cam.height - 95;
    const actX  = cam.width - 185;
    const actY  = cam.height - 190;
    const eX    = cam.width - 215;
    const eY    = cam.height - 90;

    const JUMP_R = 58;
    const ACT_R  = 42;
    const E_R    = 40;

    // Helper: creates a pressable circle button with icon or text label
    const makeBtn = (x, y, r, color, label, iconKey) => {
      const bg = scene.add.circle(x, y, r, color, 0.15)
        .setScrollFactor(0).setDepth(200)
        .setStrokeStyle(2, color, 0.4)
        .setInteractive();
      let el;
      if (iconKey) {
        el = scene.add.image(x, y, iconKey)
          .setDisplaySize(r * 1.1, r * 1.1)
          .setScrollFactor(0).setDepth(201).setAlpha(0.5);
      } else {
        const hex = '#' + color.toString(16).padStart(6, '0');
        el = scene.add.text(x, y, label, {
          font: `bold ${Math.floor(r * 0.38)}px ChangaOne, monospace`,
          fill: hex, stroke: '#000000', strokeThickness: 3
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

    // Save refs for highlightButton
    this._actBg   = act.bg;
    this._actIcon = act.el;
    this._eBg     = e.bg;
    this._eIcon   = e.el;
    this._paintHighlight = false;
    this._grabHighlight  = false;
  }

  setPaintMode(on) {
    this._paintMode = on;
  }

  /**
   * Highlight a button to signal proximity to an interactable.
   * @param {'paint'|'grab'} name
   * @param {boolean} on
   */
  highlightButton(name, on) {
    if (name === 'paint') {
      this._paintHighlight = on;
      if (this._actBg)   this._actBg.setAlpha(on ? 0.45 : 0.15).setStrokeStyle(on ? 3 : 2, 0xffdd33, on ? 0.9 : 0.4);
      if (this._actIcon) this._actIcon.setAlpha(on ? 0.95 : 0.5);
    } else if (name === 'grab') {
      this._grabHighlight = on;
      if (this._eBg)   this._eBg.setAlpha(on ? 0.45 : 0.15).setStrokeStyle(on ? 3 : 2, 0xff8833, on ? 0.9 : 0.4);
      if (this._eIcon) this._eIcon.setAlpha(on ? 0.95 : 0.5);
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

  // Call from HUD setup to make main camera ignore these elements
  getElements() {
    return this.buttons || [];
  }

  /**
   * Show/hide the main joystick + action buttons.
   * Called when entering/exiting paint mode.
   */
  _setMainButtonsVisible(visible) {
    if (!this.buttons) return;
    this.buttons.forEach(b => {
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
  createColorButtons(scene, onSelect, colorNames, onExit) {
    this.colorButtons = [];

    // Hide joystick + action buttons while selecting paint color (mobile only)
    if (this.enabled) this._setMainButtonsVisible(false);

    const colorHexes = [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88, 0xff88ff, 0x88ffff];
    const numColors = colorNames ? colorNames.length : 4;
    const cam = scene.cameras.main;

    // Circle layout — right side of screen so it doesn't cover the play field
    const cx = cam.width - 180;
    const cy = cam.height / 2;
    const ORBIT_R = 115; // radius of the ring of color buttons
    const BTN_R   = 56;  // color button radius
    const EXIT_R  = 52;  // center exit button radius

    // Color buttons around the circle
    for (let i = 0; i < numColors; i++) {
      const angle = -Math.PI / 2 + i * (2 * Math.PI / numColors);
      const x = cx + Math.cos(angle) * ORBIT_R;
      const y = cy + Math.sin(angle) * ORBIT_R;
      const color = colorHexes[i] || 0xffffff;

      const bg = scene.add.circle(x, y, BTN_R, color, 0.65)
        .setScrollFactor(0).setDepth(200)
        .setStrokeStyle(2, 0xffffff, 0.45)
        .setInteractive();

      const text = scene.add.text(x, y, String(i + 1), {
        fontFamily: 'ChangaOne, monospace', fontSize: '48px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 6,
        padding: { x: 4, y: 4 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.95);

      bg.on('pointerdown', () => {
        this.colorButtons.forEach((btn, idx) => {
          if (idx >= numColors) return;
          btn.bg.setStrokeStyle(idx === i ? 4 : 2, 0xffffff, idx === i ? 1 : 0.3);
          btn.text.setAlpha(idx === i ? 1 : 0.7);
        });
        onSelect(i);
      });

      this.colorButtons.push({ bg, text });
    }

    // EXIT — large "✕" in the center of the circle
    const exitBg = scene.add.circle(cx, cy, EXIT_R, 0x1a0000, 0.88)
      .setScrollFactor(0).setDepth(202)
      .setStrokeStyle(3, 0xff4444, 0.85)
      .setInteractive();
    const exitText = scene.add.text(cx, cy, '✕', {
      fontFamily: 'ChangaOne, monospace', fontSize: '56px', fontStyle: 'bold',
      color: '#ff4444', stroke: '#110000', strokeThickness: 7,
      padding: { x: 4, y: 4 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(203).setAlpha(1);

    exitBg.on('pointerdown', () => { if (onExit) onExit(); });
    exitBg.on('pointerover', () => exitBg.setFillStyle(0x330000, 0.95));
    exitBg.on('pointerout',  () => exitBg.setFillStyle(0x1a0000, 0.88));

    this.colorButtons.push({ bg: exitBg, text: exitText });
  }

  destroyColorButtons() {
    if (this.colorButtons) {
      this.colorButtons.forEach(btn => {
        btn.bg.destroy();
        btn.text.destroy();
      });
      this.colorButtons = null;
      // Restore main controls when leaving paint mode
      this._setMainButtonsVisible(true);
    }
  }

  destroy() {
    if (this.buttons) {
      this.buttons.forEach(b => b.destroy());
    }
    this.destroyColorButtons();
  }
}
