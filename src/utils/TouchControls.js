import Phaser from 'phaser';

/**
 * Virtual touch controls for mobile devices.
 * Left side: D-pad (left, right, up, down)
 * Right side: Jump button + Action button (E)
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

    // Don't create controls if no touch support
    if (!scene.sys.game.device.input.touch) return;

    this.enabled = true;
    this.buttons = [];

    this.createDpad(scene);
    this.createActionButtons(scene);
  }

  createDpad(scene) {
    const cam = scene.cameras.main;
    const baseX = 90;
    const baseY = cam.height - 90;
    const size = 50;
    const gap = 4;

    // Semi-transparent D-pad buttons
    const btnStyle = { alpha: 0.25, activeAlpha: 0.5, color: 0xffffff };

    // LEFT
    this.addButton(scene, baseX - size - gap, baseY, size, size, '\u25C0', btnStyle,
      () => { this.left = true; }, () => { this.left = false; });

    // RIGHT
    this.addButton(scene, baseX + size + gap, baseY, size, size, '\u25B6', btnStyle,
      () => { this.right = true; }, () => { this.right = false; });

    // UP
    this.addButton(scene, baseX, baseY - size - gap, size, size, '\u25B2', btnStyle,
      () => { this.up = true; }, () => { this.up = false; });

    // DOWN
    this.addButton(scene, baseX, baseY + size + gap, size, size, '\u25BC', btnStyle,
      () => { this.down = true; }, () => { this.down = false; });
  }

  createActionButtons(scene) {
    const cam = scene.cameras.main;
    const size = 56;

    // JUMP button (right side, lower)
    this.addButton(scene, cam.width - 80, cam.height - 80, size, size, 'JUMP', {
      alpha: 0.25, activeAlpha: 0.5, color: 0x00ff88
    }, () => { this._jumpJustPressed = true; this.up = true; },
       () => { this.up = false; });

    // ACTION button (right side, upper — SPACE for paint)
    this.addButton(scene, cam.width - 160, cam.height - 80, size, size, 'ACT', {
      alpha: 0.25, activeAlpha: 0.5, color: 0xffdd33
    }, () => { this._actionJustPressed = true; }, () => {});

    // E button (right side, even higher — grab/interact)
    this.addButton(scene, cam.width - 80, cam.height - 150, size, size, 'E', {
      alpha: 0.25, activeAlpha: 0.5, color: 0xff8833
    }, () => { this._eJustPressed = true; }, () => {});
  }

  addButton(scene, x, y, w, h, label, style, onDown, onUp) {
    const bg = scene.add.rectangle(x, y, w, h, style.color, style.alpha)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive();

    const text = scene.add.text(x, y, label, {
      font: 'bold 14px monospace',
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
   * Create 4 color selector buttons for paint-by-numbers mode.
   * Only on touch devices. Destroyed when painting ends.
   * @param {Phaser.Scene} scene
   * @param {function} onSelect - callback(colorIndex)
   */
  createColorButtons(scene, onSelect) {
    if (!this.enabled) return;
    this.colorButtons = [];

    const colorHexes = [0xff3344, 0x3388ff, 0xffdd33, 0x33ff88];
    const labels = ['1', '2', '3', '4'];
    const cam = scene.cameras.main;
    const size = 40;
    const startX = cam.width / 2 - (colorHexes.length * (size + 6)) / 2 + size / 2;
    const y = cam.height - 30;

    for (let i = 0; i < colorHexes.length; i++) {
      const x = startX + i * (size + 6);

      const bg = scene.add.rectangle(x, y, size, size, colorHexes[i], 0.5)
        .setScrollFactor(0)
        .setDepth(200)
        .setInteractive()
        .setStrokeStyle(2, 0xffffff, 0.5);

      const text = scene.add.text(x, y, labels[i], {
        font: 'bold 16px monospace',
        fill: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setAlpha(0.7);

      bg.on('pointerdown', () => {
        // Highlight selected
        this.colorButtons.forEach((btn, idx) => {
          btn.bg.setStrokeStyle(idx === i ? 3 : 1, 0xffffff, idx === i ? 1 : 0.3);
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
