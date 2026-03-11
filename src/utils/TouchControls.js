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

    // --- Initial hint: static joystick preview so user knows where controls are ---
    const hintX = 110;
    const hintY = cam.height - 130;
    const hintDist = BASE_RADIUS + 6; // distance from center to direction dots

    this._hintBase = scene.add.circle(hintX, hintY, BASE_RADIUS, 0xffffff, 0.06)
      .setScrollFactor(0).setDepth(199)
      .setStrokeStyle(2, 0xffffff, 0.2);
    this._hintThumb = scene.add.circle(hintX, hintY, THUMB_RADIUS, 0xffffff, 0.15)
      .setScrollFactor(0).setDepth(200);

    // 4 small direction indicator circles around the ring
    this._hintDots = [
      scene.add.circle(hintX - hintDist, hintY, HINT_RADIUS, 0x88aaff, 0.25),  // left
      scene.add.circle(hintX + hintDist, hintY, HINT_RADIUS, 0x88aaff, 0.25),  // right
      scene.add.circle(hintX, hintY - hintDist, HINT_RADIUS, 0x88ffaa, 0.25),  // up
      scene.add.circle(hintX, hintY + hintDist, HINT_RADIUS, 0xff8888, 0.25),  // down
    ];
    // Small arrows inside direction dots
    const arrowStyle = { font: 'bold 16px monospace', fill: '#ffffff' };
    this._hintArrows = [
      scene.add.text(hintX - hintDist, hintY, '\u25C0', arrowStyle).setOrigin(0.5).setAlpha(0.5),
      scene.add.text(hintX + hintDist, hintY, '\u25B6', arrowStyle).setOrigin(0.5).setAlpha(0.5),
      scene.add.text(hintX, hintY - hintDist, '\u25B2', arrowStyle).setOrigin(0.5).setAlpha(0.5),
      scene.add.text(hintX, hintY + hintDist, '\u25BC', arrowStyle).setOrigin(0.5).setAlpha(0.5),
    ];
    this._hintDots.forEach(d => d.setScrollFactor(0).setDepth(199));
    this._hintArrows.forEach(a => a.setScrollFactor(0).setDepth(200));

    // Gentle pulse on the hint thumb to draw attention
    scene.tweens.add({
      targets: this._hintThumb,
      alpha: { from: 0.15, to: 0.35 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const hintElements = [this._hintBase, this._hintThumb, ...this._hintDots, ...this._hintArrows];
    this.buttons.push(...hintElements);
    this._hintVisible = true;

    let originX = 0, originY = 0;
    const DEAD_ZONE = 12;
    const DEAD_ZONE_PAINT = 30;

    zone.on('pointerdown', (pointer) => {
      // First touch — fade out the static hint permanently
      if (this._hintVisible) {
        this._hintVisible = false;
        scene.tweens.add({
          targets: hintElements,
          alpha: 0,
          duration: 300,
          onComplete: () => hintElements.forEach(el => el.setVisible(false))
        });
      }
      originX = pointer.x;
      originY = pointer.y;
      // Show joystick at touch point
      this._joyBase.setPosition(originX, originY).setVisible(true);
      this._joyThumb.setPosition(originX, originY).setVisible(true);
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
      this._hideJoystick();
      this._clearDirection();
    });

    zone.on('pointerout', () => {
      this._hideJoystick();
      this._clearDirection();
    });

    this.buttons.push(zone);
  }

  _hideJoystick() {
    if (this._joyBase) this._joyBase.setVisible(false);
    if (this._joyThumb) this._joyThumb.setVisible(false);
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
    const zoneW = cam.width * 0.45;
    const zoneH = cam.height;
    const zoneX = cam.width - zoneW / 2;

    // Invisible touch zone covering right ~45% of screen
    const zone = scene.add.rectangle(zoneX, zoneH / 2, zoneW, zoneH, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(199)
      .setInteractive();

    // --- Radial action wheel visuals ---
    const BASE_RADIUS = 52;
    const THUMB_RADIUS = 22;
    const SWIPE_THRESHOLD = 28; // min drag distance to count as swipe
    const HINT_DIST = BASE_RADIUS + 28; // icons well outside the ring

    // Base ring — appears at touch origin
    this._actBase = scene.add.circle(0, 0, BASE_RADIUS, 0xffffff, 0.08)
      .setScrollFactor(0).setDepth(199).setVisible(false)
      .setStrokeStyle(2, 0xffffff, 0.25);
    // Thumb knob — green tint (jump color)
    this._actThumb = scene.add.circle(0, 0, THUMB_RADIUS, 0x00ff88, 0.25)
      .setScrollFactor(0).setDepth(200).setVisible(false);

    // Direction hint backgrounds (colored circles behind icons)
    this._actHintUpBg = scene.add.circle(0, 0, 22, 0xffdd33, 0.35)
      .setScrollFactor(0).setDepth(200.5).setVisible(false);
    this._actHintLeftBg = scene.add.circle(0, 0, 22, 0xff8833, 0.35)
      .setScrollFactor(0).setDepth(200.5).setVisible(false);

    // Direction hint icons (up = paint, left = interact)
    this._actHintUp = scene.add.image(0, 0, 'icon_spray')
      .setDisplaySize(28, 28).setScrollFactor(0).setDepth(201).setAlpha(0.7).setVisible(false);
    this._actHintLeft = scene.add.image(0, 0, 'icon_hand')
      .setDisplaySize(28, 28).setScrollFactor(0).setDepth(201).setAlpha(0.7).setVisible(false);
    // Center jump label — green
    this._actHintCenter = scene.add.text(0, 0, 'JUMP', {
      font: 'bold 12px monospace', fill: '#00ff88'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.4).setVisible(false);

    this.buttons.push(this._actBase, this._actThumb, this._actHintUpBg, this._actHintLeftBg, this._actHintUp, this._actHintLeft, this._actHintCenter);

    // --- Static hint (shown before first touch) ---
    const hintX = cam.width - 110;
    const hintY = cam.height - 130;

    this._actStaticBase = scene.add.circle(hintX, hintY, BASE_RADIUS, 0xffffff, 0.06)
      .setScrollFactor(0).setDepth(199).setStrokeStyle(2, 0xffffff, 0.2);
    this._actStaticThumb = scene.add.circle(hintX, hintY, THUMB_RADIUS, 0x00ff88, 0.15)
      .setScrollFactor(0).setDepth(200);
    // Static hint backgrounds
    this._actStaticUpBg = scene.add.circle(hintX, hintY - HINT_DIST, 20, 0xffdd33, 0.25)
      .setScrollFactor(0).setDepth(199.5);
    this._actStaticLeftBg = scene.add.circle(hintX - HINT_DIST, hintY, 20, 0xff8833, 0.25)
      .setScrollFactor(0).setDepth(199.5);
    this._actStaticUp = scene.add.image(hintX, hintY - HINT_DIST, 'icon_spray')
      .setDisplaySize(24, 24).setScrollFactor(0).setDepth(201).setAlpha(0.5);
    this._actStaticLeft = scene.add.image(hintX - HINT_DIST, hintY, 'icon_hand')
      .setDisplaySize(24, 24).setScrollFactor(0).setDepth(201).setAlpha(0.5);
    this._actStaticCenter = scene.add.text(hintX, hintY + 2, 'JUMP', {
      font: 'bold 10px monospace', fill: '#00ff88'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.3);

    scene.tweens.add({
      targets: this._actStaticThumb,
      alpha: { from: 0.15, to: 0.35 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    const staticHintEls = [this._actStaticBase, this._actStaticThumb, this._actStaticUpBg, this._actStaticLeftBg, this._actStaticUp, this._actStaticLeft, this._actStaticCenter];
    this.buttons.push(...staticHintEls);
    this._actHintVisible = true;

    // Track active selection for highlight
    this._actSelection = null; // null | 'up' | 'left'

    let originX = 0, originY = 0;
    let pointerDown = false;

    zone.on('pointerdown', (pointer) => {
      // Fade static hint on first use
      if (this._actHintVisible) {
        this._actHintVisible = false;
        scene.tweens.add({
          targets: staticHintEls, alpha: 0, duration: 300,
          onComplete: () => staticHintEls.forEach(el => el.setVisible(false))
        });
      }

      originX = pointer.x;
      originY = pointer.y;
      pointerDown = true;
      this._actSelection = null;

      // Show radial at touch point
      this._actBase.setPosition(originX, originY).setVisible(true);
      this._actThumb.setPosition(originX, originY).setVisible(true);
      this._actHintUpBg.setPosition(originX, originY - HINT_DIST).setVisible(true).setAlpha(0.35);
      this._actHintLeftBg.setPosition(originX - HINT_DIST, originY).setVisible(true).setAlpha(0.35);
      this._actHintUp.setPosition(originX, originY - HINT_DIST).setVisible(true).setAlpha(0.7);
      this._actHintLeft.setPosition(originX - HINT_DIST, originY).setVisible(true).setAlpha(0.7);
      this._actHintCenter.setPosition(originX, originY + 2).setVisible(true).setAlpha(0.4);
    });

    zone.on('pointermove', (pointer) => {
      if (!pointerDown || !pointer.isDown) return;
      const dx = pointer.x - originX;
      const dy = pointer.y - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clamp thumb
      const MAX_DIST = BASE_RADIUS - 4;
      let cx = dx, cy = dy;
      if (dist > MAX_DIST) { const r = MAX_DIST / dist; cx = dx * r; cy = dy * r; }
      this._actThumb.setPosition(originX + cx, originY + cy);

      // Determine selection
      let sel = null;
      if (dist >= SWIPE_THRESHOLD) {
        const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
        // Up: -135 to -45
        if (angle >= -135 && angle <= -45) sel = 'up';
        // Left: 135..180 or -180..-135
        else if (angle >= 135 || angle <= -135) sel = 'left';
      }

      if (sel !== this._actSelection) {
        this._actSelection = sel;
        // Highlight selected direction
        this._actHintUpBg.setAlpha(sel === 'up' ? 0.7 : 0.35);
        this._actHintLeftBg.setAlpha(sel === 'left' ? 0.7 : 0.35);
        this._actHintUp.setAlpha(sel === 'up' ? 1.0 : 0.7);
        this._actHintLeft.setAlpha(sel === 'left' ? 1.0 : 0.7);
        this._actHintCenter.setAlpha(sel === null ? 0.7 : 0.3);
      }
    });

    const release = () => {
      if (!pointerDown) return;
      pointerDown = false;

      // Fire action based on selection
      if (this._actSelection === 'up') {
        this._actionJustPressed = true;
      } else if (this._actSelection === 'left') {
        this._eJustPressed = true;
      } else {
        // Tap or no clear direction = jump
        this._jumpJustPressed = true;
      }
      this._actSelection = null;

      // Hide radial
      this._actBase.setVisible(false);
      this._actThumb.setVisible(false);
      this._actHintUpBg.setVisible(false);
      this._actHintLeftBg.setVisible(false);
      this._actHintUp.setVisible(false);
      this._actHintLeft.setVisible(false);
      this._actHintCenter.setVisible(false);
    };

    zone.on('pointerup', release);
    zone.on('pointerout', release);

    this.buttons.push(zone);

    // Keep references for highlight API compatibility
    this._paintHighlight = false;
    this._grabHighlight = false;
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
    // Radial menu has no persistent buttons to highlight — no-op
    if (name === 'paint') this._paintHighlight = on;
    else if (name === 'grab') this._grabHighlight = on;
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
   * Create color selector buttons for paint-by-numbers mode.
   * Positioned on the right side above the E button, circular.
   */
  createColorButtons(scene, onSelect, colorNames) {
    if (!this.enabled) return;
    this.colorButtons = [];

    const colorHexes = [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88];
    const labels = ['1', '2', '3', '4'];
    const numColors = colorNames ? colorNames.length : 4;
    const radius = 38;
    const gap = 18;
    // Vertical stack on right side of screen
    const x = scene.cameras.main.width - 90;
    const eTop = scene.cameras.main.height - 195 - 46 - gap - 30;

    for (let i = 0; i < numColors; i++) {
      // Bottom color = index 0, stack upward
      const y = eTop - i * (radius * 2 + gap);

      const bg = scene.add.circle(x, y, radius, colorHexes[i] || 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(200)
        .setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains)
        .setStrokeStyle(2, 0xffffff, 0.5);

      const text = scene.add.text(x, y, labels[i], {
        font: 'bold 26px monospace',
        fill: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.8);

      bg.on('pointerdown', () => {
        this.colorButtons.forEach((btn, idx) => {
          btn.bg.setStrokeStyle(idx === i ? 3 : 2, 0xffffff, idx === i ? 1 : 0.3);
        });
        onSelect(i);
      });

      this.colorButtons.push({ bg, text });
    }
  }

  destroyColorButtons() {
    if (this.colorButtons) {
      this.colorButtons.forEach(btn => {
        btn.bg.destroy();
        btn.text.destroy();
      });
      this.colorButtons = null;
    }
  }

  destroy() {
    if (this.buttons) {
      this.buttons.forEach(b => b.destroy());
    }
    this.destroyColorButtons();
  }
}
