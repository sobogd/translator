"use client";

import { useRef, useState } from "react";
import { Copy, Check, Volume2, MessageSquare } from "lucide-react";
import type { HistoryRow } from "@/lib/types";
import { getLanguage } from "@/lib/languages";
import type { TranslatorTexts } from "@/app/_landing/types";

type HistoryTexts = TranslatorTexts["history"];

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// `nameNative` (not `nameRu`) — locale-neutral, matches the language picker
// in Translator.tsx so history labels read correctly in every locale.
function langLabel(code: string) {
  const l = getLanguage(code);
  return l ? `${l.flag} ${l.nameNative}` : code;
}

function Turn({ r, langA, langB, texts }: { r: HistoryRow; langA: string; langB: string; texts: HistoryTexts }) {
  const target = r.sourceLang === langA ? langB : langA;
  // show one language at a time; default = translation. Swipe to flip.
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const startX = useRef<number | null>(null);

  const lang = showSource ? r.sourceLang : target;
  const shown = showSource ? r.transcript : r.translation;

  function toggle() {
    setShowSource((s) => !s);
  }

  async function copy() {
    await navigator.clipboard.writeText(shown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      onClick={toggle}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) toggle();
      }}
      className="cursor-pointer select-none rounded-2xl border p-3.5 shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--hint)" }}>
        <span>{langLabel(lang)}</span>
        {/* swipe indicator: two dots, active = current language */}
        <span className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${!showSource ? "bg-button" : ""}`} style={showSource ? { background: "var(--border)" } : undefined} />
          <span className={`h-1.5 w-1.5 rounded-full ${showSource ? "bg-button" : ""}`} style={!showSource ? { background: "var(--border)" } : undefined} />
        </span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className="text-base leading-relaxed">{shown}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              speak(shown, lang);
            }}
            aria-label={texts.readAloudAria}
            className="rounded-lg p-1.5 text-button transition active:scale-90"
          >
            <Volume2 size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            aria-label={texts.copyAria}
            className="rounded-lg p-1.5 text-button transition active:scale-90"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function History({
  rows,
  langA,
  langB,
  texts,
}: {
  rows: HistoryRow[];
  langA: string;
  langB: string;
  texts: HistoryTexts;
}) {
  if (rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 py-16 text-center text-sm"
        style={{ color: "var(--hint)" }}
      >
        <MessageSquare size={22} />
        {texts.emptyState}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <Turn key={r.id} r={r} langA={langA} langB={langB} texts={texts} />
      ))}
    </div>
  );
}
