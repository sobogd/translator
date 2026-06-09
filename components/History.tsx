"use client";

import { useState } from "react";
import { Copy, Check, Volume2, Play, MessageSquare } from "lucide-react";
import { HistoryRow, langLabel, targetLabel } from "@/lib/types";

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ru" ? "ru-RU" : "es-ES";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function Turn({ r }: { r: HistoryRow }) {
  const [copied, setCopied] = useState(false);
  const target = r.sourceLang === "ru" ? "es" : "ru";

  async function copy() {
    await navigator.clipboard.writeText(r.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className="rounded-2xl border p-3.5 shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--hint)" }}>
        {langLabel(r.sourceLang)}
        <span className="text-emerald-500">→</span>
        {targetLabel(r.sourceLang)}
        {r.audioUrl && (
          <button
            onClick={() => new Audio(r.audioUrl!).play()}
            aria-label="Проиграть аудио"
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 transition active:scale-90"
            style={{ color: "var(--hint)" }}
          >
            <Play size={12} /> аудио
          </button>
        )}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "var(--hint)" }}>
        {r.transcript}
      </p>

      <div className="mt-2 flex items-start justify-between gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <p className="text-base font-medium leading-relaxed">{r.translation}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => speak(r.translation, target)}
            aria-label="Озвучить"
            className="rounded-lg p-1.5 text-emerald-600 transition active:scale-90 dark:text-emerald-400"
          >
            <Volume2 size={15} />
          </button>
          <button
            onClick={copy}
            aria-label="Копировать"
            className="rounded-lg p-1.5 text-emerald-600 transition active:scale-90 dark:text-emerald-400"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function History({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 py-16 text-center text-sm"
        style={{ color: "var(--hint)" }}
      >
        <MessageSquare size={22} />
        Пока пусто. Введите текст или запишите голос ниже.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <Turn key={r.id} r={r} />
      ))}
    </div>
  );
}
