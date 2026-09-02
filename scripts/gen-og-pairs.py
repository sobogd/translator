"""Generates public/og/<locale>/<slug>.png — one social preview per language-pair page.

Until now all 259 URLs shared public/og.png, so every share and every AI card
looked identical no matter which pair was linked.

The card is deliberately Latin-only: it names the pair in English
("Japanese -> English") rather than in the page's own language. Rendering the
localized title would mean shipping CJK, Hangul and Arabic font families just
for this script, and this machine has an incomplete set of them (no PingFang,
Hiragino only in its GB cut) — a missing glyph silently renders as a blank box,
which is worse than an English label on a preview card.

Re-run after a brand change or after adding pairs:
    python3 scripts/gen-og-pairs.py
"""
import os
import re

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT_DIR = os.path.join(ROOT, "public", "og")
SF = "/System/Library/Fonts/SFNS.ttf"

W, H = 1200, 630
BG = (249, 246, 241)
TEXT = (21, 18, 15)
HINT = (114, 106, 96)
GRAD = ((255, 73, 41), (249, 158, 31))

# Only the codes that actually appear in lib/pairs.ts as a `from` or `to`.
ENGLISH_NAMES = {
    "en": "English", "es": "Spanish", "de": "German", "fr": "French", "it": "Italian",
    "pt": "Portuguese", "nl": "Dutch", "pl": "Polish", "ru": "Russian", "uk": "Ukrainian",
    "sv": "Swedish", "da": "Danish", "no": "Norwegian", "fi": "Finnish", "cs": "Czech",
    "el": "Greek", "tr": "Turkish", "ro": "Romanian", "hu": "Hungarian", "bg": "Bulgarian",
    "hr": "Croatian", "sk": "Slovak", "sl": "Slovenian", "et": "Estonian", "lv": "Latvian",
    "lt": "Lithuanian", "sr": "Serbian", "ca": "Catalan", "is": "Icelandic", "fa": "Persian",
    "ar": "Arabic", "ja": "Japanese", "ko": "Korean", "zh": "Chinese",
}


def sf(size, weight="Regular"):
    f = ImageFont.truetype(SF, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def gradient(w, h, radius):
    row = Image.new("RGB", (w, 1))
    for x in range(w):
        t = x / max(1, w - 1)
        row.putpixel((x, 0), tuple(round(GRAD[0][k] + (GRAD[1][k] - GRAD[0][k]) * t) for k in range(3)))
    tile = row.resize((w, h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius, fill=255)
    return tile, mask


def read_pairs():
    """Parses lib/pairs.ts — the registry is the single source of truth for
    which pair pages exist, so the images cannot drift from the routes."""
    src = open(os.path.join(ROOT, "lib", "pairs.ts"), encoding="utf-8").read()
    out = []
    for m in re.finditer(r'\.\.\.P\("(\w+)",\s*"(\w+)",\s*\[(.*?)\]\)', src, re.S):
        locale, src_lang, body = m.group(1), m.group(2), m.group(3)
        for n in re.finditer(r'\["(\w+)",\s*"([a-z0-9-]+)"\]', body):
            out.append((locale, src_lang, n.group(1), n.group(2)))
    return out


def fit(draw, text, size, max_width, weight="Bold"):
    """Shrinks the headline until it fits the content column — "Portuguese ->
    English" is a good deal wider than "Thai -> English"."""
    while size > 40:
        font = sf(size, weight)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 4
    return sf(size, weight)


def card(from_code, to_code):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    TILE = 132
    tile, mask = gradient(TILE, TILE, radius=TILE * 96 // 512)
    img.paste(tile, (96, 96), mask)
    ImageDraw.Draw(img).text(
        (96 + TILE / 2, 96 + TILE / 2), "IQ", font=sf(76, "Bold"), fill=(255, 255, 255), anchor="mm"
    )
    d.text((96 + TILE + 28, 96 + TILE / 2), "IQ Translate", font=sf(52, "Semibold"), fill=TEXT, anchor="lm")

    headline = f"{ENGLISH_NAMES[from_code]} → {ENGLISH_NAMES[to_code]}"
    d.text((96, 372), headline, font=fit(d, headline, 76, W - 192), fill=TEXT, anchor="ls")
    d.text((96, 442), "Voice translator — speak, hear it translated back.", font=sf(34), fill=HINT, anchor="ls")
    d.text((96, 490), "186 languages, free to try, no sign-up.", font=sf(34), fill=HINT, anchor="ls")

    bar, bar_mask = gradient(220, 12, radius=6)
    img.paste(bar, (96, 534), bar_mask)
    return img


def main():
    pairs = read_pairs()
    written = 0
    total_bytes = 0
    for locale, from_code, to_code, slug in pairs:
        missing = [c for c in (from_code, to_code) if c not in ENGLISH_NAMES]
        if missing:
            raise SystemExit(f"no English name for {missing} ({locale}/{slug})")
        d = os.path.join(OUT_DIR, locale)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{slug}.png")
        # Palette mode: the card is flat colour plus two small gradients, so an
        # adaptive 128-colour palette is visually identical at a third of the
        # size — and this ships 189 files into the repo.
        card(from_code, to_code).convert("P", palette=Image.ADAPTIVE, colors=128).save(
            path, "PNG", optimize=True
        )
        total_bytes += os.path.getsize(path)
        written += 1
    print(f"wrote {written} images, {total_bytes / 1024 / 1024:.1f} MB total")


if __name__ == "__main__":
    main()
