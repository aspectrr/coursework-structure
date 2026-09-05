#!/usr/bin/env python3
"""
Generate the Coursework desktop app icon per DESIGN.md (SavvyCal style):
forest-stage squircle with a radial forest→moss gradient and concentric
arcs (hero background motif), a cream editorial-serif "cw" monogram
(Playfair Display Bold, vendored OFL font) with a lime-sprout period and
the signature coral wavy underline.

Icon geometry follows the Apple macOS icon grid: 824×824 artwork inside a
1024×1024 canvas (~100px transparent margins), so the icon matches every
other app's optical size in the Dock instead of rendering oversized.

Run: python3 scripts/make-icon.py
Outputs: src-tauri/icons/app-icon.png (1024x1024 RGBA master)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

CANVAS = 1024
SS = 2  # supersample factor
W = H = CANVAS * SS

# DESIGN.md palette
FOREST = (13, 84, 43)        # --color-forest-stage
MOSS = (0, 130, 54)          # --color-moss
LIME = (185, 255, 120)       # --color-lime-sprout
CORAL = (245, 67, 32)        # --color-ember-coral
CREAM = (252, 247, 237)      # --color-cream-paper

# macOS icon grid: artwork occupies the central 824/1024 of the canvas
ART = int(CANVAS * 0.805 * SS)          # 824 @2x
MARGIN = (W - ART) // 2
SQUIRCLE_RADIUS = int(ART * 0.2237)     # Apple big-sur corner ratio

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "fonts", "PlayfairDisplay.ttf")


def radial_gradient(size, inner, outer, center, radius):
    """RGB radial gradient (PIL built-in mask, no numpy) as a PIL image."""
    t = Image.radial_gradient("L").resize((size, size), Image.BICUBIC)
    inner_img = Image.new("RGB", (size, size), inner)
    outer_img = Image.new("RGB", (size, size), outer)
    return Image.composite(outer_img, inner_img, t)


def main():
    # ---- forest-stage squircle with radial forest→moss gradient ----
    grad = radial_gradient(
        W, FOREST, MOSS,
        center=(W * 0.5, W * 0.42),          # slightly high center, like the hero
        radius=W * 0.75,
    )
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (MARGIN, MARGIN, MARGIN + ART, MARGIN + ART), radius=SQUIRCLE_RADIUS, fill=255
    )
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img, "RGBA")

    # ---- concentric arcs (hero background spiral motif) ----
    # separate layer + alpha_composite: reliable alpha blending
    arcs = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    cx, cy = W // 2, int(W * 0.42)
    for r in range(int(W * 0.18), int(W * 0.62), int(W * 0.055)):
        ad.ellipse(
            (cx - r, cy - r, cx + r, cy + r),
            outline=CREAM + (10,),
            width=max(2, SS * 2),
        )
    img.alpha_composite(arcs)
    d = ImageDraw.Draw(img, "RGBA")

    # ---- serif monogram "cw" + lime period ----
    font = ImageFont.truetype(FONT_PATH, int(W * 0.38))
    font.set_variation_by_name("Bold")

    def text_len(s, f):
        b = d.textbbox((0, 0), s, font=f)
        return b[2] - b[0]

    # optical centering: serif baseline sits slightly high
    tx, ty = W // 2, int(H * 0.475)
    len_cw = text_len("cw", font)
    dot = "."
    dot_font = ImageFont.truetype(FONT_PATH, int(W * 0.22))
    dot_font.set_variation_by_name("Bold")
    len_dot = text_len(dot, dot_font)
    gap = int(W * 0.005)
    total = len_cw + gap + len_dot
    x0 = tx - total // 2

    # letters need manual y-offset: textbbox measures from ascender line
    b = d.textbbox((0, 0), "cw", font=font)
    d.text((x0 - b[0], ty - b[3]), "cw", font=font, fill=CREAM + (255,))
    bd = d.textbbox((0, 0), dot, font=dot_font)
    # baseline-align the period with the letters (bbox bottom ≈ baseline, no descenders)
    d.text((x0 + len_cw + gap - bd[0], ty - bd[3]), dot, font=dot_font, fill=LIME + (255,))

    # ---- coral wavy underline (signature micro-pattern) ----
    wave_w = int(total * 0.6)
    wave_x0 = tx - wave_w // 2
    wave_y = ty + int(W * 0.035)
    amp = int(W * 0.008)
    period = int(W * 0.028)
    stroke = max(4, int(W * 0.007))
    pts = []
    for i in range(0, wave_w + 1, 4):
        x = wave_x0 + i
        y = wave_y + amp * math.sin(2 * math.pi * i / period)
        pts.append((x, y))
    # soft coral glow under the stroke, then the stroke itself
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).line(pts, fill=CORAL + (110,), width=stroke * 3)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(stroke)))
    d.line(pts, fill=CORAL + (255,), width=stroke, joint="curve")

    # ---- downsample to canvas ----
    img = img.resize((CANVAS, CANVAS), Image.LANCZOS)

    out_dir = os.path.join(HERE, "..", "src-tauri", "icons")
    os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, "app-icon.png"))
    print(f"wrote src-tauri/icons/app-icon.png ({CANVAS}x{CANVAS}, artwork {ART // SS}px)")


if __name__ == "__main__":
    main()
