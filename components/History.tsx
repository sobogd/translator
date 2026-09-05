"use client";

import { useState } from "react";
import { Copy, Check, Volume2, MessageSquare } from "lucide-react";
import type { HistoryRow } from "@/lib/types";
import type { TranslatorTexts } from "@/app/_landing/types";

type HistoryTexts = TranslatorTexts["history"];

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// Once a topic's pair is locked, `langA` (topic.sourceLang, whoever's first
// message established the pair) and `langB` (topic.targetLang) each belong
// to one side of a two-person conversation — align that turn's bubble to
// the speaker's side so a back-and-forth reads like a chat, not a stack of
// identical cards. Before the pair locks (langA === ""), everything is from
// the same not-yet-established side, so nothing aligns right.
function Turn({ r, langA, langB, texts }: { r: HistoryRow; langA: string; langB: string; texts: HistoryTexts }) {
  const target = r.sourceLang === langA ? langB : langA;
  const fromA = langA !== "" && r.sourceLang === langA;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(r.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`flex ${fromA ? "justify-end" : "justify-start"}`}>
      {/* Both sides are the same shape — flat neutral fills, no outline. The
          two tones come from the palette tokens (accent grey for one speaker,
          bare border for the other) so they read on the widget's white chat
          surface without pulling any colour into the thread. */}
      <div
        className={`w-full max-w-[85%] rounded-lg p-3.5 ${
          fromA ? "bg-accent" : "border border-border"
        }`}
      >
        {/* Original (small, muted) above the translation (larger, primary) —
            both texts, no language labels, no interaction. */}
        <p className="mb-1.5 text-sm leading-snug text-hint">{r.transcript}</p>

        <div className="flex items-start justify-between gap-2">
          <p className="text-base leading-relaxed">{r.translation}</p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => speak(r.translation, target)}
              aria-label={texts.readAloudAria}
              className="rounded-lg p-1.5 text-button transition active:scale-90"
            >
              <Volume2 size={15} />
            </button>
            <button
              onClick={copy}
              aria-label={texts.copyAria}
              className="rounded-lg p-1.5 text-button transition active:scale-90"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
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
        className="flex flex-1 min-h-[14rem] max-w-[300px] flex-col items-center justify-center gap-3 self-center text-center text-base opacity-50"
        style={{ color: "var(--hint)" }}
      >
        <MessageSquare size={36} />
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
