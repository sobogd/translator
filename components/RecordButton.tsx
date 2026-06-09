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
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={recording ? onStop : onStart}
        disabled={processing}
        aria-label={recording ? "Остановить запись" : "Начать запись"}
        className={`relative flex h-32 w-32 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed ${
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
          <Loader2 size={40} className="animate-spin" />
        ) : recording ? (
          <Square size={36} fill="currentColor" />
        ) : (
          <Mic size={44} />
        )}
      </button>
      <p className="h-5 text-sm text-zinc-500 dark:text-zinc-400">
        {recording && `Запись · ${fmt(elapsed)}`}
        {processing && "Gemini распознаёт и переводит…"}
        {status === "idle" && "Нажми и говори"}
      </p>
    </div>
  );
}
