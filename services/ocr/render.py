"""Paint the translation onto a copy of the photo.

Each OCR block from /ocr gets:
  1) its area erased with the median colour of the ring AROUND the box —
     clean on flat backgrounds (screenshots, menus, posters, signs);
  2) the translated text drawn back inside the same box, wrapped to the box
     width and auto-fitted to its height, in black/white chosen for contrast
     against the fill colour.

Deliberately NOT an inpainter: complex photo backgrounds (foliage, fabric
patterns) will show traces where the old glyphs were. For those the caller
should fall back to the JSON geometry and a real inpainting pipeline. Text
is drawn axis-aligned inside the axis-aligned box of the polygon — strongly
rotated captions render upright rather than along the original skew.

The sidecar renders in the SAME processed space as its OCR (EXIF-normalized,
downscaled to the width/height it reports), so the caller just sends back the
original upload plus those width/height and normalized polygons.
"""

from __future__ import annotations

import io
import logging
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

log = logging.getLogger("ocr.render")

_FONT_CANDIDATES = [
    os.getenv("TRANSLATED_FONT", ""),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Arial.ttf",
]

JPEG_QUALITY = int(os.getenv("COMPOSE_QUALITY", "88"))
_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _font(size: int) -> ImageFont.FreeTypeFont:
    path = next((c for c in _FONT_CANDIDATES if c and os.path.isfile(c)), None)
    if path is None:
        raise FileNotFoundError("no font for translated overlay — set TRANSLATED_FONT")
    key = (path, size)
    font = _font_cache.get(key)
    if font is None:
        font = ImageFont.truetype(path, size)
        _font_cache[key] = font
    return font


def _ring_median(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    """Median RGB of the band just outside the box — the fill colour that
    makes the erased area blend into the surrounding background."""
    w, h = img.size
    x0, y0, x1, y1 = box
    pad = 8
    rx0, ry0 = max(0, x0 - pad), max(0, y0 - pad)
    rx1, ry1 = min(w, x1 + pad), min(h, y1 + pad)
    region = np.asarray(img, dtype=np.int16)[ry0:ry1, rx0:rx1]
    mask = np.ones(region.shape[:2], dtype=bool)
    inner_x0, inner_y0 = max(0, x0 - rx0), max(0, y0 - ry0)
    inner_x1 = min(region.shape[1], x1 - rx0)
    inner_y1 = min(region.shape[0], y1 - ry0)
    if inner_x1 > inner_x0 and inner_y1 > inner_y0:
        mask[inner_y0:inner_y1, inner_x0:inner_x1] = False
    pix = region[mask]
    if pix.size == 0:
        pix = region.reshape(-1, 3)
    med = np.median(pix, axis=0)
    return (int(med[0]), int(med[1]), int(med[2]))


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_w: float) -> list[str]:
    """Greedy word wrap; overlong words split by characters."""
    words = text.split()
    if not words:
        return []
    fits = lambda s: font.getlength(s) <= max_w  # noqa: E731
    lines: list[str] = []
    cur = ""
    for word in words:
        candidate = f"{cur} {word}".strip() if cur else word
        if fits(candidate):
            cur = candidate
            continue
        if cur:
            lines.append(cur)
            cur = ""
        # A single word wider than the box: break it by characters.
        if not fits(word):
            piece = ""
            for ch in word:
                if fits(piece + ch):
                    piece += ch
                else:
                    lines.append(piece)
                    piece = ch
            word = piece
        cur = word
    if cur:
        lines.append(cur)
    return lines


def _measure_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
) -> tuple[list, int, int]:
    """Per-line ink bbox (textbbox) and the stacked block height. The ink box
    is what is actually painted — centering it (not the em box) is what makes
    ascenders/descenders/accents sit correctly inside the erased area."""
    lead = max(1, font.size // 7)
    meas: list = []
    total = 0
    for line in lines:
        left, top, right, bottom = draw.textbbox((0, 0), line, font=font, anchor="la")
        iw = right - left
        ih = bottom - top
        meas.append((line, left, top, iw, ih))
        total += ih
    if len(lines) > 1:
        total += lead * (len(lines) - 1)
    return meas, total, lead


def _draw_translated(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    bg: tuple[int, int, int],
) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if w < 10 or h < 6:
        return
    lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    fg: tuple[int, int, int] = (28, 28, 28) if lum > 140 else (242, 242, 242)
    pad = max(2, int(h * 0.08))
    max_w = max(w - 2 * pad, 8.0)

    # Largest font size whose wrapped lines stack inside the box height.
    chosen: tuple | None = None
    start = max(7, int(h * 0.8))
    for size in range(start, 6, -1):
        font = _font(size)
        lines = _wrap(text, font, max_w) or [text]
        meas, total, _ = _measure_lines(draw, lines, font)
        if total <= h:
            chosen = (font, lines, meas, total)
            break
    if chosen is None:
        # Tiny box: last resort at the floor size, even if it overflows a bit.
        font = _font(7)
        lines = _wrap(text, font, max_w) or [text]
        meas, total, _ = _measure_lines(draw, lines, font)
        chosen = (font, lines, meas, total)

    font, lines, meas, total = chosen  # type: ignore[assignment]
    lead = max(1, font.size // 7)
    top = y0 + max(0.0, (h - total) / 2)
    y = top
    for line, left, top_, iw, ih in meas:
        # Draw so this line's ink box starts exactly at (x, y): subtract the
        # bbox origin from the desired position.
        x = x0 + (w - iw) / 2 - left
        draw.text((x, y - top_), line, font=font, fill=fg, anchor="la")
        y += ih + lead


def render(original: bytes, width: int, height: int, blocks: list[dict]) -> bytes:
    """Returns a JPEG of the translated photo in the processed coordinate space.

    blocks: [{"translation": str, "polygon": [[x, y] x4]}], polygons in
    normalized 0..1 against (width, height).
    """
    img = Image.open(io.BytesIO(original))
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img = img.resize((int(width), int(height)), Image.LANCZOS)
    draw = ImageDraw.Draw(img)

    for b in blocks:
        translation = (b.get("translation") or "").strip()
        poly = b.get("polygon") or []
        if not translation or len(poly) < 4:
            continue
        xs = [float(p[0]) for p in poly]
        ys = [float(p[1]) for p in poly]
        x0 = round(min(xs) * width)
        x1 = round(max(xs) * width)
        y0 = round(min(ys) * height)
        y1 = round(max(ys) * height)
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(int(width), x1), min(int(height), y1)
        w, h = x1 - x0, y1 - y0
        if w < 10 or h < 6:
            continue

        bg = _ring_median(img, (x0, y0, x1, y1))
        # Slight outward pad so the old glyphs are fully covered.
        draw.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=bg)
        _draw_translated(draw, (x0, y0, x1, y1), translation, bg)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()
