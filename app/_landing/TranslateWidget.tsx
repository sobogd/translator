"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2, Volume2 } from "lucide-react";
import { CARD, PRIMARY_BTN } from "./shell";
import { LANGUAGES, getLanguage } from "@/lib/languages";

const ANON_LIMIT = 50;
const USAGE_KEY = "iqt_anon_credits_used";

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function TranslateWidget() {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [from, setFrom] = useState("en");
  const [to, setTo] = useState("es");
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    // one-time init from localStorage, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsed(Number(localStorage.getItem(USAGE_KEY) || 0));
    import("@fingerprintjs/fingerprintjs").then(async (FingerprintJS) => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setFingerprint(result.visitorId);
    });
  }, []);

  const remaining = Math.max(0, ANON_LIMIT - used);
  const fromLang = useMemo(() => getLanguage(from), [from]);

  function swap() {
    setFrom(to);
    setTo(from);
    setText(translation);
    setTranslation("");
  }

  async function translate() {
    if (!text.trim() || !fingerprint || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/translate/anon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), from, to, fingerprint }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setError("Free limit reached — sign in with Google to keep translating.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Translation failed");
      setTranslation(data.translation);
      const cost = Math.max(1, Math.ceil(text.trim().length / 100));
      const nextUsed = used + cost;
      setUsed(nextUsed);
      localStorage.setItem(USAGE_KEY, String(nextUsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${CARD} flex flex-col gap-4 p-6 sm:p-8`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-medium sm:text-[1.75rem]">Try it right now</h2>
        <span className="shrink-0 text-xs text-hint">{remaining}/{ANON_LIMIT} free credits left</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.nameNative}
            </option>
          ))}
        </select>
        <button
          onClick={swap}
          aria-label="Swap languages"
          className="shrink-0 rounded-lg border border-border p-2 text-hint transition hover:text-text"
        >
          <ArrowLeftRight size={16} />
        </button>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.nameNative}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type in ${fromLang?.nameNative ?? from}…`}
          rows={4}
          maxLength={1500}
          className="resize-none rounded-xl border border-border bg-bg p-3 text-sm outline-none"
        />
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-hint">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : translation ? (
            <>
              <p className="flex-1">{translation}</p>
              <button
                onClick={() => speak(translation, to)}
                className="flex w-fit items-center gap-1.5 text-xs text-emerald-500"
              >
                <Volume2 size={14} /> Listen
              </button>
            </>
          ) : (
            <span className="text-hint">Translation appears here…</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}{" "}
          <a href="/api/auth/google/start" className="font-medium underline">
            Sign in
          </a>
        </div>
      )}

      <button
        onClick={translate}
        disabled={!text.trim() || loading || !fingerprint || remaining <= 0}
        className={`${PRIMARY_BTN} self-start`}
      >
        {loading ? "Translating…" : "Translate"}
      </button>
    </div>
  );
}
