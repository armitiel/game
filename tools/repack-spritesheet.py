"""
Repack a single-row spritesheet into a multi-row grid that fits within WebGL limits.
Usage: python tools/repack-spritesheet.py
"""
from PIL import Image

SRC = 'public/assets/sprites/player_combined_sheet.png'
DST = 'public/assets/sprites/player_combined_sheet.png'

FRAME_W = 96
FRAME_H = 144
MAX_TEX_W = 4096  # WebGL safe limit

img = Image.open(SRC)
total_frames = img.width // FRAME_W
print(f"Source: {img.width}x{img.height}, {total_frames} frames")

cols = MAX_TEX_W // FRAME_W  # 42
rows = (total_frames + cols - 1) // cols  # 5
new_w = cols * FRAME_W   # 4032
new_h = rows * FRAME_H   # 720

print(f"Target: {new_w}x{new_h} ({cols} cols x {rows} rows)")

out = Image.new('RGBA', (new_w, new_h), (0, 0, 0, 0))

for i in range(total_frames):
    src_x = i * FRAME_W
    r = i // cols
    c = i % cols
    dst_x = c * FRAME_W
    dst_y = r * FRAME_H
    frame = img.crop((src_x, 0, src_x + FRAME_W, FRAME_H))
    out.paste(frame, (dst_x, dst_y))

out.save(DST, 'PNG')
print(f"Saved: {DST} ({new_w}x{new_h})")
