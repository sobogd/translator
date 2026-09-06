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


def _distinct_fill(c: tuple[int, int, int]) -> bool:
    """Is this surface clearly a container (coloured bubble/button)? Neutral
    greys/whites are ambiguous — there the glyph bounds decide, not the
    background."""
    sat = int(max(c)) - int(min(c))
    lum = _lum_rgb(c)
    return sat > 28 or lum < 185


def _median_region(img: Image.Image, xa: int, ya: int, xb: int, yb: int):
    w, h = img.size
    xa, ya = max(0, xa), max(0, ya)
    xb, yb = min(w, xb), min(h, yb)
    if xb <= xa or yb <= ya:
        return None
    region = np.asarray(img, dtype=np.int16)[ya:yb, xa:xb].reshape(-1, 3)
    return np.median(region, axis=0)


def _fill_compatible(a: dict, b: dict) -> bool:
    """Background as a SUPPLEMENTARY signal: when at least one of the two
    surfaces is a clearly visible fill, a big colour difference means they are
    different elements — never merge them. Neutral (grey/white) surfaces fall
    back to the glyph-typography rules only."""
    fa = a.get("fill")
    fb = b.get("fill")
    if fa is None or fb is None:
        return True
    if not (_distinct_fill(fa) or _distinct_fill(fb)):
        return True
    return abs(fa[0] - fb[0]) + abs(fa[1] - fb[1]) + abs(fa[2] - fb[2]) <= 60


def _container_box(img: Image.Image, box: tuple[int, int, int, int], fill, max_pad: int):
    """Grow the glyph box outward while the pixels right outside are still the
    same fill — i.e. recover the bubble/button rectangle the text sits in, so
    the translation can be fitted into the container with proper margins."""
    x0, y0, x1, y1 = box
    w, h = img.size

    def matches(xa: int, ya: int, xb: int, yb: int) -> bool:
        med = _median_region(img, xa, ya, xb, yb)
        if med is None:
            return False
        return sum(abs(int(fill[i]) - int(med[i])) for i in range(3)) <= 40

    for _ in range(max_pad):
        grew = False
        if x0 > 0 and matches(x0 - 2, y0, x0, y1):
            x0 -= 1
            grew = True
        if x1 < w and matches(x1, y0, x1 + 2, y1):
            x1 += 1
            grew = True
        if y0 > 0 and matches(x0, y0 - 2, x1, y0):
            y0 -= 1
            grew = True
        if y1 < h and matches(x0, y1, x1, y1 + 2):
            y1 += 1
            grew = True
        if not grew:
            break
    return (x0, y0, x1, y1)


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


def _inc(row: dict, k: str, fallback: str) -> int:
    """A row's ink coordinate if measured, else its OCR-box coordinate."""
    return row.get(k, row[fallback])


def _cluster_regions(rows: list[dict]) -> list[list[dict]]:
    """Group stacked lines into text blocks using ONLY the text itself.

    Lines belong to one block when their glyph heights are comparable (same
    font), their ink spans overlap horizontally (it's a wrap within one
    element), and the vertical gap between them is no more than one
    line-height (leading) — no background/colour information involved. A
    separate element (a new message, the system notice, the input box) breaks
    at least one of these, so it starts a new block."""
    regions: list[list[dict]] = []
    for row in rows:
        if not regions:
            regions.append([row])
            continue
        prev = regions[-1][-1]
        p_top = _inc(prev, "i0", "y0")
        p_bot = _inc(prev, "i1", "y1")
        c_top = _inc(row, "i0", "y0")
        c_bot = _inc(row, "i1", "y1")
        p_l = _inc(prev, "l0", "x0")
        p_r = _inc(prev, "l1", "x1")
        c_l = _inc(row, "l0", "x0")
        c_r = _inc(row, "l1", "x1")

        gap = c_top - p_bot
        ph, ch = p_bot - p_top, c_bot - c_top
        avg_h = (ph + ch) / 2
        h_ratio = max(max(ph, 1), max(ch, 1)) / max(1, min(max(ph, 1), max(ch, 1)))
        overlap = min(p_r, c_r) - max(p_l, c_l)
        min_w = max(min(p_r - p_l, c_r - c_l), 1)
        same_region = (
            gap >= -2
            and gap <= max(avg_h * 0.9, 12.0)
            and h_ratio <= 2.2
            and overlap >= min_w * 0.15
            and _fill_compatible(row, prev)
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


def _draw_block(img: Image.Image, rows: list[dict], img_w: int, global_target: int) -> None:
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

    multi = len(rows) > 1
    if multi:
        text = " ".join(r["text"] for r in rows if r["text"]).strip()
    else:
        text = (rows[0]["text"] or "").strip()
    if not text:
        return

    # Glyph zone (real letter extents).
    bx0 = min(_inc(r, "l0", "x0") for r in rows)
    bx1 = max(_inc(r, "l1", "x1") for r in rows)
    by0 = min(_inc(r, "i0", "y0") for r in rows)
    by1 = max(_inc(r, "i1", "y1") for r in rows)

    # When the block sits on a clearly visible fill (coloured bubble/button),
    # recover the container rectangle and fit into IT (background in priority);
    # neutral surfaces keep the pure glyph bounds.
    block_fill = fills[0] if fills else None
    if block_fill is not None and _distinct_fill(block_fill):
        expanded = _container_box(img, (bx0, by0, bx1, by1), block_fill, max_pad=400)
        bx0, by0, bx1, by1 = expanded

    bw, bh = bx1 - bx0, by1 - by0
    if bw < 8 or bh < 6:
        return

    # Paint on an overlay exactly the size of the zone and paste with alpha.
    layer = Image.new("RGBA", (int(bw), int(bh)), (0, 0, 0, 0))
    dc = ImageDraw.Draw(layer)

    inner_pad = max(3 if block_fill is not None and _distinct_fill(block_fill) else 2,
                    round(min(bw, bh) * 0.04))
    inner_w = max(bw - 2 * inner_pad, 10.0)
    inner_h = max(bh - 2 * inner_pad, 8.0)
    left_align = len(rows) > 1 or bx0 < img_w * 0.22

    # Same-type blocks share one font: snap to the global body size unless the
    # block is clearly bigger/smaller (headline, caption).
    target = _target_size(rows)
    if abs(target - global_target) <= 0.30 * global_target:
        target = global_target

    size = _pick_font_size(dc, text, inner_w, inner_h, target)
    font = _font(size)
    lines = _wrap(text, font, inner_w) or [text]
    meas, total, lead = _ink_block(dc, lines, font)
    top = max(0.0, (bh - total) / 2)
    y = top
    for ln, left, top_, iw, ih in meas:
        if left_align:
            x = inner_pad - left
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

    # One shared "body" font across same-type blocks, so all messages read
    # consistently; clearly larger/smaller blocks keep their own size.
    global_target = int(round(float(np.median([_target_size(reg) for reg in regions])))) if regions else 0
    for region in regions:
        _draw_block(img, region, width, global_target)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()
