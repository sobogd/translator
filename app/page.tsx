"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { RecordButton, type RecStatus } from "@/components/RecordButton";
import { ResultCards } from "@/components/ResultCards";
import { History } from "@/components/History";
import type { TranslateResult, HistoryRow } from "@/lib/types";

export default function Home() {
  const [mode, setMode] = useState<Mode>("text");
  const [status, setStatus] = useState<RecStatus>("idle");
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const recRef = useRef<WavRecorder | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) setHistory(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // setHistory runs only after the awaited fetch — not a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  function onResult(data: TranslateResult) {
    setResult(data);
    loadHistory();
  }

  // ---- audio ----
  async function startRec() {
    setError(null);
    setResult(null);
    try {
      const rec = new WavRecorder();
      await rec.start();
      recRef.current = rec;
      setStatus("recording");
    } catch {
      setError("Нет доступа к микрофону");
    }
  }

  async function stopRec() {
    const rec = recRef.current;
    if (!rec) return;
    setStatus("processing");
    try {
      const blob = await rec.stop();
      recRef.current = null;
      const fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      const res = await fetch("/api/translate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      onResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStatus("idle");
    }
  }

  // ---- text ----
  async function translateText() {
    if (!text.trim() || textBusy) return;
    setError(null);
    setResult(null);
    setTextBusy(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      onResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTextBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 py-10 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        {/* header */}
        <header className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            RU <span className="text-emerald-500">⇄</span> ES
          </h1>
          <ModeToggle
            mode={mode}
            onChange={setMode}
            disabled={status !== "idle" || textBusy}
          />
        </header>

        {/* input */}
        <section className="w-full">
          {mode === "audio" ? (
            <div className="flex justify-center py-4">
              <RecordButton status={status} onStart={startRec} onStop={stopRec} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) translateText();
                }}
                placeholder="Введите текст на русском или испанском…"
                rows={4}
                className="w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-base leading-relaxed shadow-sm outline-none transition placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <button
                onClick={translateText}
                disabled={!text.trim() || textBusy}
                className="flex items-center justify-center gap-2 self-end rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {textBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Перевод…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Перевести
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* error */}
        {error && (
          <div className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* result */}
        {result && <ResultCards result={result} />}

        {/* history */}
        <section className="mt-2 w-full">
          <History rows={history} />
        </section>
      </div>
    </main>
  );
}
