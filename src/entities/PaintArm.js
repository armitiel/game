import Phaser from 'phaser';

/**
 * PaintArm — elastic rope arm with a hand that follows player input.
 *
 * When active painting starts:
 * - shoulder anchor = player's right shoulder area
 * - hand sprite moves within paint spot bounds based on arrow keys
 * - arm segments (arm.png) form a chain/rope from shoulder to hand
 * - hand position is emitted for grid painting
 */

const ARM_SEGMENT_COUNT = 8;     // more segments = smoother curve
const ARM_SEG_WIDTH = 11;        // display width (thickness) of each arm segment
const HAND_DISPLAY_W = 18;       // display width of hand
const HAND_DISPLAY_H = 18;       // display height of hand
const HAND_SPEED = 200;          // pixels per second hand moves (keyboard)
const HAND_SPEED_TOUCH = 150;    // mobile touch joystick max speed (scaled by joystick intensity)
const ROPE_STIFFNESS = 0.7;     // high = stiff, nearly straight
const GRAVITY_SAG = 1.5;        // minimal curve even at full extension
const MAX_ARM_LENGTH = 90;      // max distance from shoulder to hand in pixels
const MAX_ARM_LEFT = 70;        // max pixels hand can reach past shoulder to the left (behind body)
const MIN_SAG_DIST = 15;        // below this distance, sag is reduced to zero

export default class PaintArm {
  constructor(scene) {
    this.scene = scene;
    this.active = false;

    // Hand sprite — behind player (player depth=5 in GameScene)
    this.hand = scene.add.image(0, 0, 'paint_hand')
      .setDisplaySize(HAND_DISPLAY_W, HAND_DISPLAY_H)
      .setDepth(3.8)
      .setVisible(false);

    // Spray can in hand — shown during painting, uses current color texture
    this.canSprite = scene.add.image(0, 0, 'spray_can_base')
      .setScale(24 / 72)   // ~24px tall in game
      .setDepth(3.7)        // behind hand
      .setVisible(false);

    // Smooth arm graphic — drawn as a tapered curve each frame
    this.armGfx = scene.add.graphics().setDepth(4).setVisible(false);
    // Keep legacy segments array empty for compatibility
    this.segments = [];

    // Positions for physics simulation (shoulder → ... → hand)
    // points[0] = shoulder (anchor), points[last] = hand
    this.points = [];
    for (let i = 0; i <= ARM_SEGMENT_COUNT; i++) {
      this.points.push({ x: 0, y: 0 });
    }

    this.bounds = null;        // paint area bounds {x, y, w, h}
    this.shoulderOffsetX = 10; // offset from player center to right shoulder
    this.shoulderOffsetY = 22; // offset from player center downward (lower torso)
  }

  /**
   * Start the paint arm system.
   * @param {number} playerX - player sprite center X
   * @param {number} playerY - player sprite center Y
   * @param {boolean} flipX - player facing direction
   * @param {object} bounds - paint area {x, y, w, h} (top-left + size)
   */
  /**
   * Set grid cell dimensions for cell-snapping at low joystick intensity.
   * @param {number} cellW
   * @param {number} cellH
   */
  /**
   * Set grid cell dimensions and filled-check callback for cell-snapping.
   * @param {number} cellW
   * @param {number} cellH
   * @param {function} [isCellFilled] - (col, row) => boolean
   */
  setGridCells(cellW, cellH, isCellFilled) {
    this._cellW = cellW;
    this._cellH = cellH;
    this._isCellFilled = isCellFilled || null;
  }

  start(playerX, playerY, flipX, bounds, colorName) {
    this.active = true;
    this.bounds = bounds;
    this.flipX = flipX;

    // Set spray can texture to current color
    this.setCanColor(colorName);

    // Shoulder anchor position
    const dir = flipX ? -1 : 1;
    const sx = playerX + dir * this.shoulderOffsetX;
    const sy = playerY + this.shoulderOffsetY;

    // Start hand at center of paint area
    const handX = bounds.x + bounds.w / 2;
    const handY = bounds.y + bounds.h / 2;

    // Initialize all points in a line from shoulder to hand
    for (let i = 0; i < this.points.length; i++) {
      const t = i / (this.points.length - 1);
      this.points[i].x = sx + (handX - sx) * t;
      this.points[i].y = sy + (handY - sy) * t;
    }

    // Show everything
    this.hand.setVisible(true).setPosition(handX, handY);
    this.canSprite.setVisible(true).setPosition(handX, handY);
    this.armGfx.setVisible(true);
    this.updateSegmentVisuals();
  }

  /**
   * Stop and hide the paint arm.
   */
  stop() {
    this.active = false;
    this.hand.setVisible(false);
    this.canSprite.setVisible(false);
    this.armGfx.setVisible(false);
    this.armGfx.clear();
  }

  /**
   * Update every frame. Moves hand based on input, simulates rope.
   * @param {number} delta - ms since last frame
   * @param {object} input - {left, right, up, down} booleans
   * @param {number} playerX - current player X
   * @param {number} playerY - current player Y
   * @param {boolean} [isTouch] - true when using touch controls (slower, more precise)
   * @returns {{x, y}|null} - hand world position if actively painting, null otherwise
   */
  update(delta, input, playerX, playerY, isTouch, mouseWorld) {
    if (!this.active) return null;

    const dt = delta / 1000;
    const dir = this.flipX ? -1 : 1;
    const speed = isTouch ? HAND_SPEED_TOUCH : HAND_SPEED;

    // Update shoulder anchor to follow player
    const sx = playerX + dir * this.shoulderOffsetX;
    const sy = playerY + this.shoulderOffsetY;
    this.points[0].x = sx;
    this.points[0].y = sy;

    // Move hand based on input
    const last = this.points.length - 1;
    let hx = this.points[last].x;
    let hy = this.points[last].y;

    // Mouse takes priority: snap hand directly to mouse world position
    if (mouseWorld) {
      hx = mouseWorld.x;
      hy = mouseWorld.y;
    } else {
      // Use proportional intensity from touch joystick (keyboard = full speed)
      const ix = input.intensityX != null ? input.intensityX : 1;
      const iy = input.intensityY != null ? input.intensityY : 1;
      if (input.left)  hx -= speed * ix * dt;
      if (input.right) hx += speed * ix * dt;
      if (input.up)    hy -= speed * iy * dt;
      if (input.down)  hy += speed * iy * dt;
    }

    // Clamp hand to paint bounds
    const b = this.bounds;
    hx = Phaser.Math.Clamp(hx, b.x, b.x + b.w);
    hy = Phaser.Math.Clamp(hy, b.y, b.y + b.h);

    // Limit reach on the "behind body" side (left of shoulder when facing right)
    const behindLimit = sx - dir * MAX_ARM_LEFT;
    if (dir > 0) {
      // Facing right — hand shouldn't go too far left of shoulder
      hx = Math.max(hx, behindLimit);
    } else {
      // Facing left — hand shouldn't go too far right of shoulder
      hx = Math.min(hx, behindLimit);
    }

    // Limit arm length — pull hand back toward shoulder if too far
    const adx = hx - sx;
    const ady = hy - sy;
    const armDist = Math.sqrt(adx * adx + ady * ady);
    if (armDist > MAX_ARM_LENGTH) {
      const ratio = MAX_ARM_LENGTH / armDist;
      hx = sx + adx * ratio;
      hy = sy + ady * ratio;
    }

    // Grid cell snapping — at low joystick intensity, pull hand toward
    // the nearest cell center so the player can step cell-by-cell precisely.
    if (isTouch && this._cellW && this._cellH) {
      const ix = input.intensityX != null ? input.intensityX : 1;
      const iy = input.intensityY != null ? input.intensityY : 1;
      const intensity = Math.max(ix, iy);
      // Snap strength: full snap at 0 intensity, fades out by 0.35
      const snap = Math.max(0, 1 - intensity / 0.35);
      if (snap > 0) {
        const col = Math.floor((hx - b.x) / this._cellW);
        const row = Math.floor((hy - b.y) / this._cellH);
        // Skip snap on already-painted cells — let hand slide through easily
        const filled = this._isCellFilled && this._isCellFilled(col, row);
        if (!filled) {
          const cellCX = b.x + (col + 0.5) * this._cellW;
          const cellCY = b.y + (row + 0.5) * this._cellH;
          hx += (cellCX - hx) * snap * 0.4;
          hy += (cellCY - hy) * snap * 0.4;
        }
      }
    }

    this.points[last].x = hx;
    this.points[last].y = hy;

    // Sag scales with arm extension — close to body = no sag
    const finalDx = hx - sx;
    const finalDy = hy - sy;
    const finalDist = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
    const sagScale = Math.max(0, (finalDist - MIN_SAG_DIST) / (MAX_ARM_LENGTH - MIN_SAG_DIST));
    const effectiveSag = GRAVITY_SAG * sagScale;

    // Simulate rope with gravity sag: intermediate points move toward midpoint
    // of neighbours, plus a downward gravity bias that peaks at the middle
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < last; i++) {
        const prev = this.points[i - 1];
        const next = this.points[i + 1];
        const targetX = (prev.x + next.x) / 2;
        const targetY = (prev.y + next.y) / 2;

        // Gravity sag: parabolic — strongest at middle of chain, zero at ends
        const t = i / last;  // 0 at shoulder, 1 at hand
        const sagFactor = 4 * t * (1 - t); // peaks at 0.5 → value 1.0
        const sagY = effectiveSag * sagFactor;

        this.points[i].x += (targetX - this.points[i].x) * ROPE_STIFFNESS;
        this.points[i].y += (targetY + sagY - this.points[i].y) * ROPE_STIFFNESS;
      }
    }

    // Update visuals — hand display nudged up and toward player
    const handNudgeX = -dir * 3;  // 3px closer to body
    const handNudgeY = -4;        // 4px up
    this.hand.setPosition(hx + handNudgeX, hy + handNudgeY);
    this.hand.setFlipX(this.flipX);
    // Spray can follows hand, offset slightly below/behind
    this.canSprite.setPosition(hx + handNudgeX, hy + handNudgeY + 6);
    this.canSprite.setFlipX(this.flipX);
    this.updateSegmentVisuals();

    return { x: hx, y: hy };
  }

  /**
   * Position, rotate, and dynamically size arm segments to fully span
   * between consecutive points with no gaps.
   */
  updateSegmentVisuals() {
    const g = this.armGfx;
    g.clear();

    const pts = this.points;
    const n = pts.length;
    if (n < 2) return;

    // Nudge the hand end (last point) slightly toward the player (left in world)
    const handNudgeX = this.flipX ? 3 : -3;
    const lastPt = pts[n - 1];
    const savedLastX = lastPt.x;
    lastPt.x += handNudgeX;

    // Draw smooth tapered arm as a filled polygon along the curve
    // Sample many points along a Catmull-Rom spline through the rope points
    const SAMPLES = 32;
    const spline = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const ft = s / SAMPLES; // 0..1 along arm
      const fi = ft * (n - 1);
      const idx = Math.min(Math.floor(fi), n - 2);
      const lt = fi - idx;
      // Catmull-Rom with clamped endpoints
      const p0 = pts[Math.max(0, idx - 1)];
      const p1 = pts[idx];
      const p2 = pts[Math.min(n - 1, idx + 1)];
      const p3 = pts[Math.min(n - 1, idx + 2)];
      const t2 = lt * lt;
      const t3 = t2 * lt;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * lt +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * lt +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      spline.push({ x, y, t: ft });
    }

    // Build left and right edges with taper
    const ARM_COLOR = 0x703dcb; // purple arm color
    const leftEdge = [];
    const rightEdge = [];

    for (let i = 0; i < spline.length; i++) {
      const p = spline[i];
      // Taper: thinner at shoulder (t=0), full at hand (t=1)
      const taper = 0.85 + 0.15 * p.t;
      const halfW = (ARM_SEG_WIDTH * taper) / 2;

      // Normal direction (perpendicular to curve)
      let nx, ny;
      if (i < spline.length - 1) {
        const dx = spline[i + 1].x - p.x;
        const dy = spline[i + 1].y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      } else {
        const dx = p.x - spline[i - 1].x;
        const dy = p.y - spline[i - 1].y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        nx = -dy / len;
        ny = dx / len;
      }

      leftEdge.push({ x: p.x + nx * halfW, y: p.y + ny * halfW });
      rightEdge.push({ x: p.x - nx * halfW, y: p.y - ny * halfW });
    }

    // Helper: draw arm body (polygon) + round circle caps at ends
    // yOffset shifts the layer vertically (positive = down)
    const drawArmLayer = (color, alpha, widthScale, yOffset = 0) => {
      // Compute scaled edges
      const sLeftEdge = [];
      const sRightEdge = [];
      for (let i = 0; i < spline.length; i++) {
        const cx = spline[i].x, cy = spline[i].y + yOffset;
        sLeftEdge.push({
          x: cx + (leftEdge[i].x - spline[i].x) * widthScale,
          y: cy + (leftEdge[i].y - spline[i].y) * widthScale
        });
        sRightEdge.push({
          x: cx + (rightEdge[i].x - spline[i].x) * widthScale,
          y: cy + (rightEdge[i].y - spline[i].y) * widthScale
        });
      }

      g.fillStyle(color, alpha);

      // Round cap at shoulder
      const sTaper = 0.85;
      const sR = (ARM_SEG_WIDTH * sTaper * widthScale) / 2;
      g.fillCircle(spline[0].x, spline[0].y + yOffset, sR);

      // Round cap at hand
      const hR = (ARM_SEG_WIDTH * widthScale) / 2;
      g.fillCircle(spline[spline.length - 1].x, spline[spline.length - 1].y + yOffset, hR);

      // Body polygon
      g.beginPath();
      g.moveTo(sLeftEdge[0].x, sLeftEdge[0].y);
      for (let i = 1; i < sLeftEdge.length; i++) {
        g.lineTo(sLeftEdge[i].x, sLeftEdge[i].y);
      }
      for (let i = sRightEdge.length - 1; i >= 0; i--) {
        g.lineTo(sRightEdge[i].x, sRightEdge[i].y);
      }
      g.closePath();
      g.fillPath();
    };

    // Layer 1: bottom shadow — darker, shifted down
    drawArmLayer(0x402a9b, 1, 1.15, 1.5);

    // Layer 2: base arm color
    drawArmLayer(0x703dcb, 1, 1.0, 0);

    // Layer 3: subtle inner shadow overlay — semi-transparent, shifted slightly down
    drawArmLayer(0x402a9b, 0.3, 0.8, 0.8);

    // Layer 4: top highlight — shifted up, narrower
    drawArmLayer(0x703dcb, 0.6, 0.5, -1.2);

    // Restore last point after rendering
    lastPt.x = savedLastX;
  }

  /**
   * Switch the spray can texture to match a new paint color.
   * @param {string} colorName - e.g. 'red', 'blue'
   */
  setCanColor(colorName) {
    if (!colorName) return;
    const key = `paint_can_sprite_${colorName.toLowerCase()}`;
    if (this.scene.textures.exists(key)) {
      this.canSprite.setTexture(key);
    }
  }

  /**
   * Destroy all sprites (cleanup).
   */
  destroy() {
    this.hand.destroy();
    this.canSprite.destroy();
    this.armGfx.destroy();
  }
}
