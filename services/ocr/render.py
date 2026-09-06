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


def _attach_ink_bounds(img: Image.Image, rows: list[dict]) -> None:
    """Find the real glyph bounds of every original text row.

    OCR boxes carry padding around the letters, and for text that sits
    directly on a photo there is no visual container to hide that padding —
    the translation then lands slightly off where the original letters were.
    Measure the actual ink (pixels that differ from the local background) so
    the translation can be sized and placed against the true glyph top /
    bottom / left / right instead of the padded box."""
    arr = np.asarray(img).astype(np.int16)
    lum = 0.299 * arr[:, :, 2] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 0]
    h, w = lum.shape
    for row in rows:
        x0, y0, x1, y1 = row["x0"], row["y0"], row["x1"], row["y1"]
        if x1 <= x0 or y1 <= y0:
            continue
        region = lum[y0:y1, x0:x1]
        bg = float(np.median(region))
        mask = np.abs(region - bg) > 26
        if int(mask.sum()) == 0:
            continue  # unreadable box — keep OCR bounds as fallback
        ys, xs = np.where(mask)
        row["i0"] = y0 + int(ys.min())
        row["i1"] = y0 + int(ys.max()) + 1
        row["l0"] = x0 + int(xs.min())
        row["l1"] = x0 + int(xs.max()) + 1
        row["ih"] = row["i1"] - row["i0"]
        # The surface colour the line sits on — used to keep different
        # elements (messages, input box, page background) from merging.
        row["fill"] = _ring_median(img, (x0, y0, x1, y1))


def _same_surface(a: dict, b: dict) -> bool:
    """True when two candidate lines sit on the same background colour.

    Different elements (a chat bubble vs the page background vs the input
    box) almost always differ in surface colour, so this is what stops a
    multi-line 'region' from swallowing unrelated lines below it."""
    fa = a.get("fill")
    fb = b.get("fill")
    if fa is None or fb is None:
        return True
    return abs(fa[0] - fb[0]) + abs(fa[1] - fb[1]) + abs(fa[2] - fb[2]) <= 45


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
            and gap <= max(avg_h * 0.85, 16.0)
            and h_ratio <= 2.6
            and overlap >= min_w * 0.12
            and _same_surface(row, prev)
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
    """Largest font whose wrapped `text` fits STRICTLY inside width x height.

    `width`/`height` are the block's content boundaries (original text bbox
    minus padding): the translation must never leave them, so no slack is
    allowed — the font shrinks until every wrapped line fits."""
    for s in range(max(7, min(target, 160)), 6, -1):
        font = _font(s)
        lines = _wrap(text, font, width)
        _, total, _ = _ink_block(draw, lines, font)
        if total <= height:
            return s
    return 7


def _target_size(rows: list[dict]) -> int:
    """Ideal font size for a set of rows. Prefers the measured ink height of
    the original glyphs (≈ real cap/descender span) over the padded OCR box
    height; factor 1.15 converts an ink span back to a font em size."""
    inks = [r["ih"] for r in rows if "ih" in r and r["ih"] > 0]
    if inks:
        return max(8, int(round(float(np.median(inks)) * 1.15)))
    med_h = float(np.median([r["h"] for r in rows]))
    return max(8, int(round(med_h * 0.8)))


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
    pad = max(2, round(med_h * 0.06))

    multi = len(rows) > 1
    if multi:
        text = " ".join(r["text"] for r in rows if r["text"]).strip()
    else:
        text = (rows[0]["text"] or "").strip()
    if not text:
        return

    # Original text zone (union of OCR boxes).
    bx0 = min(r["x0"] for r in rows)
    bx1 = max(r["x1"] for r in rows)
    by0 = min(r["y0"] for r in rows)
    by1 = max(r["y1"] for r in rows)
    bw, bh = bx1 - bx0, by1 - by0
    if bw < 8 or bh < 6:
        return

    # 2) Paint on an overlay exactly the size of the zone and paste with an
    #    alpha mask: PIL clips to the overlay, so no pixel can escape the zone.
    layer = Image.new("RGBA", (int(bw), int(bh)), (0, 0, 0, 0))
    dc = ImageDraw.Draw(layer)
    target = _target_size(rows)

    if multi:
        # Paragraph: pour the whole block into the union area (extra wrapped
        # lines may use the inter-line room), left-aligned.
        inner_w = max(bw - 2 * pad, 10.0)
        inner_h = max(bh - 2 * pad, 8.0)
        size = _pick_font_size(dc, text, inner_w, inner_h, target)
        font = _font(size)
        lines = _wrap(text, font, inner_w) or [text]
        meas, total, lead = _ink_block(dc, lines, font)
        top = max(0.0, (bh - total) / 2)
        y = top
        for ln, left, top_, iw, ih in meas:
            dc.text((pad - left, y - top_), ln, font=font, fill=fg, anchor="la")
            y += ih + lead
    else:
        # Single line with no container (text on a photo): anchor to the real
        # glyph bounds of the original — top of the tallest letter, bottom of
        # the lowest one, and the left/right ink extremes.
        row = rows[0]
        y_a = row.get("i0", row["y0"])
        y_b = row.get("i1", row["y1"])
        x_a = row.get("l0", row["x0"])
        x_b = row.get("l1", row["x1"])
        band_h = max(8, y_b - y_a)
        span_w = max(10.0, float(x_b - x_a))
        left_align = x_a < img_w * 0.22 or bx0 < img_w * 0.22
        inner_w = min(span_w, max(bw - 2 * pad, 10.0))
        inner_h = max(band_h - 2, 6.0)
        size = _pick_font_size(dc, text, inner_w, inner_h, target)
        font = _font(size)
        lines = _wrap(text, font, inner_w) or [text]
        meas, total, lead = _ink_block(dc, lines, font)
        top = (y_a - by0) + max(0.0, (band_h - total) / 2)
        y = top
        for ln, left, top_, iw, ih in meas:
            if left_align:
                x = (x_a - bx0) - left
            else:
                x = (bw - iw) / 2 - left
            dc.text((x, y - top_), ln, font=font, fill=fg, anchor="la")
            y += ih + lead

    img.paste(layer, (int(bx0), int(by0)), layer)


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
        # Row with no letters (timestamp, price, icons, "|||") is UI chrome,
        # not transatable text: leave it as the original and never paint over.
        if not any(ch.isalpha() for ch in text):
            continue
        # Stray one-glyph fragments (a leftover "b" under a button) are OCR
        # noise, not a word to translate.
        if len(text) <= 1 and w < 60:
            continue
        rows.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "w": w, "h": h, "text": text})

    rows.sort(key=lambda r: (r["y0"], r["x0"]))
    _attach_ink_bounds(img, rows)
    regions = _cluster_regions(rows)
    for region in regions:
        _draw_block(img, region, width)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()
