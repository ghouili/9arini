#!/usr/bin/env python3
"""Build every raster brand asset from brand/logo-source.png.

    python scripts/brand/build-raster.py

WHY PYTHON, IN A NODE REPO
    `sharp` is not installed and adding it was out of scope. Pillow is already on
    the machine, costs the project no npm dependency, and this runs by hand when
    the logo changes — not in CI, not at build time.

WHY THE SOURCE FILE MOVED
    brand/logo-source.png is the 1.18 MB master and is NOT in public/, so it can
    never be served by accident. Everything in public/ is generated from it.

THE ONE THING THAT MATTERS HERE
    `next/image` cannot resize anything in this project: Next 14 needs `sharp`
    for that, and without it /_next/image passes the original file straight
    through (verified: a request for w=64 returned the full 1,203,573-byte PNG).
    So the file on disk IS what every visitor downloads. That is why logo.png is
    emitted pre-sized at roughly 2x its largest on-screen use rather than at
    source resolution — the usual "ship a big source and let the optimiser sort
    it out" assumption is false here.

    If `sharp` is ever added, raise TARGET_H and let Next do the work.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "brand", "logo-source.png")
PUB = os.path.join(ROOT, "public")

COBALT = (0x0E, 0x5A, 0xA6)     # --blue, and the themeColor already in metadata
WHITE = (0xFF, 0xFF, 0xFF)

# Largest on-screen use is the 38px header mark; 256 is ~6.7x that, which keeps
# it crisp on a 3x phone at any size the UI is likely to grow into, while still
# compressing to a few kB because the artwork is two flat colours.
TARGET_H = 256


def load_mark():
    """The mark, cropped to its own ink. The source carries ~15% dead padding on
    every side, which would otherwise become mystery whitespace at every call
    site and force each one to compensate with negative margins."""
    im = Image.open(SRC).convert("RGBA")
    return im.crop(im.getbbox())


def recolour(mark, rgb):
    """Replace RGB, keep alpha byte-for-byte.

    This is the reason a white variant can be generated rather than requested:
    the mark is ONE flat colour and every soft edge lives in the ALPHA channel,
    not in lighter shades of the ink. Rewriting RGB therefore cannot muddy an
    edge — the anti-aliasing is untouched. A CSS `brightness(0) invert(1)` would
    have gone through the colour channels and done exactly the damage we avoided.
    """
    out = mark.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            px[x, y] = (rgb[0], rgb[1], rgb[2], px[x, y][3])
    return out


def fit(mark, box_w, box_h, frac):
    """Scale the mark so its LONGEST side is `frac` of the box. The mark is
    1.44:1, so fitting by width alone would leave it looking undersized on a
    square icon."""
    scale = min(box_w * frac / mark.width, box_h * frac / mark.height)
    return mark.resize((max(1, round(mark.width * scale)),
                        max(1, round(mark.height * scale))), Image.LANCZOS)


def rounded_mask(side, radius_frac=0.22):
    from PIL import ImageDraw
    # 4x supersample: a hard-edged rounded rect at 16px is visibly jagged.
    s = side * 4
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1],
                                        radius=int(s * radius_frac), fill=255)
    return m.resize((side, side), Image.LANCZOS)


def tile(mark_white, side, rounded):
    """Cobalt tile with the mark knocked out in white.

    A filled tile, not a bare mark: at 16px the line art dissolves into grey
    mush, but a saturated cobalt block still reads as *this* brand in a strip of
    tabs. Same reasoning the previous ق favicon used."""
    t = Image.new("RGBA", (side, side), COBALT + (255,))
    m = fit(mark_white, side, side, 0.78)
    t.paste(m, ((side - m.width) // 2, (side - m.height) // 2), m)
    if rounded:
        t.putalpha(rounded_mask(side))
    return t


def save_png(im, name, quantise=True):
    p = os.path.join(PUB, name)
    if quantise and im.mode == "RGBA":
        # Two flat colours + an alpha ramp: a 64-colour palette is lossless here
        # in practice and roughly halves the file again on top of PNG deflate.
        im = im.quantize(colors=64, method=Image.FASTOCTREE).convert("RGBA")
    im.save(p, "PNG", optimize=True)
    return p, os.path.getsize(p)


def main():
    mark = load_mark()
    print(f"source mark: {mark.width}x{mark.height}  (aspect {mark.width/mark.height:.3f})")

    h = TARGET_H
    w = round(mark.width * h / mark.height)
    ink = mark.resize((w, h), Image.LANCZOS)
    white = recolour(ink, WHITE)

    out = []
    out.append(save_png(ink, "logo.png"))
    out.append(save_png(white, "logo-white.png"))

    # iOS applies its own squircle mask and does NOT honour transparency — a
    # transparent PNG renders on black. Full-bleed, no rounding, no alpha.
    apple = tile(recolour(mark, WHITE), 180, rounded=False).convert("RGB")
    out.append(save_png(apple, "apple-touch-icon.png", quantise=False))

    # Browsers draw the favicon as-is, so it rounds its own corners.
    mw = recolour(mark, WHITE)
    icons = [tile(mw, s, rounded=True) for s in (16, 32, 48)]
    ico = os.path.join(PUB, "favicon.ico")
    icons[-1].save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    out.append((ico, os.path.getsize(ico)))
    out.append(save_png(icons[1], "favicon-32.png", quantise=False))

    print()
    for p, n in out:
        print(f"  {n/1024:8.1f} kB  {os.path.relpath(p, ROOT)}")
    print(f"\n  source was {os.path.getsize(SRC)/1024:.1f} kB")


if __name__ == "__main__":
    main()
