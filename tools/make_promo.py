#!/usr/bin/env python3
"""Generate DARKWEB store promo assets + a popup composite screenshot.

Outputs:
  store/screenshots/store-4-popup.png   1280x800  (settings popup on a dark canvas)
  store/promo/small-tile-440x280.png    440x280   (Small promo tile)
  store/promo/marquee-1400x560.png      1400x560  (Marquee promo tile)

All saved as 24-bit RGB PNG (no alpha), as the store requires for promo tiles.

Run:  ./.venv/bin/python tools/make_promo.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "store" / "screenshots"
PROMO = ROOT / "store" / "promo"
PROMO.mkdir(parents=True, exist_ok=True)

BG = (8, 8, 11)
WHITE = (236, 236, 245)
DIM = (150, 150, 160)

FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]
FONT_CANDIDATES_REG = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
]


def font(size, bold=True):
    for p in FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REG:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def glow(canvas, cx, cy, diameter, color=WHITE, strength=1.0):
    """Composite a soft, perfectly round flashlight halo centred at (cx,cy).

    A filled white disc, heavily Gaussian-blurred → smooth circular falloff with
    no square/elliptical edge artefact.
    """
    D = int(diameter)
    alpha = Image.new("L", (D, D), 0)
    ad = ImageDraw.Draw(alpha)
    r0 = D * 0.22
    ad.ellipse([D / 2 - r0, D / 2 - r0, D / 2 + r0, D / 2 + r0], fill=int(255 * strength))
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=D * 0.14))
    layer = Image.new("RGBA", (D, D), color + (0,))
    layer.putalpha(alpha)
    canvas.alpha_composite(layer, (int(cx - D / 2), int(cy - D / 2)))


def tracked_text(draw, xy, text, fnt, fill, tracking=0):
    """Draw text with manual letter-spacing; returns total width."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        w = draw.textlength(ch, font=fnt)
        x += w + tracking
    return x - xy[0]


def base(w, h):
    img = Image.new("RGBA", (w, h), BG + (255,))
    return img


def wordmark_block(img, x, y, title_size, tag_size, tracking):
    d = ImageDraw.Draw(img)
    tracked_text(d, (x, y), "DARKWEB", font(title_size, True), WHITE, tracking)
    d.text((x + 2, y + int(title_size * 1.25)), "lights out. your mouse is the torch.",
           font=font(tag_size, False), fill=DIM)


def make_small():
    w, h = 440, 280
    img = base(w, h)
    glow(img, w * 0.74, h * 0.5, 300, WHITE, 1.0)
    wordmark_block(img, 28, 96, 40, 15, 3)
    out = PROMO / "small-tile-440x280.png"
    img.convert("RGB").save(out)
    return out


def make_marquee():
    w, h = 1400, 560
    img = base(w, h)
    glow(img, w * 0.68, h * 0.5, 620, WHITE, 1.0)
    glow(img, w * 0.68, h * 0.5, 300, WHITE, 0.9)
    d = ImageDraw.Draw(img)
    tracked_text(d, (90, 210), "DARKWEB", font(96, True), WHITE, 10)
    d.text((94, 330), "lights out. your mouse is the torch.",
           font=font(30, False), fill=DIM)
    out = PROMO / "marquee-1400x560.png"
    img.convert("RGB").save(out)
    return out


def make_popup_composite():
    w, h = 1280, 800
    img = base(w, h)
    # faint vignette-ish glow behind the panel
    glow(img, w * 0.62, h * 0.5, 900, WHITE, 0.25)

    popup = Image.open(SHOTS / "popup-raw.png").convert("RGBA")
    scale = 1.5
    popup = popup.resize((int(popup.width * scale), int(popup.height * scale)), Image.LANCZOS)
    # soft drop shadow
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sx, sy = 150, (h - popup.height) // 2
    shadow_box = Image.new("RGBA", (popup.width + 40, popup.height + 40), (0, 0, 0, 140))
    img.alpha_composite(shadow_box, (sx - 20, sy - 12))
    img.alpha_composite(popup, (sx, sy))

    # caption on the right
    d = ImageDraw.Draw(img)
    tx = sx + popup.width + 90
    d.text((tx, 250), "Tune the dark.", font=font(58, True), fill=WHITE)
    lines = [
        "Halo size and darkness — sliders.",
        "Torch flicker — the beam breathes.",
        "Spooky drone — low, cinematic dread.",
        "Exit anytime: toolbar switch, hotkey, or Esc.",
    ]
    yy = 350
    for ln in lines:
        d.text((tx, yy), ln, font=font(28, False), fill=DIM)
        yy += 48

    out = SHOTS / "store-4-popup.png"
    img.convert("RGB").save(out)
    return out


def main():
    made = [make_popup_composite(), make_small(), make_marquee()]
    for p in made:
        im = Image.open(p)
        print(f"  {p.relative_to(ROOT)}  {im.size}  mode={im.mode}")


if __name__ == "__main__":
    main()
