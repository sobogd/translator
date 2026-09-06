"""Deploy-time model pre-download / readiness check.

    .venv/bin/python warmup.py

Builds every allowed rec-language engine once so the first real request never
stalls behind a model download. Exit code 0 only when every language warmed up.
"""

from __future__ import annotations

import sys

import engine as ocr_engine

if __name__ == "__main__":
    ok = ocr_engine.POOL.warmup()
    for lang, status in ok.items():
        print(f"warmup {lang}: {status}", flush=True)
    sys.exit(0 if all(v == "ok" for v in ok.values()) else 1)
