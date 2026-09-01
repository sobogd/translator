"use client";

import { useState } from "react";
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

// One chat bubble — social-app convention: the original message sits on the
// left (muted), the translation on the right (filled, "outgoing" style),
// same as any messaging app showing "what they said" vs "what you send back".
function Bubble({
  text,
  lang,
  outgoing,
  texts,
}: {
  text: string;
  lang: string;
  outgoing: boolean;
  texts: HistoryTexts;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`flex flex-col gap-1 ${outgoing ? "items-end" : "items-start"}`}>
      <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-hint">
        {langLabel(lang)}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          outgoing ? "bg-button text-button-text" : "border border-border bg-card"
        }`}
      >
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => speak(text, lang)}
          aria-label={texts.readAloudAria}
          className="rounded-lg p-1 text-hint transition active:scale-90"
        >
          <Volume2 size={13} />
        </button>
        <button
          onClick={copy}
          aria-label={texts.copyAria}
          className="rounded-lg p-1 text-hint transition active:scale-90"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

function Turn({ r, langA, langB, texts }: { r: HistoryRow; langA: string; langB: string; texts: HistoryTexts }) {
  const target = r.sourceLang === langA ? langB : langA;
  return (
    <div className="flex flex-col gap-2">
      <Bubble text={r.transcript} lang={r.sourceLang} outgoing={false} texts={texts} />
      <Bubble text={r.translation} lang={target} outgoing texts={texts} />
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
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <Turn key={r.id} r={r} langA={langA} langB={langB} texts={texts} />
      ))}
    </div>
  );
}
