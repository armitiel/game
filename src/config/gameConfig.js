// === SHADOW TAGGER — Game Constants ===

export const GAME = {
  WIDTH: 1280,
  HEIGHT: 720,
  GRAVITY: 800,
  BACKGROUND_COLOR: '#1a1a2e'
};

export const PLAYER = {
  SPEED: 160,
  JUMP_VELOCITY: -350,
  CLIMB_SPEED: 100,
  // Unified sprite sheet — all animations in one sheet at same frame size
  FRAME_W: 96,
  FRAME_H: 144,
  // Frame ranges in combined sheet:
  // idle: 0-17, walk: 18-41, jump: 42-61, push: 62-85, climb: 86-104, climb2: 105-124, paint: 125-149, twist: 150-177, side: 178-205
  TOTAL_IDLE_FRAMES: 18,
  IDLE_FRAME_START: 0,
  TOTAL_WALK_FRAMES: 24,
  WALK_FRAME_START: 18,
  TOTAL_JUMP_FRAMES: 20,
  JUMP_FRAME_START: 42,
  TOTAL_PUSH_FRAMES: 24,
  PUSH_FRAME_START: 62,
  TOTAL_CLIMB_FRAMES: 19,
  CLIMB_FRAME_START: 86,
  CLIMB_ANIM_SPEED: 0.6,
  TOTAL_CLIMB2_FRAMES: 20,
  CLIMB2_FRAME_START: 105,
  TOTAL_TURN_FRAMES: 25,
  TURN_FRAME_START: 125,
  TOTAL_TWIST_FRAMES: 28,
  TWIST_FRAME_START: 150,
  IDLE_TWIST_DELAY: 5000, // ms of idle before twist plays
  TOTAL_SIDE_FRAMES: 28,
  SIDE_FRAME_START: 178,
  // Physics body (smaller than visual, centered at feet)
  BODY_W: 20,
  BODY_H: 60,
  BODY_OFFSET_X: 38,  // (96 - 20) / 2
  BODY_OFFSET_Y: 81,  // feet at Y=141 in 144px frame, body top at 141-60=81
  // Sprite sheet path
  SHEET_PATH: 'assets/sprites/player_combined_sheet.png?v=187'
};

export const COP = {
  SPEED: 60,
  DETECTION_RANGE: 180,
  WIDTH: 24,
  HEIGHT: 36,
  COLOR: 0x3366ff,   // niebieski
  ALERT_COLOR: 0xff3333
};

export const SHADOW = {
  COLOR: 0x000000,
  ALPHA: 0.82,
  PLAYER_HIDDEN_ALPHA: 0.3
};

export const PAINT = {
  COLORS: {
    RED: 0xff3344,
    BLUE: 0x3388ff,
    YELLOW: 0xffdd33,
    GREEN: 0x33ff88
  },
  CAN_SIZE: 16,
  SPOT_W: 64,
  SPOT_H: 80,
  // Active painting mechanic
  PAINT_SPEED: 80,            // px/s movement while painting
  PAINT_GRID_COLS: 7,         // grid columns for paint coverage
  PAINT_GRID_ROWS: 10,        // grid rows for paint coverage
  PAINT_FILL_THRESHOLD: 0.75, // 75% coverage = complete
  // Paint-by-numbers system
  PBN_ENABLED: true,
  PBN_WRONG_FLASH_MS: 300,
  PBN_COMPLETION_THRESHOLD: 0.75
};

export const CONTROLS = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  UP: 'UP',
  DOWN: 'DOWN',
  JUMP: 'SPACE',
  INTERACT: 'E'
};
