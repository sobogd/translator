#!/usr/bin/env bash
# Launcher for the OCR sidecar (PM2 ecosystem-ocr.config.js executes this).
#
# Prefers the project venv python; falls back to the system python3 when the
# box lacks python3-venv and the deploy provisioned deps via `pip --user`.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -x "$DIR/.venv/bin/python" ]; then
  exec "$DIR/.venv/bin/python" "$@"
fi
exec python3 "$@"
