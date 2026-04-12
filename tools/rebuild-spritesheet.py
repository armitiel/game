"""
Rebuild player_combined_sheet.png from original 1080x1080 animation frames.
Frames are scaled proportionally to fit 96x144, bottom-aligned.
Twist frames get an additional 1.3x scale (bottom-aligned).
"""
from PIL import Image, ImageFile
import os, glob

ImageFile.LOAD_TRUNCATED_IMAGES = True

BASE = 'public/assets/sprites'
OUT = f'{BASE}/player_combined_sheet.png'

FRAME_W = 96
FRAME_H = 144
MAX_TEX_W = 4096
TWIST_SCALE = 1.3
GLOBAL_Y_OFFSET = 15  # shift all content down to align feet with physics body

# Animation folders in order (matching gameConfig frame ranges)
# idle: 0-17, walk: 18-53, jump: 54-73, push: 74-97, climb: 98-116,
# climb2: 117-136, paint: 137-161, twist: 162-189, side: 190-217,
# hide: 218-234, run: 235-258
ANIMS = [
    ('idle',   18),   # 0-17
    ('walk',   36),   # 18-53
    ('jump',   20),   # 54-73
    ('push',   24),   # 74-97
    ('climb',  19),   # 98-116
    ('climb2', 20),   # 117-136
    ('paint',  25),   # 137-161
    ('Twist',  28),   # 162-189
    ('Side',   28),   # 190-217
    ('Hide',   17),   # 218-234
    ('run',    24),   # 235-258
]


def load_frames(folder_name, count):
    folder = os.path.join(BASE, folder_name)
    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Folder not found: {folder}")
    files = sorted(glob.glob(os.path.join(folder, '*.png')))
    if len(files) < count:
        raise ValueError(f"{folder}: expected {count}, found {len(files)}")
    return [Image.open(f).convert('RGBA') for f in files[:count]]


def fit_frame(src, tw, th, extra_scale=1.0):
    """
    Fit 1080x1080 source into 96x144 frame:
    - Scale to height (144px for 1080 → 144x144)
    - Center-crop horizontally to 96px
    - For twist: scale up extra, bottom-aligned crop
    """
    sw, sh = src.size

    # Scale full source to target height, preserving aspect ratio
    base_scale = th / sh  # 144/1080
    total_scale = base_scale * extra_scale
    new_w = int(sw * total_scale)
    new_h = int(sh * total_scale)

    resized = src.resize((new_w, new_h), Image.LANCZOS)

    # Place on canvas: horizontally centered, bottom-aligned
    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))

    paste_x = (tw - new_w) // 2
    paste_y = th - new_h + GLOBAL_Y_OFFSET  # bottom aligned + global shift down

    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


all_frames = []
for anim_name, count in ANIMS:
    print(f"Loading {anim_name}: {count} frames...")
    frames = load_frames(anim_name, count)
    is_twist = (anim_name == 'Twist')
    for f in frames:
        fitted = fit_frame(f, FRAME_W, FRAME_H,
                          extra_scale=TWIST_SCALE if is_twist else 1.0)
        all_frames.append(fitted)

total = len(all_frames)
cols = MAX_TEX_W // FRAME_W
rows = (total + cols - 1) // cols
sheet_w = cols * FRAME_W
sheet_h = rows * FRAME_H

print(f"Total: {total} frames, grid: {cols}x{rows}, sheet: {sheet_w}x{sheet_h}")

sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
for i, frame in enumerate(all_frames):
    r = i // cols
    c = i % cols
    sheet.paste(frame, (c * FRAME_W, r * FRAME_H))

sheet.save(OUT, 'PNG')
print(f"Saved: {OUT}")
