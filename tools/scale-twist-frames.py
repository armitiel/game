"""
Fix twist frames: undo center-aligned scale, then redo with bottom-aligned scale.
Step 1: Downscale current frames by 1/1.3 (undo previous center-crop scale)
Step 2: Re-scale by 1.3x with bottom alignment (feet stay in place)
"""
from PIL import Image

SRC = 'public/assets/sprites/player_combined_sheet.png'
DST = 'public/assets/sprites/player_combined_sheet.png'

FRAME_W = 96
FRAME_H = 144
TWIST_START = 150
TWIST_END = 177
SCALE = 1.3

img = Image.open(SRC)
cols = img.width // FRAME_W

for i in range(TWIST_START, TWIST_END + 1):
    r = i // cols
    c = i % cols
    fx = c * FRAME_W
    fy = r * FRAME_H

    frame = img.crop((fx, fy, fx + FRAME_W, fy + FRAME_H))

    # Step 1: Undo previous center-aligned 1.3x scale
    # The previous script scaled up 1.3x then center-cropped.
    # To undo: pad back to the larger size, then shrink.
    new_w = int(FRAME_W * SCALE)   # 124
    new_h = int(FRAME_H * SCALE)   # 187
    cx = (new_w - FRAME_W) // 2    # 14
    cy = (new_h - FRAME_H) // 2    # 21

    # Place current frame back in the larger canvas at center position
    padded = Image.new('RGBA', (new_w, new_h), (0, 0, 0, 0))
    padded.paste(frame, (cx, cy))

    # Shrink back to original size — this approximates the original frame
    original = padded.resize((FRAME_W, FRAME_H), Image.LANCZOS)

    # Step 2: Re-scale with BOTTOM alignment
    # Scale up the restored original
    scaled = original.resize((new_w, new_h), Image.LANCZOS)

    # Crop: horizontally centered, vertically aligned to bottom
    crop_x = (new_w - FRAME_W) // 2
    crop_y = new_h - FRAME_H  # bottom-aligned: keep bottom pixels
    cropped = scaled.crop((crop_x, crop_y, crop_x + FRAME_W, crop_y + FRAME_H))

    img.paste(cropped, (fx, fy))

img.save(DST, 'PNG')
print(f"Re-scaled twist frames {TWIST_START}-{TWIST_END} by {SCALE}x (bottom-aligned)")
