"""RapidOCR wrapper for the translator image-translation feature.

Design constraints — this service shares a production box with other PM2
apps, so it must never be able to starve them:

* One OCR inference at a time (CPU is the shared resource). FastAPI routes
  funnel work through a single-worker ThreadPoolExecutor.
* Rec (text-recognition) language is operator-controlled via env:
  - OCR_REC_LANG   default recognition language   ("cyrillic")
  - OCR_REC_LANGS  comma list of allowed languages ("cyrillic,latin")
  Engines are created lazily per language and cached; memory therefore grows
  only with the number of languages actually used, and requests for anything
  outside the list are rejected before an engine is built.
* Every image is EXIF-normalized and downscaled here (OCR_MAX_SIDE), so the
  caller never has to know what resolution the network actually saw. Boxes
  are returned in *processed-image* pixel space together with width/height;
  the Node side normalizes them to 0..1.
"""

from __future__ import annotations

import logging
import os
import threading
import time

import numpy as np

log = logging.getLogger("ocr.engine")

DEFAULT_LANG = os.getenv("OCR_REC_LANG", "cyrillic").strip().lower()
ALLOWED_LANGS = [
    x.strip().lower()
    for x in os.getenv("OCR_REC_LANGS", "cyrillic,latin").split(",")
    if x.strip()
]
if DEFAULT_LANG not in ALLOWED_LANGS:
    ALLOWED_LANGS.insert(0, DEFAULT_LANG)

MIN_SCORE = float(os.getenv("OCR_MIN_SCORE", "0.5"))
MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "2000"))

# rapidocr is imported lazily (inside _build) so this module loads cleanly even
# when the venv has not been provisioned yet — /healthz can still answer.
_LANG_TO_REC_ATTR = {
    "cyrillic": "CYRILLIC",  # ru/uk/be/... + en (PP-OCRv5)
    "latin": "LATIN",        # de/fr/es/it/pt/... + en (PP-OCRv5)
    "en": "EN",              # english only (PP-OCRv5)
    "ch": "CH",
}


def _build(lang: str):
    from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR

    attr = _LANG_TO_REC_ATTR.get(lang, lang.upper())
    rec = getattr(LangRec, attr, None)
    if rec is None:
        raise ValueError(f"unsupported rec language: {lang}")

    params = {
        # PP-OCRv5 det is the multilingual detector (incl. Latin/Cyrillic lines).
        "Det.engine_type": EngineType.ONNXRUNTIME,
        "Det.lang_type": LangDet.CH,
        "Det.model_type": ModelType.MOBILE,
        "Det.ocr_version": OCRVersion.PPOCRV5,
        # 180-degree orientation classifier (v5 supported from rapidocr 3.8).
        "Cls.engine_type": EngineType.ONNXRUNTIME,
        "Cls.model_type": ModelType.MOBILE,
        "Cls.ocr_version": OCRVersion.PPOCRV5,
        # Recognition model per language; PP-OCRv5 mobile for the requested rec
        # language is auto-downloaded on first use (cached on disk afterwards).
        "Rec.engine_type": EngineType.ONNXRUNTIME,
        "Rec.model_type": ModelType.MOBILE,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": rec,
    }
    log.info("building RapidOCR engine (rec_lang=%s) %s", lang, params)
    return RapidOCR(params=params)


class EnginePool:
    """Lazy, bounded cache of RapidOCR engines, one per rec language."""

    def __init__(self) -> None:
        self._engines: dict[str, object] = {}
        self._lock = threading.Lock()

    @property
    def default_lang(self) -> str:
        return DEFAULT_LANG

    @property
    def allowed_langs(self) -> list[str]:
        return list(ALLOWED_LANGS)

    def get(self, lang: str | None):
        key = (lang or DEFAULT_LANG).strip().lower()
        if key not in ALLOWED_LANGS:
            raise KeyError(key)
        with self._lock:
            engine = self._engines.get(key)
            if engine is None:
                engine = _build(key)
                self._engines[key] = engine
            return engine

    def warmup(self) -> dict[str, str]:
        """Build every allowed engine now (downloads models) — deploy-time step."""
        out: dict[str, str] = {}
        for lang in ALLOWED_LANGS:
            try:
                self.get(lang)
                out[lang] = "ok"
            except Exception as exc:  # noqa: BLE001 — report per-language
                log.exception("warmup failed for %s", lang)
                out[lang] = f"error: {exc}"
        return out


POOL = EnginePool()


def recognize(img_bgr: np.ndarray, rec_lang: str | None = None) -> tuple[list[dict], float, str]:
    """Run det+cls+rec on a BGR uint8 image. Returns (blocks, elapse, lang).

    block: {"text": str, "confidence": float,
            "polygon": [[x, y] x4], "box": [x0, y0, x1, y1]}  # processed px
    """
    engine = POOL.get(rec_lang)
    started = time.perf_counter()
    result = engine(img_bgr)
    elapse = time.perf_counter() - started

    if result is None:
        return [], elapse, rec_lang or DEFAULT_LANG

    # RapidOCROutput dataclass (v3): .boxes (N,4,2) float, .txts, .scores.
    # Defensive fallback for dict-like results keeps the code usable across
    # minor rapidocr releases.
    boxes = getattr(result, "boxes", None)
    txts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)
    if boxes is None and isinstance(result, dict):
        boxes = result.get("boxes")
        txts = result.get("txts")
        scores = result.get("scores")
    if boxes is None:
        return [], elapse, rec_lang or DEFAULT_LANG

    blocks: list[dict] = []
    for i, text in enumerate(txts or ()):
        if not isinstance(text, str) or not text.strip():
            continue
        confidence = float((scores or ())[i]) if i < len(scores or ()) else 0.0
        if confidence < MIN_SCORE:
            continue
        pts = np.asarray(boxes[i], dtype=float)  # (4, 2)
        if pts.shape != (4, 2):
            continue
        polygon = [[round(float(x), 1), round(float(y), 1)] for x, y in pts]
        x0 = float(pts[:, 0].min())
        y0 = float(pts[:, 1].min())
        x1 = float(pts[:, 0].max())
        y1 = float(pts[:, 1].max())
        blocks.append(
            {
                "text": " ".join(text.split()),
                "confidence": round(confidence, 3),
                "polygon": polygon,
                "box": [round(x0, 1), round(y0, 1), round(x1, 1), round(y1, 1)],
            }
        )
    return _merge_into_lines(blocks, img_bgr), elapse, rec_lang or DEFAULT_LANG


def _lum(bgr: np.ndarray) -> float:
    """Perceived luminance of one BGR pixel row."""
    return 0.299 * bgr[2] + 0.587 * bgr[1] + 0.114 * bgr[0]


def _median_color(bgr: np.ndarray, x0: int, y0: int, x1: int, y1: int):
    """Median colour of a pixel region, or None when the region is empty."""
    h, w = bgr.shape[:2]
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(w, x1), min(h, y1)
    if x1 - x0 < 1 or y1 - y0 < 1:
        return None
    region = bgr[y0:y1, x0:x1].reshape(-1, 3)
    return np.median(region, axis=0)


def _continuous_surface(bgr: np.ndarray, a: dict, b: dict) -> bool:
    """True when the strip between two candidate boxes looks like the same
    surface as their interiors — i.e. they are fragments of one printed line,
    not two separate controls (buttons/cards have a fill or edge that differs
    from the gap of page background between them)."""
    gap_x0 = int(a["box"][2])
    gap_x1 = int(b["box"][0])
    if gap_x1 <= gap_x0 + 1:
        return True  # touching/overlapping: nothing to judge the surface by
    y0 = max(int(a["box"][1]), int(b["box"][1]))
    y1 = min(int(a["box"][3]), int(b["box"][3]))
    if y1 - y0 < 4:
        return True
    gap = _median_color(bgr, gap_x0, y0, gap_x1, y1)
    if gap is None:
        return True
    # Sample the interiors a couple of pixels in from the OCR box edges.
    ia = _median_color(bgr, int(a["box"][0]) + 2, y0 + 1, int(a["box"][2]) - 2, y1 - 1)
    ib = _median_color(bgr, int(b["box"][0]) + 2, y0 + 1, int(b["box"][2]) - 2, y1 - 1)
    if ia is None or ib is None:
        return True
    lum_gap = _lum(gap)
    return abs(_lum(ia) - lum_gap) < 45 and abs(_lum(ib) - lum_gap) < 45


def _merge_into_lines(blocks: list[dict], bgr: np.ndarray | None = None) -> list[dict]:
    """Join detector fragments that belong to the same visual line.

    The detector frequently splits one printed line into several boxes at
    word-level gaps (or when a long phrase wraps inside an UI column), and
    translating each fragment separately is what makes a phrase come back
    "scattered" — every piece centred in its own little box. Merge boxes that
    sit on the same vertical band, are close enough horizontally AND look like
    the same surface (same fill behind the text), so separate buttons/labels
    on the same row are left alone.

    When no image is available (unit tests) only the geometric part runs.
    """
    if len(blocks) <= 1:
        return blocks

    ordered = sorted(blocks, key=lambda b: (b["box"][1], b["box"][0]))
    lines: list[dict] = []
    for b in ordered:
        bx0, by0, bx1, by1 = b["box"]
        height = by1 - by0
        merged = False
        for line in lines:
            lx0, ly0, lx1, ly1 = line["box"]
            # Different vertical band -> different visual line.
            if min(ly1, by1) - max(ly0, by0) <= 0:
                continue
            gap = bx0 - lx1
            # A small gap (or horizontal overlap) can still mean one phrase —
            # but only when the surface continues across it.
            if gap <= max(18.0, height * 1.1) and (bgr is None or _continuous_surface(bgr, line, b)):
                line["box"][0] = min(line["box"][0], bx0)
                line["box"][1] = min(line["box"][1], by0)
                line["box"][2] = max(line["box"][2], bx1)
                line["box"][3] = max(line["box"][3], by1)
                line["text"] = f"{line['text']} {b['text']}".strip()
                line["confidence"] = round(min(line["confidence"], b["confidence"]), 3)
                merged = True
                break
        if not merged:
            lines.append(dict(b))

    # Rebuild an axis-aligned polygon per merged line (the per-fragment
    # rotation is lost by design — downstream only uses the box anyway).
    for line in lines:
        x0, y0, x1, y1 = line["box"]
        line["polygon"] = [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
        ]
    return lines
