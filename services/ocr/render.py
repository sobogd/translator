"""Paint the translation onto a copy of the photo (v3 layout).

Instead of re-painting every OCR line independently (which made neighbouring
lines come out with different sizes), lines are first clustered into text
blocks — a chat bubble / paragraph / wrapped label — and each block is
re-laid-out as ONE unit:

  * multi-line blocks are re-flowed as a single paragraph: the block's
    translations are joined, wrapped to the block width and poured with ONE
    font size and ONE line spacing, so everything inside a message has the
    same size and even gaps;
  * single-line elements (buttons, headings) keep their own uniform size and
    stay centred when they read as a standalone control;
  * erase uses the ring colour per original line; a real inpainter for
    textured photo backgrounds remains a separate, future step.
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


def _lum_rgb(c: tuple[int, int, int]) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


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
    return lines or [text]


def _ink_block(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
) -> tuple[list, int, int]:
    """Per-line ink boxes + stacked block height of wrapped text."""
    lead = max(1, round(font.size * 0.22))
    meas: list = []
    total = 0
    for ln in lines:
        left, top, right, bottom = draw.textbbox((0, 0), ln, font=font, anchor="la")
        iw = right - left
        ih = bottom - top
        meas.append((ln, left, top, iw, ih))
        total += ih
    if len(lines) > 1:
        total += lead * (len(lines) - 1)
    return meas, total, lead


def _cluster_regions(rows: list[dict]) -> list[list[dict]]:
    """Group stacked lines into text blocks (chat bubble, paragraph, wrapped
    label). Rule of thumb: consecutive lines belong together when the vertical
    gap is within one line-height, heights are comparable and the x-ranges
    overlap at least a little."""
    regions: list[list[dict]] = []
    for row in rows:
        if not regions:
            regions.append([row])
            continue
        prev = regions[-1][-1]
        gap = row["y0"] - prev["y1"]
        avg_h = (prev["h"] + row["h"]) / 2
        h_ratio = max(prev["h"], row["h"]) / max(1, min(prev["h"], row["h"]))
        overlap = min(prev["x1"], row["x1"]) - max(prev["x0"], row["x0"])
        min_w = min(prev["w"], row["w"])
        same_region = (
            gap >= -1
            and gap <= max(avg_h * 1.15, 16.0)
            and h_ratio <= 2.6
            and overlap >= min_w * 0.12
        )
        if same_region:
            regions[-1].append(row)
        else:
            regions.append([row])
    return regions


def _pick_font_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    width: float,
    height: float,
    target: int,
) -> int:
    """Largest font whose wrapped `text` fits width x height (slightly
    padded); never below 7."""
    for s in range(max(7, min(target, 160)), 6, -1):
        font = _font(s)
        lines = _wrap(text, font, width)
        _, total, _ = _ink_block(draw, lines, font)
        if total <= height + s * 0.6:
            return s
    return 7


def _draw_block(img: Image.Image, rows: list[dict], img_w: int) -> None:
    draw = ImageDraw.Draw(img)

    # 1) Erase each original line (own ring colour).
    fills: list[tuple[int, int, int]] = []
    for row in rows:
        x0, y0, x1, y1 = row["x0"], row["y0"], row["x1"], row["y1"]
        bg = _ring_median(img, (x0, y0, x1, y1))
        fills.append(bg)
        draw.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=bg)

    med_h = float(np.median([r["h"] for r in rows]))
    med_lum = float(np.median([_lum_rgb(f) for f in fills])) if fills else 200.0
    fg: tuple[int, int, int] = (28, 28, 28) if med_lum > 140 else (242, 242, 242)
    pad = max(3, round(med_h * 0.10))

    # Block bounding area we are allowed to paint into.
    bx0 = min(r["x0"] for r in rows)
    bx1 = max(r["x1"] for r in rows)
    by0 = min(r["y0"] for r in rows)
    by1 = max(r["y1"] for r in rows)
    bw, bh = bx1 - bx0, by1 - by0
    max_w = max(bw - 2 * pad, 12.0)

    multi = len(rows) > 1
    left_edge = bx0 < img_w * 0.22
    # Paragraph / left-ish block -> re-flow as one text, left aligned.
    paragraph = multi or (not multi and left_edge)
    target = int(round(med_h * 0.78))

    if paragraph:
        text = " ".join(r["text"] for r in rows if r["text"]).strip()
        if not text:
            return
        size = _pick_font_size(draw, text, max_w, bh + med_h * 0.5, target)
        font = _font(size)
        lines = _wrap(text, font, max_w) or [text]
        meas, total, lead = _ink_block(draw, lines, font)
        top = by0 + max(0.0, (bh - total) / 2)
        x = bx0 + pad
        y = top
        for ln, left, top_, iw, ih in meas:
            draw.text((x - left, y - top_), ln, font=font, fill=fg, anchor="la")
            y += ih + lead
        return

    # Single, standalone element (button/heading/centered chip): keep its own
    # band and centre it.
    row = rows[0]
    text = row["text"]
    if not text:
        return
    size = _pick_font_size(draw, text, max(row["w"] - 2 * pad, 12.0), row["h"] + row["h"] * 0.4, target)
    font = _font(size)
    lines = _wrap(text, font, max(row["w"] - 2 * pad, 12.0)) or [text]
    meas, total, lead = _ink_block(draw, lines, font)
    top = row["y0"] + max(0.0, (row["h"] - total) / 2)
    y = top
    for ln, left, top_, iw, ih in meas:
        x = row["x0"] + (row["w"] - iw) / 2 - left
        draw.text((x, y - top_), ln, font=font, fill=fg, anchor="la")
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

    rows: list[dict] = []
    for b in blocks:
        text = (b.get("translation") or "").strip()
        poly = b.get("polygon") or []
        if len(poly) < 4:
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
        rows.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "w": w, "h": h, "text": text})

    rows.sort(key=lambda r: (r["y0"], r["x0"]))
    regions = _cluster_regions(rows)
    for region in regions:
        _draw_block(img, region, width)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()
