"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Thread } from "@/lib/types";

export function NewThreadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: Thread) => void;
}) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      onCreated(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новый перевод</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Название
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="Напр.: Приём у ветеринара"
          className="mb-4 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none transition placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-950"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Тема / контекст <span className="text-zinc-400">(необязательно)</span>
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          placeholder="О чём разговор, кто есть кто. Напр.: ветеринария; Фокси — это кличка кота, не «лиса»."
          className="mb-1 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base leading-relaxed outline-none transition placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-950"
        />
        <p className="mb-4 text-xs text-zinc-400">
          ИИ учитывает это при каждом переводе в этом треде.
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={create}
          disabled={!title.trim() || busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Создать и открыть
        </button>
      </div>
    </div>
  );
}
