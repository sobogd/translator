"use client";

import { useState } from "react";
import { Copy, Check, Volume2 } from "lucide-react";
import { TranslateResult, langLabel, targetLabel } from "@/lib/types";

function speak(text: string, lang: "ru" | "es") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ru" ? "ru-RU" : "es-ES";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function ResultCards({ result }: { result: TranslateResult }) {
  const [copied, setCopied] = useState(false);
  const targetLang = result.source_lang === "ru" ? "es" : "ru";

  async function copy() {
    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* original */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {langLabel(result.source_lang)} · оригинал
          </span>
          <button
            onClick={() => speak(result.transcript, result.source_lang)}
            aria-label="Озвучить оригинал"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Volume2 size={16} />
          </button>
        </div>
        <p className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {result.transcript}
        </p>
      </div>

      {/* translation */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {targetLabel(result.source_lang)} · перевод
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => speak(result.translation, targetLang)}
              aria-label="Озвучить перевод"
              className="rounded-lg p-1.5 text-emerald-600/70 transition hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400/70 dark:hover:bg-emerald-900/50"
            >
              <Volume2 size={16} />
            </button>
            <button
              onClick={copy}
              aria-label="Копировать перевод"
              className="rounded-lg p-1.5 text-emerald-600/70 transition hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400/70 dark:hover:bg-emerald-900/50"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <p className="text-lg font-medium leading-relaxed text-zinc-900 dark:text-white">
          {result.translation}
        </p>
      </div>
    </div>
  );
}
