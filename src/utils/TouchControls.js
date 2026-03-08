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

    // Visual D-pad hint (subtle, shows where to touch)
    const hintX = 120;
    const hintY = cam.height - 120;
    const hintGap = 55;
    const hintAlpha = 0.15;
    const hintFont = 'bold 32px monospace';

    this._dpadHints = [
      scene.add.text(hintX - hintGap, hintY, '\u25C0', { font: hintFont, fill: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(hintAlpha),
      scene.add.text(hintX + hintGap, hintY, '\u25B6', { font: hintFont, fill: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(hintAlpha),
      scene.add.text(hintX, hintY - hintGap, '\u25B2', { font: hintFont, fill: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(hintAlpha),
      scene.add.text(hintX, hintY + hintGap, '\u25BC', { font: hintFont, fill: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(hintAlpha),
    ];
    this._dpadHints.forEach(h => this.buttons.push(h));

    let originX = 0, originY = 0;
    const DEAD_ZONE = 12; // pixels before direction registers

    zone.on('pointerdown', (pointer) => {
      originX = pointer.x;
      originY = pointer.y;
      this._updateDirection(0, 0, DEAD_ZONE);
    });

    zone.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.x - originX;
      const dy = pointer.y - originY;
      this._updateDirection(dx, dy, DEAD_ZONE);
    });

    zone.on('pointerup', () => {
      this._clearDirection();
    });

    zone.on('pointerout', () => {
      this._clearDirection();
    });

    this.buttons.push(zone);
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

    // Update hint visuals
    if (this._dpadHints) {
      this._dpadHints[0].setAlpha(this.left ? 0.5 : 0.12);   // LEFT
      this._dpadHints[1].setAlpha(this.right ? 0.5 : 0.12);  // RIGHT
      this._dpadHints[2].setAlpha(this.up ? 0.5 : 0.12);     // UP
      this._dpadHints[3].setAlpha(this.down ? 0.5 : 0.12);   // DOWN
    }
  }

  _clearDirection() {
    this.left = false;
    this.right = false;
    this.up = false;
    this.down = false;
    if (this._dpadHints) {
      this._dpadHints.forEach(h => h.setAlpha(0.12));
    }
  }

  createActionButtons(scene) {
    const cam = scene.cameras.main;
    const radius = 46; // large circular buttons

    // JUMP button (right side, lower)
    this.addCircleButton(scene, cam.width - 90, cam.height - 90, radius, 'JUMP', {
      alpha: 0.2, activeAlpha: 0.5, color: 0x00ff88
    }, () => { this._jumpJustPressed = true; },
       () => {});

    // ACTION button (SPACE — paint mode toggle)
    this.addCircleButton(scene, cam.width - 195, cam.height - 90, radius, 'ACT', {
      alpha: 0.2, activeAlpha: 0.5, color: 0xffdd33
    }, () => { this._actionJustPressed = true; }, () => {});

    // E button (grab/interact) — store reference for color button positioning
    this.eButtonX = cam.width - 90;
    this.eButtonY = cam.height - 195;
    this.addCircleButton(scene, this.eButtonX, this.eButtonY, radius, 'E', {
      alpha: 0.2, activeAlpha: 0.5, color: 0xff8833
    }, () => { this._eJustPressed = true; }, () => {});
  }

  addCircleButton(scene, x, y, radius, label, style, onDown, onUp) {
    const bg = scene.add.circle(x, y, radius, style.color, style.alpha)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);

    const text = scene.add.text(x, y, label, {
      font: 'bold 18px monospace',
      fill: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.5);

    bg.on('pointerdown', () => {
      bg.setAlpha(style.activeAlpha);
      text.setAlpha(0.9);
      onDown();
    });

    bg.on('pointerup', () => {
      bg.setAlpha(style.alpha);
      text.setAlpha(0.5);
      onUp();
    });

    bg.on('pointerout', () => {
      bg.setAlpha(style.alpha);
      text.setAlpha(0.5);
      onUp();
    });

    this.buttons.push(bg, text);
    return bg;
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
    const radius = 28;
    const gap = 10;
    // Vertical stack above E button
    const x = this.eButtonX || (scene.cameras.main.width - 90);
    const eTop = (this.eButtonY || (scene.cameras.main.height - 195)) - 46 - gap;

    for (let i = 0; i < numColors; i++) {
      // Bottom color = index 0, stack upward
      const y = eTop - i * (radius * 2 + gap);

      const bg = scene.add.circle(x, y, radius, colorHexes[i] || 0xffffff, 0.6)
        .setScrollFactor(0)
        .setDepth(200)
        .setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains)
        .setStrokeStyle(2, 0xffffff, 0.5);

      const text = scene.add.text(x, y, labels[i], {
        font: 'bold 20px monospace',
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
