"""
Rebuild player_combined_sheet.png from original 1080x1080 animation frames.
Frames are scaled proportionally to fit 96x144, bottom-aligned.
Twist frames get an additional 1.3x scale (bottom-aligned).
Content-fit anims (like run) scale based on alpha bbox so feet align properly.
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
# Tuple: (folder, count, extra_scale, content_fit)
# content_fit: if True, scale based on alpha bbox so character fills frame properly
ANIMS = [
    ('idle',   18, 1.0,         False),  # 0-17
    ('walk',   36, 1.0,         False),  # 18-53
    ('jump',   20, 1.0,         False),  # 54-73
    ('push',   24, 1.0,         False),  # 74-97
    ('climb',  19, 1.0,         False),  # 98-116
    ('climb2', 20, 1.0,         False),  # 117-136
    ('paint',  25, 1.0,         False),  # 137-161
    ('Twist',  28, TWIST_SCALE, False),  # 162-189
    ('Side',   28, 1.0,         False),  # 190-217
    ('Hide',   17, 1.0,         False),  # 218-234
    ('run',    18, 1.0,         True),   # 235-252  (no flip needed)
]

# Reference: walk frame content height for scaling content-fit anims
# We compute this once from the first walk frame
_ref_content_ratio = None


def load_frames(folder_name, count):
    folder = os.path.join(BASE, folder_name)
    if not os.path.isdir(folder):
        raise FileNotFoundError(f"Folder not found: {folder}")
    files = sorted(glob.glob(os.path.join(folder, '*.png')))
    if len(files) < count:
        raise ValueError(f"{folder}: expected {count}, found {len(files)}")
    return [Image.open(f).convert('RGBA') for f in files[:count]]


def get_alpha_bbox(img):
    """Get bounding box of non-transparent pixels."""
    alpha = img.split()[3]
    return alpha.getbbox()


def fit_frame(src, tw, th, extra_scale=1.0):
    """
    Fit 1080x1080 source into 96x144 frame:
    - Scale to height (144px for 1080)
    - Center horizontally to 96px
    - Bottom-aligned + global Y offset
    """
    sw, sh = src.size
    base_scale = th / sh
    total_scale = base_scale * extra_scale
    new_w = int(sw * total_scale)
    new_h = int(sh * total_scale)

    resized = src.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    paste_x = (tw - new_w) // 2
    paste_y = th - new_h + GLOBAL_Y_OFFSET
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def fit_frame_content(src, tw, th, ref_frames):
    """
    Content-aware fit for frames where character is NOT bottom-aligned.
    Uses the tallest frame in the batch as reference to keep all frames
    at consistent scale, then aligns feet at the walk reference position.
    """
    global _ref_content_ratio

    # Compute reference from walk frames (once)
    if _ref_content_ratio is None and ref_frames:
        heights = []
        feet_from_bottom = []
        for rf in ref_frames[:8]:
            bbox = get_alpha_bbox(rf)
            if bbox:
                heights.append(bbox[3] - bbox[1])
                feet_from_bottom.append(rf.size[1] - bbox[3])
        if heights:
            _ref_content_ratio = {
                'avg_h': sum(heights) / len(heights),
                'avg_feet_offset': sum(feet_from_bottom) / len(feet_from_bottom),
                'src_h': ref_frames[0].size[1],
            }

    bbox = get_alpha_bbox(src)
    if not bbox or not _ref_content_ratio:
        return fit_frame(src, tw, th)

    sw, sh = src.size
    cx, cy, cx2, cy2 = bbox
    content_h = cy2 - cy
    content_w = cx2 - cx

    ref = _ref_content_ratio
    base_scale = th / ref['src_h']

    # Use batch-wide consistent scale and fixed feet line
    if hasattr(fit_frame_content, '_batch_scale'):
        total_scale = fit_frame_content._batch_scale
    else:
        char_scale_h = ref['avg_h'] / content_h
        margin = 4
        char_scale_w = ((tw - margin * 2) / base_scale) / content_w
        total_scale = base_scale * min(char_scale_h, char_scale_w)

    new_w = int(sw * total_scale)
    new_h = int(sh * total_scale)
    resized = src.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))

    # Fixed anchor: place the ENTIRE source image at a consistent position
    # so the natural bounce (feet going up/down) is preserved.
    # Anchor: source center maps to a fixed Y in the output frame.
    # Use average feet Y across batch as the ground reference.
    avg_feet = getattr(fit_frame_content, '_batch_avg_bottom', cy2)
    target_feet_y = int((ref['src_h'] - ref['avg_feet_offset']) * base_scale) + GLOBAL_Y_OFFSET
    # Position the whole image so that avg_feet line lands at target
    avg_feet_scaled = int(avg_feet * total_scale)
    paste_y = target_feet_y - avg_feet_scaled

    # Center horizontally using source frame center (not per-frame content center)
    paste_x = (tw - new_w) // 2

    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def precompute_content_batch_scale(frames, tw, th, ref_frames):
    """
    Pre-scan all content-fit frames to find ONE consistent scale
    that fits the tallest/widest frame, then apply to all.
    """
    global _ref_content_ratio
    # Ensure ref is computed
    if _ref_content_ratio is None:
        fit_frame_content(frames[0], tw, th, ref_frames)

    ref = _ref_content_ratio
    base_scale = th / ref['src_h']

    # Find the frame that needs the most scaling (tallest content)
    # and the widest frame — use the most constrained.
    # Also find the max bottom (feet Y) across all frames for stable ground line.
    best_scale = None
    max_bottom = 0
    all_bottoms = []
    for f in frames:
        bbox = get_alpha_bbox(f)
        if not bbox:
            continue
        ch = bbox[3] - bbox[1]
        cw = bbox[2] - bbox[0]
        all_bottoms.append(bbox[3])
        if bbox[3] > max_bottom:
            max_bottom = bbox[3]
        # Scale to match walk height
        s_h = base_scale * (ref['avg_h'] / ch)
        # Scale to fit frame width
        margin = 4
        s_w = (tw - margin * 2) / cw
        s = min(s_h, s_w)
        if best_scale is None or s < best_scale:
            best_scale = s

    fit_frame_content._batch_scale = best_scale
    fit_frame_content._batch_max_bottom = max_bottom
    avg_bottom = sum(all_bottoms) / len(all_bottoms) if all_bottoms else max_bottom
    fit_frame_content._batch_avg_bottom = avg_bottom
    print(f"  Content-fit batch scale: {best_scale:.4f}, avg feet Y: {avg_bottom:.0f}, max: {max_bottom}")


# First pass: load walk frames as reference for content-fit
print("Loading walk reference frames...")
walk_ref = load_frames('walk', 5)

all_frames = []
for anim_name, count, extra_scale, content_fit in ANIMS:
    print(f"Loading {anim_name}: {count} frames...")
    frames = load_frames(anim_name, count)
    if content_fit:
        precompute_content_batch_scale(frames, FRAME_W, FRAME_H, walk_ref)
    for f in frames:
        if content_fit:
            fitted = fit_frame_content(f, FRAME_W, FRAME_H, walk_ref)
        else:
            fitted = fit_frame(f, FRAME_W, FRAME_H, extra_scale=extra_scale)
        all_frames.append(fitted)
    if content_fit:
        # Clean up batch state for next content-fit anim
        if hasattr(fit_frame_content, '_batch_scale'):
            del fit_frame_content._batch_scale
        if hasattr(fit_frame_content, '_batch_max_bottom'):
            del fit_frame_content._batch_max_bottom
        if hasattr(fit_frame_content, '_batch_avg_bottom'):
            del fit_frame_content._batch_avg_bottom

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
