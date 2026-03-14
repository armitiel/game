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
const ARM_SEG_WIDTH = 16;        // display width (thickness) of each arm segment
const HAND_DISPLAY_W = 18;       // display width of hand
const HAND_DISPLAY_H = 18;       // display height of hand
const HAND_SPEED = 200;          // pixels per second hand moves (keyboard)
const HAND_SPEED_TOUCH = 140;    // mobile touch joystick speed
const ROPE_STIFFNESS = 0.7;     // high = stiff, nearly straight
const GRAVITY_SAG = 1.5;        // minimal curve even at full extension
const MAX_ARM_LENGTH = 55;      // max distance from shoulder to hand in pixels
const MAX_ARM_LEFT = 25;        // max pixels hand can reach past shoulder to the left (behind body)
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

    // Arm segments — behind player, IN FRONT of hand
    // Height is set dynamically each frame to span the full gap (no holes)
    this.segments = [];
    for (let i = 0; i < ARM_SEGMENT_COUNT; i++) {
      const seg = scene.add.image(0, 0, 'paint_arm')
        .setDepth(4)
        .setVisible(false);
      this.segments.push(seg);
    }

    // Positions for physics simulation (shoulder → ... → hand)
    // points[0] = shoulder (anchor), points[last] = hand
    this.points = [];
    for (let i = 0; i <= ARM_SEGMENT_COUNT; i++) {
      this.points.push({ x: 0, y: 0 });
    }

    this.bounds = null;        // paint area bounds {x, y, w, h}
    this.shoulderOffsetX = 14; // offset from player center to right shoulder (wider)
    this.shoulderOffsetY = 18; // offset from player center downward (lower torso)
  }

  /**
   * Start the paint arm system.
   * @param {number} playerX - player sprite center X
   * @param {number} playerY - player sprite center Y
   * @param {boolean} flipX - player facing direction
   * @param {object} bounds - paint area {x, y, w, h} (top-left + size)
   */
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
    this.segments.forEach(s => s.setVisible(true));
    this.updateSegmentVisuals();
  }

  /**
   * Stop and hide the paint arm.
   */
  stop() {
    this.active = false;
    this.hand.setVisible(false);
    this.canSprite.setVisible(false);
    this.segments.forEach(s => s.setVisible(false));
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
      if (input.left)  hx -= speed * dt;
      if (input.right) hx += speed * dt;
      if (input.up)    hy -= speed * dt;
      if (input.down)  hy += speed * dt;
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
    for (let i = 0; i < this.segments.length; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Height = distance + generous overlap so segments always cover each other
      const segH = Math.max(dist + 6, 6);
      this.segments[i].setDisplaySize(ARM_SEG_WIDTH, segH);
      this.segments[i].setPosition(mx, my);
      this.segments[i].setRotation(angle - Math.PI / 2); // arm.png is vertical
    }
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
    this.segments.forEach(s => s.destroy());
  }
}
