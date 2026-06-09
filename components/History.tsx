"use client";

import { Clock, Play } from "lucide-react";
import { HistoryRow, langLabel, targetLabel } from "@/lib/types";

export function History({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-zinc-400">
        <Clock size={22} />
        Пока нет переводов
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
        <Clock size={15} /> История
      </h2>
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              {langLabel(r.sourceLang)}
              <span className="text-emerald-500">→</span>
              {targetLabel(r.sourceLang)}
            </span>
            {r.audioUrl && (
              <button
                onClick={() => new Audio(r.audioUrl!).play()}
                aria-label="Проиграть аудио"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Play size={13} /> аудио
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{r.transcript}</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {r.translation}
          </p>
        </div>
      ))}
    </div>
  );
}
