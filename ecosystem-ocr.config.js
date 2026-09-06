// PM2 config for the OCR sidecar — its OWN process, resource-capped so it can
// never starve the Next.js app or anything else on the shared prod box.
//
//   pm2 start ecosystem-ocr.config.js && pm2 save
//
// The venv must already exist (see services/ocr/README.md); the deploy
// workflow provisions it. Run as the same OS user as the translator app.
const path = require("path");

const APP_DIR = __dirname;
const OCR_DIR = path.join(APP_DIR, "services", "ocr");
const OCR_PYTHON = path.join(OCR_DIR, ".venv", "bin", "python");

module.exports = {
  apps: [
    {
      name: "translator-ocr",
      cwd: OCR_DIR, // main:app must import from services/ocr
      script: OCR_PYTHON, // absolute venv python; interpreter 'none' = run it directly
      args: [
        "-m",
        "uvicorn",
        "main:app",
        "--host", process.env.OCR_HOST || "127.0.0.1",
        "--port", process.env.OCR_PORT || "8701",
        "--workers", "1", // one process: CPU is shared, do not scale up
        "--limit-concurrency", "4", // queue past 4 in-flight HTTP requests
        "--timeout-keep-alive", "5",
        "--no-access-log",
      ].join(" "),
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      exp_backoff_restart_delay: 5000,
      kill_timeout: 15000,
      max_memory_restart: "1G",
      time: true,
      env: {
        NODE_ENV: "production",
        PYTHONUNBUFFERED: "1",
        OCR_HOST: process.env.OCR_HOST || "127.0.0.1",
        OCR_PORT: process.env.OCR_PORT || "8701",
        OCR_REC_LANG: process.env.OCR_REC_LANG || "cyrillic",
        OCR_REC_LANGS: process.env.OCR_REC_LANGS || "cyrillic,latin",
        OCR_PRELOAD: process.env.OCR_PRELOAD || "1",
        OCR_CONCURRENCY: process.env.OCR_CONCURRENCY || "1",
        OCR_MAX_SIDE: process.env.OCR_MAX_SIDE || "2000",
        OCR_MIN_SCORE: process.env.OCR_MIN_SCORE || "0.5",
        OCR_MAX_BYTES: process.env.OCR_MAX_BYTES || "15728640",
        // Cap BLAS/OpenMP threads so one inference cannot spread over every core.
        OMP_NUM_THREADS: process.env.OMP_NUM_THREADS || "2",
        OPENBLAS_NUM_THREADS: process.env.OPENBLAS_NUM_THREADS || "2",
        MKL_NUM_THREADS: process.env.MKL_NUM_THREADS || "2",
      },
    },
  ],
};
