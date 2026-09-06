"""HTTP front for the OCR engine.

Run (from this directory, inside the venv):

    .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8701 --workers 1

Deliberately ONE uvicorn worker + ONE inference worker: the service shares a
production box with other PM2 apps and OCR is CPU-bound. Concurrency beyond
that only queues requests, it does not make OCR faster.

Endpoints
---------
GET  /healthz          liveness + engine readiness
POST /ocr              raw image bytes -> JSON blocks with pixel geometry
                       optional query: ?rec_lang=latin|cyrillic|en
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError

import engine as ocr_engine

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("ocr.main")

MAX_BYTES = int(os.getenv("OCR_MAX_BYTES", str(15 * 1024 * 1024)))
MAX_SIDE = int(os.getenv("OCR_MAX_SIDE", "2000"))
PRELOAD = os.getenv("OCR_PRELOAD", "0") == "1"
# How many images may run through det/cls/rec at once. Keep 1 on shared boxes.
CONCURRENCY = int(os.getenv("OCR_CONCURRENCY", "1"))

# Single-worker executor so OCR never runs in parallel inside this process.
_infer_pool = ThreadPoolExecutor(max_workers=CONCURRENCY, thread_name_prefix="ocr")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if PRELOAD:
        log.info("preloading OCR engines: %s", ocr_engine.POOL.allowed_langs)
        ok = await asyncio.get_running_loop().run_in_executor(_infer_pool, ocr_engine.POOL.warmup)
        log.info("warmup: %s", ok)
    yield
    _infer_pool.shutdown(wait=False, cancel_futures=True)


app = FastAPI(title="translator-ocr", version="1.0.0", lifespan=lifespan)
_loaded_at = time.time()


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse(
        {
            "ok": True,
            "service": "translator-ocr",
            "uptime_s": round(time.time() - _loaded_at),
            "rec_lang_default": ocr_engine.POOL.default_lang,
            "rec_lang_allowed": ocr_engine.POOL.allowed_langs,
            "loaded_engines": sorted(getattr(ocr_engine.POOL, "_engines", {})),
        }
    )


def _decode_and_prepare(raw: bytes) -> tuple[np.ndarray, int, int]:
    """PIL decode -> EXIF transpose -> RGB -> optional downscale -> BGR ndarray."""
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)  # phones bake orientation into pixels
        if img.mode != "RGB":
            img = img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="unsupported image") from exc

    width, height = img.size
    longest = max(width, height)
    if longest > MAX_SIDE:
        scale = MAX_SIDE / longest
        img = img.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.LANCZOS)
    width, height = img.size

    # PIL gives RGB; OCR pipelines expect OpenCV's BGR.
    arr = np.asarray(img)[:, :, ::-1].copy()
    return arr, width, height


def _run_ocr(raw: bytes, rec_lang: str | None) -> dict:
    arr, width, height = _decode_and_prepare(raw)
    blocks, elapse, used_lang = ocr_engine.recognize(arr, rec_lang)
    return {
        "width": width,
        "height": height,
        "rec_lang": used_lang,
        "elapse_s": round(elapse, 3),
        "blocks": blocks,
    }


@app.post("/ocr")
async def ocr(request: Request) -> JSONResponse:
    if len(request.headers.get("content-length") or "") > 0:
        try:
            declared = int(request.headers["content-length"])
        except ValueError:
            declared = 0
        if declared > MAX_BYTES:
            raise HTTPException(status_code=413, detail="image_too_large")

    rec_lang = request.query_params.get("rec_lang")
    if rec_lang is not None and rec_lang.strip().lower() not in ocr_engine.POOL.allowed_langs:
        raise HTTPException(status_code=400, detail="unsupported rec_lang")

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="empty body")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")

    loop = asyncio.get_running_loop()
    try:
        out = await loop.run_in_executor(_infer_pool, _run_ocr, raw, rec_lang)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — surface as 500, log detail
        log.exception("ocr failed")
        raise HTTPException(status_code=500, detail="ocr_error") from exc

    return JSONResponse(out)
