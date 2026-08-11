#!/usr/bin/env python3
"""Generate DARKWEB toolbar icons: a glowing flashlight halo in the dark.

ON  = bright warm-white halo on a near-black tile.
OFF = dim grey halo (disabled).

Renders each size at 4x then downsamples for clean anti-aliased edges.
Outputs: assets/icons/icon-{16,32,48,128}.png       (ON)
         assets/icons/icon-{16,32,48,128}-off.png    (OFF)

Run:  ./.venv/bin/python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

SIZES = [16, 32, 48, 128]
OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"

TILE = (6, 6, 10, 255)        # near-black background
GLOW_ON = (236, 236, 245)     # bright cold-white torch
GLOW_OFF = (120, 120, 130)    # dim grey (disabled)


def make(size: int, glow_color, suffix: str):
    scale = 4
    S = size * scale
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    radius = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=TILE)

    # Radial gradient: 0 at centre → 255 at edge; invert so centre is brightest.
    grad = Image.radial_gradient("L").resize((S, S), Image.LANCZOS)
    glow = ImageChops.invert(grad)
    # Tighten the falloff so it reads as a torch halo, not a wash.
    glow = glow.point(lambda p: int((p / 255) ** 1.8 * 255))

    color_layer = Image.new("RGBA", (S, S), glow_color + (0,))
    color_layer.putalpha(glow)
    tile.alpha_composite(color_layer)

    # A small bright core so the beam has a hot centre.
    core_r = int(S * 0.06)
    cx = cy = S // 2
    d.ellipse(
        [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
        fill=(glow_color[0], glow_color[1], glow_color[2], 255),
    )

    img = tile.resize((size, size), Image.LANCZOS)
    path = OUT / f"icon-{size}{suffix}.png"
    img.save(path)
    return path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for s in SIZES:
        made.append(make(s, GLOW_ON, ""))
        made.append(make(s, GLOW_OFF, "-off"))
    print(f"Wrote {len(made)} icons to {OUT}")
    for p in made:
        print("  ", p.name)


if __name__ == "__main__":
    main()
