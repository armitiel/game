// Central design tokens for Shadow Tagger UI.
// Style: Cartoon Mobile Juicy (Royal Match / Toon Blast vibe).
// Cards share one tintable frame; pills + accents are uniform across modes.

export const COLORS = {
  bg:        0x1a1a2e,
  bgDeep:    0x0a0a18,
  text:      0xffffff,
  textDim:   0xccddee,
  border:    0x0a1428,   // dark navy used for all card borders
  borderDeep:0x050810,

  // Universal accent — orange "X LEVELS" pill across all modes
  accent:        0xff9933,
  accentDeep:    0xcc6611,
  accentStroke:  0x5a2200,

  // Generic pill tones
  pillDark:      0x0a1830,
  pillLight:     0xffffff,
};

// Per-mode tints — applied to the shared 9-slice frame textures.
// Frame source is BLUE → stealth uses 0xffffff (no tint, native blue).
// puzzle/tower tints are temporary (muddy from blue source); replace with
// dedicated color slicesets when available.
// `pillFill` is the title-pill background, `pillText` is the title text color.
export const MODE_COLORS = {
  stealth: {
    tint:     0xffffff,   // no tint — frame is natively blue
    pillFill: 0x0a1830,
    pillText: '#3dccff',
    cssText:  '#88ccff',
  },
  puzzle: {
    tint:     0xffdd66,   // warm yellow (tint-multiplied from blue — muddy; TODO: native orange slices)
    pillFill: 0x0a3340,
    pillText: '#3dccdd',
    cssText:  '#ffee88',
  },
  tower: {
    tint:     0xff99cc,   // pink (tint-multiplied from blue — muddy; TODO: native magenta slices)
    pillFill: 0x330055,
    pillText: '#ff99dd',
    cssText:  '#ff88bb',
  },
};

export const PAINT = {
  red:    0xff3344,
  blue:   0x3388ff,
  yellow: 0xffdd33,
  green:  0x33ff88,
  black:  0x1a1319,
};

export const FONTS = {
  display: 'Bungee, monospace',
  body:    'ChangaOne, Arial, sans-serif',
};

export const SIZES = {
  touchMin:    44,
  touchPref:   56,

  s0: 4, s1: 8, s2: 12, s3: 16, s4: 24, s5: 32, s6: 48, s7: 64,

  // Card geometry
  cardW:        300,
  cardH:        380,
  cardGap:      24,

  // Pill geometry
  pillH:        48,
  pillRadius:   24,
  pillPadX:     20,
  pillBorder:   4,
  pillSmallH:   38,

  // Button
  btnHeight:    56,
  btnHeightSm:  40,
  btnRadius:    14,

  // Generic
  borderThick:  6,
  shadowOffset: 6,
};

export const DEPTH = {
  bg:       0,
  bgFx:     5,
  panel:    10,
  panelFx:  15,
  content:  20,
  pill:     25,
  overlay:  100,
  modal:    200,
  hud:      300,
};

// hex int → CSS string for Phaser text styles
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
