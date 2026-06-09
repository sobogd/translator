"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Info } from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { RecordButton, type RecStatus } from "@/components/RecordButton";
import { History } from "@/components/History";
import { apiFetch, initTelegram, showBackButton } from "@/lib/client";
import type { TranslateResult, ThreadDetail } from "@/lib/types";

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const threadId = params.id;

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [status, setStatus] = useState<RecStatus>("idle");
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<WavRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pending = textBusy || status === "processing";

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/threads/${threadId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) setThread(await res.json());
    } catch {
      /* ignore */
    }
  }, [threadId]);

  useEffect(() => {
    initTelegram();
    const hide = showBackButton(() => router.push("/"));
    // setThread runs only after the awaited fetch — not a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return hide;
  }, [load, router]);

  // keep view pinned to the newest message
  const turnCount = thread?.translations?.length ?? 0;
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [turnCount, pending]);

  function onResult() {
    load();
  }

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    const vh = (window.visualViewport?.height ?? window.innerHeight) || 600;
    const max = Math.round(vh * 0.28);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }

  async function startRec() {
    setError(null);
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
      fd.append("threadId", threadId);
      const res = await apiFetch("/api/translate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      onResult();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setStatus("idle");
    }
  }

  async function translateText() {
    if (!text.trim() || textBusy) return;
    setError(null);
    setTextBusy(true);
    const sent = text;
    setText("");
    requestAnimationFrame(autosize);
    try {
      const res = await apiFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sent, threadId }),
      });
      const data: TranslateResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      onResult();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setText(sent);
    } finally {
      setTextBusy(false);
    }
  }

  if (notFound) {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4"
        style={{ background: "var(--bg)", color: "var(--hint)" }}
      >
        Тред не найден.
        <button onClick={() => router.push("/")} className="text-emerald-500">
          ← К списку
        </button>
      </main>
    );
  }

  const rows = thread ? [...thread.translations].reverse() : [];

  return (
    <main
      className="flex h-[100dvh] flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* header */}
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 py-3"
        style={{ background: "var(--accent)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => router.push("/")}
          aria-label="Назад"
          className="rounded-lg p-1.5 transition active:scale-90"
          style={{ color: "var(--hint)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {thread?.title ?? "…"}
        </h1>
      </header>

      {/* topic block */}
      {thread?.context && (
        <div
          className="flex shrink-0 gap-2 border-b px-4 py-2.5 text-sm"
          style={{ background: "var(--accent)", borderColor: "var(--border)" }}
        >
          <Info size={15} className="mt-0.5 shrink-0 text-emerald-500" />
          <span className="leading-relaxed" style={{ color: "var(--hint)" }}>
            {thread.context}
          </span>
        </div>
      )}

      {/* scrollable history */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <History rows={rows} />
        {pending && (
          <div
            className="mt-3 flex items-center gap-2 rounded-2xl border p-3.5 text-sm"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--hint)",
            }}
          >
            <Loader2 size={15} className="animate-spin" /> Перевожу…
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* footer input */}
      <footer
        className="flex shrink-0 flex-col gap-2 border-t px-3 pb-3 pt-2"
        style={{ background: "var(--accent)", borderColor: "var(--border)" }}
      >
        <div className="flex justify-center">
          <ModeToggle
            mode={mode}
            onChange={setMode}
            disabled={status !== "idle" || textBusy}
          />
        </div>

        {mode === "audio" ? (
          <RecordButton status={status} onStart={startRec} onStop={stopRec} />
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onInput={autosize}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) translateText();
              }}
              placeholder="Текст на русском или испанском…"
              rows={1}
              className="max-h-[28dvh] min-h-[2.75rem] flex-1 resize-none rounded-2xl border px-3 py-2.5 text-base leading-relaxed outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            />
            <button
              onClick={translateText}
              disabled={!text.trim() || textBusy}
              aria-label="Перевести"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
            >
              {textBusy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}
