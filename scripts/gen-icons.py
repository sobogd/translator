"""Generates the site's favicon/icon set from the LogoIcon artwork.

One rounded-square brand tile (#d9534f, radius 96/512 as in LogoIcon) with a
white "IQ" mark, rendered large then downscaled so every size shares the same
crisp shapes:

    public/icon-512.png   public/icon-192.png    (PWA / manifest)
    public/apple-icon.png                        (iOS home-screen, 180px)
    app/favicon.ico                              (16/32/48/64 multi-size)

Re-run after a brand/palette change:
    python3 scripts/gen-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "public")
FAVICON = os.path.join(HERE, "..", "app", "favicon.ico")
SF = "/System/Library/Fonts/SFNS.ttf"  # SF Pro (macOS)
ACCENT = (217, 83, 79)  # brand red #d9534f, solid
BASE = 512  # render at 512, downscale from there


def sf(size, weight="Bold"):
    f = ImageFont.truetype(SF, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def tile(size, radius):
    """Solid rounded-square brand tile with transparent corners."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius, fill=ACCENT)
    return img


def render(size, radius, text_size):
    img = tile(size, radius)
    d = ImageDraw.Draw(img)
    d.text(
        (size / 2, size / 2),
        "IQ",
        font=sf(text_size),
        fill=(255, 255, 255),
        anchor="mm",
    )
    return img


def main():
    # Master render (matches LogoIcon's viewBox proportions).
    master = render(BASE, BASE * 96 // 512, BASE * 280 // 512)

    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-icon.png", 180)]:
        out = os.path.join(PUBLIC, name)
        img = master if size == BASE else master.resize((size, size), Image.LANCZOS)
        img.save(out, "PNG", optimize=True)
        print("wrote", os.path.normpath(out), img.size)

    # Multi-size .ico: Next serves favicon.ico from app/. Pillow renders the
    # smaller sizes from the 512px master automatically.
    ico_sizes = [16, 32, 48, 64]
    master.save(FAVICON, format="ICO", sizes=[(s, s) for s in ico_sizes])
    print("wrote", os.path.normpath(FAVICON), ico_sizes)


if __name__ == "__main__":
    main()
