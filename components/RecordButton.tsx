"use client";

import { useEffect, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

export type RecStatus = "idle" | "recording" | "processing";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RecordButton({
  status,
  onStart,
  onStop,
}: {
  status: RecStatus;
  onStart: () => void;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      250,
    );
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [status]);

  const recording = status === "recording";
  const processing = status === "processing";

  return (
    <div className="flex items-center justify-center gap-3 py-1">
      <button
        onClick={recording ? onStop : onStart}
        disabled={processing}
        aria-label={recording ? "Остановить запись" : "Начать запись"}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed ${
          recording
            ? "bg-red-500 hover:bg-red-400"
            : processing
              ? "bg-zinc-400 dark:bg-zinc-600"
              : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {recording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
        )}
        {processing ? (
          <Loader2 size={26} className="animate-spin" />
        ) : recording ? (
          <Square size={22} fill="currentColor" />
        ) : (
          <Mic size={26} />
        )}
      </button>
      <span className="min-w-[7rem] text-sm" style={{ color: "var(--hint)" }}>
        {recording && `Запись · ${fmt(elapsed)}`}
        {processing && "Распознаю…"}
        {status === "idle" && "Нажми и говори"}
      </span>
    </div>
  );
}
