"use client";

import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import type { Thread } from "@/lib/types";

export function NewThreadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: Thread) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);

  // auto-grow the context textarea, capped so the sheet stays within the
  // visible viewport (keyboard-safe).
  function autosize() {
    const el = taRef.current;
    if (!el) return;
    const vh = (window.visualViewport?.height ?? window.innerHeight) || 600;
    const max = Math.round(vh * 0.32);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }
  useEffect(() => {
    if (step === 2) requestAnimationFrame(autosize);
  }, [step, context]);

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      onCreated(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl border p-5 shadow-xl sm:rounded-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                aria-label="Назад"
                className="rounded-lg p-1.5 transition active:scale-90"
                style={{ color: "var(--hint)" }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {step === 1 ? "Тема перевода" : "Контекст"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 transition active:scale-90"
            style={{ color: "var(--hint)" }}
          >
            <X size={18} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Напр.: Приём у ветеринара"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) setStep(2);
              }}
              className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            />
            <button
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40"
            >
              Далее
            </button>
          </>
        ) : (
          <>
            <textarea
              ref={taRef}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onInput={autosize}
              autoFocus
              rows={3}
              placeholder="О чём разговор и кто есть кто. Напр.: ветеринария; Фокси — кличка кота, не «лиса»."
              className="w-full resize-none overflow-y-auto rounded-xl border px-3 py-3 text-base leading-relaxed outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30"
              style={{ background: "var(--bg)", borderColor: "var(--border)" }}
            />
            <p className="text-xs" style={{ color: "var(--hint)" }}>
              ИИ учитывает это в каждом переводе треда: распознаёт имена и термины,
              держит единый стиль и не путает похожие слова. Необязательно.
            </p>
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
            <button
              onClick={create}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {context.trim() ? "Продолжить" : "Пропустить"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
