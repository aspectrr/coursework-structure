#!/usr/bin/env python3
"""
Generate the Coursework desktop app icon: a graduation cap (mortarboard)
on a warm cream rounded-square background, with the app's accent orange
tassel. Matches the app's ink + paper + accent visual language.

Run: python3 scripts/make-icon.py
Outputs: src-tauri/icons/app-icon.png (1024x1024 RGBA master)
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

W = H = 1024
CREAM = (247, 247, 245)         # ink-50 (app bg)
CREAM_EDGE = (216, 209, 196)    # ink-200 (border tone)
INK = (28, 26, 22)              # ink-900
INK_SOFT = (75, 68, 57)         # ink-700
ACCENT = (199, 91, 57)          # accent
ACCENT_DIM = (139, 61, 36)      # accent-dim
SHADOW = (28, 26, 22, 60)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def rounded_gradient_bg(size, radius, top, bottom):
    """Vertical gradient inside a rounded square."""
    # build gradient via numpy
    t = np.linspace(0, 1, size).reshape(-1, 1)
    top_arr = np.array(top, dtype=np.float32)
    bot_arr = np.array(bottom, dtype=np.float32)
    row = top_arr * (1 - t) + bot_arr * t           # (size, 3)
    grad_rgb = np.broadcast_to(row[:, None, :], (size, size, 3)).astype(np.uint8)
    alpha = np.full((size, size, 1), 255, dtype=np.uint8)
    grad = np.concatenate([grad_rgb, alpha], axis=2)
    img = Image.fromarray(grad, "RGBA")

    # mask to rounded square
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out, mask

def draw_mortarboard(img, cx, cy, board_w, board_h):
    """Draw a graduation cap (mortarboard only, no head/body) centered at (cx, cy).

    The board is the universal graduation symbol; adding a head underneath
    reads as noise at icon sizes.
    """
    d = ImageDraw.Draw(img, "RGBA")

    # ---- soft shadow under cap ----
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.ellipse(
        (cx - int(board_w * 0.42), cy + board_h // 2 + int(board_h * 0.08),
         cx + int(board_w * 0.42), cy + board_h // 2 + int(board_h * 0.08) + 50),
        fill=(0, 0, 0, 60),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(26))
    img.alpha_composite(shadow_layer)

    # ---- mortarboard (diamond / rotated square) ----
    # perspective: top edge narrower than bottom edge for slight 3D feel
    half_w = board_w // 2
    top_y = cy - board_h // 2
    bot_y = cy + board_h // 2
    top_inset = int(half_w * 0.18)  # top edge slightly narrower
    board = [
        (cx - half_w, cy),               # left point
        (cx - top_inset, top_y),         # top-left
        (cx + top_inset, top_y),         # top-right
        (cx + half_w, cy),               # right point
        (cx + top_inset, bot_y),         # bottom-right
        (cx - top_inset, bot_y),         # bottom-left
    ]
    d.polygon(board, fill=INK)

    # top-edge highlight for bevel
    d.line(
        [(cx - top_inset, top_y), (cx + top_inset, top_y)],
        fill=lerp(INK, (255, 255, 255), 0.20) + (255,), width=8,
    )
    # bottom-edge shadow for depth
    d.line(
        [(cx - top_inset, bot_y), (cx + top_inset, bot_y)],
        fill=lerp(INK, (0, 0, 0), 0.4) + (255,), width=6,
    )

    # ---- center button on the board (where tassel attaches) ----
    button_r = int(board_w * 0.05)
    d.ellipse(
        (cx - button_r, cy - button_r, cx + button_r, cy + button_r),
        fill=ACCENT,
    )

    # ---- tassel: cord from button, sweeping right then hanging straight down ----
    cord_w = max(8, int(board_w * 0.026))
    cord_pts = []
    # Phase 1: bezier sweep from button out past the right edge of the board
    for i in range(0, 81):
        t = i / 80
        x0, y0 = cx, cy
        x1, y1 = cx + half_w * 0.80, cy - board_h * 0.05  # control: out, roughly level
        x2, y2 = cx + half_w * 1.04, cy + board_h * 0.12   # end: just past right point
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2
        cord_pts.append((x, y))
    # Phase 2: dangle straight down
    dangle_top = cord_pts[-1]
    dangle_bot_y = cy + int(board_h * 0.55)
    steps = 24
    for i in range(1, steps + 1):
        t = i / steps
        cord_pts.append((dangle_top[0], dangle_top[1] + t * (dangle_bot_y - dangle_top[1])))

    for i in range(len(cord_pts) - 1):
        d.line([cord_pts[i], cord_pts[i + 1]], fill=ACCENT, width=cord_w)

    # ---- tassel fringe at the bottom ----
    fringe_top = cord_pts[-1]
    fringe_len = int(board_w * 0.16)
    strand_w = max(3, cord_w - 3)
    # knot band just above the fringe
    knot_h = max(10, cord_w + 6)
    d.rounded_rectangle(
        (fringe_top[0] - cord_w * 1.3, fringe_top[1] - knot_h // 2,
         fringe_top[0] + cord_w * 1.3, fringe_top[1] + knot_h // 2),
        radius=knot_h // 2, fill=ACCENT_DIM,
    )
    # bundled strands fanning slightly outward
    for k in range(-4, 5):
        offset = k * max(2, strand_w // 2 + 1)
        d.line(
            [(fringe_top[0] + offset, fringe_top[1]),
             (fringe_top[0] + offset + (k * 2), fringe_top[1] + fringe_len)],
            fill=ACCENT, width=strand_w,
        )

def main():
    img, _mask = rounded_gradient_bg(W, int(W * 0.2237), CREAM, lerp(CREAM, (238, 234, 227), 1.0))
    # subtle inner border for definition on light backgrounds
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle(
        (0, 0, W - 1, H - 1), radius=int(W * 0.2237),
        outline=CREAM_EDGE, width=4,
    )

    # mortarboard sized to fill ~70% of icon
    cx, cy = W // 2, int(H * 0.44)
    draw_mortarboard(
        img,
        cx=cx, cy=cy,
        board_w=int(W * 0.74),
        board_h=int(H * 0.36),
    )

    out_dir = "src-tauri/icons"
    os.makedirs(out_dir, exist_ok=True)
    img.save(f"{out_dir}/app-icon.png")
    print(f"wrote {out_dir}/app-icon.png ({W}x{H})")

if __name__ == "__main__":
    main()
