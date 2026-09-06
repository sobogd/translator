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

    size = int(h * 0.8)
    if size < 7:
        return
    while size >= 7:
        font = _font(size)
        lines = _wrap(text, font, max_w)
        total_h = len(lines) * size * 1.3
        if total_h <= h or size <= 7:
            break
        size = int(size * 0.85)

    font = _font(max(7, size))
    lines = _wrap(text, font, max_w) or [text]
    line_h = font.size * 1.3
    total_h = len(lines) * line_h
    top = y0 + max(0.0, (h - total_h) / 2)
    ascent, _ = font.getmetrics()
    y = top
    for line in lines:
        tw = font.getlength(line)
        x = x0 + (w - tw) / 2
        draw.text((x, y + (line_h - font.size) / 2 + ascent - font.size * 0.2), line, font=font, fill=fg)
        y += line_h


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
