"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, ArrowUp, Loader2, Mic, PanelLeft, Plus, Square, Trash2, X } from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { History } from "@/components/History";
import { apiFetch } from "@/lib/client";
import type { Topic, TopicDetail } from "@/lib/types";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { CARD } from "./shell";
import { Modal } from "./Modal";
import { QUOTA_EVENT, useSession } from "./session";
import { analytics } from "@/lib/analytics";
import { useTurnstileGate } from "./Turnstile";
import type { TranslatorTexts } from "./types";

const TO_KEY = "translator_to_lang";
// Last thread the visitor had open, restored on the next visit to the same
// pair page (the topic list itself is fetched after hydration — every page
// here is prerendered, so nothing personalized exists during render).
const LAST_TOPIC_KEY = "iqt_last_topic";
const rememberTopic = (id: string) => {
  try {
    localStorage.setItem(LAST_TOPIC_KEY, id);
  } catch {
    /* private mode — the list still opens, just without the memory */
  }
};
// Turnstile's public site key. Inlined at build time (NEXT_PUBLIC_*) instead
// of read on the server, so the pages stay statically prerendered — the
// secret half (TS_SECRET) never leaves lib/turnstile.ts.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TS_SITE ?? null;
const DEFAULT_TO = "es";

type RecStatus = "idle" | "recording" | "processing";
type WidgetTexts = TranslatorTexts["translator"];

/** Error codes reach the name field, which the server validates against a
 *  tight character set — anything unexpected would take the whole batch down
 *  with it, so clamp here. */
function trackError(code: string): string {
  const slug = code.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  return slug || "unknown";
}

function friendlyError(code: string, texts: WidgetTexts): string {
  if (code === "insufficient_credits") return texts.errors.insufficientCredits;
  if (code === "text too long for your plan") return texts.errors.textTooLong;
  if (code === "turnstile_required" || code === "turnstile_failed") return texts.errors.turnstileFailed;
  return code;
}

function matchesQuery(l: { nameRu: string; nameNative: string }, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return l.nameRu.toLowerCase().includes(needle) || l.nameNative.toLowerCase().includes(needle);
}

function LanguagePickerModal({
  current,
  forSource,
  texts,
  onClose,
  onSelect,
}: {
  current: string | null;
  /** Only the source picker offers "Auto-detect" — the target always needs
   *  a concrete language. Both pickers otherwise list every language,
   *  including whatever's currently selected on the other side — picking a
   *  colliding pair is resolved by auto-substituting the source with
   *  auto-detect (see selectSource/selectTarget), not by hiding options. */
  forSource?: boolean;
  texts: WidgetTexts;
  onClose: () => void;
  onSelect: (code: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const list = LANGUAGES.filter((l) => matchesQuery(l, query));

  return (
    <Modal title={texts.chooseLanguage} onClose={onClose} closeAria={texts.close} maxWidth="max-w-lg">
      {/* Flush full-width search: no box, no fill — just a bottom border,
          sticky over the list, text aligned with the option rows below. */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        placeholder={texts.searchPlaceholder}
        className="sticky top-0 z-10 w-full shrink-0 border-b border-border px-5 py-3.5 text-base outline-none placeholder:text-hint"
        style={{ background: "var(--card)" }}
      />
      {/* No flags anywhere in the widget — the ISO code carries the same
          "which language is this" cue without implying a country, and keeps
          a 180-row list scannable. */}
      <div className="p-2">
        {forSource && (
          <button
            onClick={() => onSelect(null)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99]"
            style={current === null ? { background: "var(--bg)" } : undefined}
          >
            <span className="w-8 shrink-0 text-xs font-medium text-hint">—</span>
            <span className="min-w-0 flex-1 truncate">{texts.autoDetect}</span>
          </button>
        )}
        {list.map((l) => (
          <button
            key={l.code}
            onClick={() => onSelect(l.code)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99]"
            style={l.code === current ? { background: "var(--bg)" } : undefined}
          >
            <span className="w-8 shrink-0 font-mono text-xs uppercase text-hint">{l.code}</span>
            <span className="min-w-0 flex-1 truncate">{l.nameNative}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export type HeroTexts = { title: string; titleAccent: string; description: string };

export function Translator({
  texts,
  heroTexts,
  presetSource,
  presetTarget,
  initialTarget,
  pricingHref = "/pricing",
}: {
  texts: TranslatorTexts;
  /** SEO headline shown left of the widget until the first topic exists. */
  heroTexts: HeroTexts;
  /** Pair-page preset: pre-picked source language for the draft state. */
  presetSource?: string;
  /** Pair-page preset: pre-picked target language; wins over localStorage. */
  presetTarget?: string;
  /** Soft default target (locale homes): initial value only, localStorage wins. */
  initialTarget?: string;
  /** Locale-local pricing path for the out-of-quota error link. */
  pricingHref?: string;
}) {
  const t = texts.translator;
  // Signed-in visitors are never bot-challenged (see lib/turnstile.ts).
  const { signedIn } = useSession();
  const [defaultTarget, setDefaultTarget] = useState(presetTarget ?? initialTarget ?? DEFAULT_TO);
  const [topics, setTopics] = useState<Topic[]>([]);
  // Only pair pages auto-open a thread (the matching one, fetched below);
  // home always starts as a blank draft. A topic only ever lands there once
  // the user actually sends something in this session (see
  // translateText/stopRec), so the hero picker never ends up showing some
  // unrelated pair.
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  // Source language chosen before a topic exists yet — carried into the
  // topic created on first send. Mirrors topic.sourceLang's semantics
  // (null = auto-detect).
  const [draftSourceLang, setDraftSourceLang] = useState<string | null>(presetSource ?? null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [pickerFor, setPickerFor] = useState<"source" | "target" | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState(false);
  // Remaining voice seconds, fetched when recording starts — the ticking
  // timer stops the mic the moment the free/plan pool would run out.
  const secondsLeftRef = useRef<number | null>(null);

  // Bot gate in front of the Gemini-spending endpoints. Anonymous visitors
  // only: an account's requests are never challenged server-side, so the
  // widget script isn't even loaded for them.
  const { containerRef: turnstileRef, ensurePass, invalidatePass } = useTurnstileGate(
    TURNSTILE_SITE_KEY,
    !signedIn,
  );

  const recRef = useRef<WavRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A pair page's preset wins over the last-used target from localStorage.
    if (presetTarget) return;
    const saved = localStorage.getItem(TO_KEY);
    // one-time init from localStorage, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDefaultTarget(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTopics = useCallback(async () => {
    const res = await apiFetch("/api/topics");
    if (res.ok) setTopics(await res.json());
  }, []);

  const loadTopic = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/topics/${id}`);
    if (res.ok) setTopic(await res.json());
  }, []);

  // Creates a topic and returns its id — the only place a session actually
  // gets written. Called lazily, from translateText, on the first send.
  const createTopic = useCallback(
    async (targetLang: string, sourceLang?: string | null) => {
      const res = await apiFetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang, ...(sourceLang ? { sourceLang } : {}) }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "error");
      await loadTopics();
      await loadTopic(created.id);
      rememberTopic(created.id as string);
      return created.id as string;
    },
    [loadTopics, loadTopic],
  );

  // bootstrap once: open the most recently used topic. No topics yet? Stay
  // in draft state (topic=null) — a session is only created once the user
  // actually sends something to translate, not just for opening the page.
  useEffect(() => {
    (async () => {
      setLoadingTopic(true);
      try {
        const res = await apiFetch("/api/topics");
        const list: Topic[] = res.ok ? await res.json() : [];
        setTopics(list);
        // Pair pages auto-open the topic matching their fixed pair — the one
        // last used here if it still exists, otherwise the most recent (the
        // list arrives ordered by lastUsedAt). Home never auto-opens
        // anything: it only ever gets a topic once the user actually sends
        // something in this session.
        const candidates = fixedPair
          ? list.filter((tp) => tp.sourceLang === presetSource && tp.targetLang === presetTarget)
          : [];
        let remembered: string | null = null;
        try {
          remembered = localStorage.getItem(LAST_TOPIC_KEY);
        } catch {
          /* private mode */
        }
        const match = candidates.find((tp) => tp.id === remembered) ?? candidates[0];
        if (match) await loadTopic(match.id);
      } catch {
        setTopic(null);
      } finally {
        setLoadingTopic(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the newest turn in view — the chat column is its own scroll box now
  // (fixed-height desktop layout), not page content, so it scrolls itself.
  const turnCount = topic?.translations?.length ?? 0;
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [turnCount, topic?.id]);

  async function switchTopic(id: string) {
    analytics.track("Click", "Topic switch");
    rememberTopic(id);
    setText("");
    setError(null);
    setLoadingTopic(true);
    await loadTopic(id);
    setLoadingTopic(false);
  }

  // No API call — just clears the view back to a draft. The topic itself
  // is only created once the user actually sends something (translateText).
  function newTopic() {
    analytics.track("Click", "Topic new");
    setTopic(null);
    setDraftSourceLang(null);
    setText("");
    setError(null);
  }

  async function deleteTopic(id: string) {
    if (!confirm(t.deleteTopicConfirm)) return;
    analytics.track("Click", "Topic delete");
    await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
    const remaining = topics.filter((tp) => tp.id !== id);
    setTopics(remaining);
    if (id === topic?.id) {
      // Next one up has to match this same pair — falling back to some
      // other pair's topic just because it's first in the global list would
      // silently switch the conversation the user is looking at.
      const next = remaining.find(matchesPair);
      if (next) {
        setLoadingTopic(true);
        try {
          await loadTopic(next.id);
        } finally {
          setLoadingTopic(false);
        }
      } else {
        setTopic(null);
        setDraftSourceLang(null);
      }
    }
  }

  // Both pickers list every language, including the one already selected on
  // the other side — a same-language pair is resolved by falling back the
  // source to auto-detect (target always stays a concrete language; only
  // the source can mean "figure it out from the text").
  // Only ever triggered from the hero picker (home) — always resets to a
  // fresh draft, never mutates whatever topic happens to be loaded.
  function selectSource(code: string | null) {
    analytics.track("Click", `Language source ${code ?? "auto"}`);
    setPickerFor(null);
    setTopic(null);
    setDraftSourceLang(code !== null && code === defaultTarget ? null : code);
  }

  function selectTarget(code: string) {
    analytics.track("Click", `Language target ${code}`);
    setPickerFor(null);
    localStorage.setItem(TO_KEY, code);
    setDefaultTarget(code);
    setTopic(null);
    setDraftSourceLang((prev) => (prev === code ? null : prev));
  }

  // Caps at 3 lines: leading-6 (24px) × 3 + the textarea's own py-2 (16px).
  const TEXTAREA_MAX_H = 88;
  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_H)}px`;
  }

  async function translateText() {
    if (!text.trim() || textBusy) return;
    const pair = trackPair();
    analytics.track("Click", "Send text");
    setError(null);
    setTextBusy(true);
    // Text stays in the input while busy (not cleared up front) — that's
    // what keeps the composer CTA showing its spinner instead of falling
    // back to the mic icon (showSend needs non-empty text).
    const sent = text;
    try {
      // First send with no topic yet: create one now, carrying over
      // whatever source/target were picked in draft state.
      if (!(await ensurePass())) throw new Error("turnstile_failed");
      const topicId = topic?.id ?? (await createTopic(defaultTarget, draftSourceLang));
      const send = () =>
        apiFetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sent, topicId }),
        });
      let res = await send();
      // The pass cookie expired between the local check and the request:
      // solve once more and resend rather than surfacing an error.
      if (res.status === 403) {
        invalidatePass();
        if (!(await ensurePass())) throw new Error("turnstile_failed");
        res = await send();
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      setText("");
      requestAnimationFrame(autosize);
      analytics.track("Translate", `Text ${pair}`);
      await loadTopic(topicId);
      await loadTopics();
      window.dispatchEvent(new Event(QUOTA_EVENT));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "insufficient_credits") setQuotaModal(true);
      else {
        analytics.track("Show", `Translate error text: ${trackError(msg)}`);
        setError(friendlyError(msg, t));
      }
    } finally {
      setTextBusy(false);
    }
  }

  async function startRec() {
    analytics.track("Click", "Mic start");
    setError(null);
    try {
      const res = await apiFetch("/api/quota");
      if (res.ok) {
        const q = await res.json();
        secondsLeftRef.current = typeof q.seconds === "number" ? q.seconds : null;
        if (q.seconds <= 0) {
          setQuotaModal(true);
          return;
        }
      }
    } catch {
      secondsLeftRef.current = null;
    }
    try {
      const rec = new WavRecorder();
      await rec.start();
      recRef.current = rec;
      setStatus("recording");
      // Solve while the user is still speaking — by the time the recording
      // is sent the pass is usually already there.
      void ensurePass();
    } catch {
      analytics.track("Show", "Mic denied");
      setError(t.micDeniedError);
    }
  }

  // Out of seconds mid-recording: drop the take (sending it would just 402)
  // and surface the quota modal instead.
  async function cancelRec() {
    analytics.track("Show", "Recording cut: out of seconds");
    const rec = recRef.current;
    recRef.current = null;
    setStatus("idle");
    if (rec) {
      try {
        await rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setQuotaModal(true);
  }

  // Stop = send: the recording goes straight through STT + translation in
  // one request (no intermediate editable transcript step).
  async function stopRec() {
    const rec = recRef.current;
    if (!rec) return;
    const pair = trackPair();
    analytics.track("Click", "Mic stop");
    setStatus("processing");
    try {
      const blob = await rec.stop();
      recRef.current = null;
      if (!(await ensurePass())) throw new Error("turnstile_failed");
      const topicId = topic?.id ?? (await createTopic(defaultTarget, draftSourceLang));
      const fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      fd.append("topicId", topicId);
      const send = () => apiFetch("/api/translate-voice", { method: "POST", body: fd });
      let res = await send();
      if (res.status === 403) {
        invalidatePass();
        if (!(await ensurePass())) throw new Error("turnstile_failed");
        res = await send();
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      analytics.track("Translate", `Voice ${pair}`);
      await loadTopic(topicId);
      await loadTopics();
      window.dispatchEvent(new Event(QUOTA_EVENT));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "insufficient_credits") setQuotaModal(true);
      else {
        analytics.track("Show", `Translate error voice: ${trackError(msg)}`);
        setError(friendlyError(msg, t));
      }
    } finally {
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    const tick = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setElapsed(secs);
      const left = secondsLeftRef.current;
      if (left !== null && secs >= left) cancelRec();
    }, 250);
    return () => {
      clearInterval(tick);
      setElapsed(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Language pair of whatever is about to be sent, as one locale-stable token
  // ("es-en", "auto-fr") — the analytics name, never a translated label.
  const trackPair = () =>
    `${topic?.sourceLang ?? draftSourceLang ?? "auto"}-${topic?.targetLang ?? defaultTarget}`;

  // Stamp every event fired from here with the conversation it happened in;
  // the server drops the id unless the caller really owns that topic.
  useEffect(() => {
    analytics.setTopic(topic?.id ?? null);
    return () => analytics.setTopic(null);
  }, [topic?.id]);

  // One event wherever the out-of-quota modal comes up — it is opened from
  // four places (text, voice, mic start, mid-recording cut).
  useEffect(() => {
    if (quotaModal) analytics.track("Show", "Quota modal");
  }, [quotaModal]);

  const currentSourceCode = topic ? topic.sourceLang : draftSourceLang;
  const targetLanguage = useMemo(() => getLanguage(topic?.targetLang ?? defaultTarget), [topic?.targetLang, defaultTarget]);
  // Pair pages bake both languages into the slug/SEO copy — nothing to pick,
  // ever. Only the home widget (no presets) offers the source/target picker.
  const fixedPair = presetSource !== undefined && presetTarget !== undefined;
  const rows = topic ? [...topic.translations].reverse() : [];

  // Topics belong to a language pair — only show/auto-open the ones that
  // match this page's pair (fixed for pair pages; the current draft pick on
  // home). While the source side is still "auto-detect" the pair isn't
  // known yet (the flow is: send → server detects the source language →
  // that gets plugged into the selector), so topics stay hidden entirely
  // until then.
  const pairA = fixedPair ? (presetSource as string) : currentSourceCode;
  const pairB = fixedPair ? (presetTarget as string) : (targetLanguage?.code ?? defaultTarget);
  const pairKnown = pairA !== null;
  const matchesPair = (tp: Topic) => (tp.sourceLang === pairA && tp.targetLang === pairB) || (tp.sourceLang === pairB && tp.targetLang === pairA);
  const pairTopics = pairKnown ? topics.filter(matchesPair) : [];

  // Composer half of the omnibar — text field, a mic separated by a left
  // border, and the accent translate CTA hugging the card edge (the card's
  // overflow-hidden supplies its only rounded corner).
  const showSend = status === "idle" && text.trim().length > 0;
  const micOrSend = status === "recording" ? stopRec : showSend ? translateText : startRec;

  const composerRow = (
    <div className="flex min-w-0 flex-1 items-end gap-1.5 rounded-lg border border-border bg-bg p-2.5">
      {/* Turnstile render target. Empty (zero-height) unless Cloudflare
          decides this visitor has to interact with the challenge. */}
      <div ref={turnstileRef} className="empty:hidden" />
      {status !== "idle" ? (
        <div className="flex min-h-9 flex-1 items-center gap-3 px-2.5 text-sm text-hint">
          {status === "recording" ? (
            <>
              <span className="flex h-4 items-end gap-0.5">
                {[0, 150, 300, 450, 300, 150].map((delay, i) => (
                  <span
                    key={i}
                    className="h-4 w-1 origin-bottom animate-wave rounded-full bg-red-500"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              {t.recording} · {fmtTime(elapsed)}
            </>
          ) : (
            <>
              <Loader2 size={14} className="animate-spin" /> {t.recognizing}
            </>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onInput={autosize}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) translateText();
          }}
          placeholder={t.typePlaceholder}
          rows={1}
          name="translator-source-text"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-bwignore
          data-form-type="other"
          style={{ maxHeight: TEXTAREA_MAX_H }}
          className="min-h-9 flex-1 resize-none self-center border-0 bg-transparent px-2.5 py-2 text-base leading-6 outline-none"
        />
      )}
      <button
        onClick={micOrSend}
        disabled={status === "processing" || (showSend && textBusy)}
        aria-label={status === "recording" ? t.stopAria : showSend ? t.translateAria : t.recordAria}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] text-sm font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-40 ${
          status === "recording" ? "animate-pulse-ring" : ""
        }`}
      >
        {status === "processing" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : status === "recording" ? (
          <Square size={14} fill="currentColor" />
        ) : showSend ? (
          textBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowUp size={18} />
          )
        ) : (
          <Mic size={18} />
        )}
      </button>
    </div>
  );

  // Language buttons: always full-width halves — the pair row sits on its
  // own line above the composer/content, on every breakpoint.
  const langBtnClass =
    "flex min-h-11 min-w-0 flex-1 items-center justify-center px-3 text-sm font-semibold transition hover:bg-bg disabled:pointer-events-none";

  // Standalone pill — sits under the hero headline on the home widget,
  // pre-loading the pair the composer on the right will use. Shows the
  // DRAFT pair, never whatever topic happens to be loaded (e.g. hydrated
  // from a previous visit to a different pair page) — clicking only opens
  // the picker, nothing changes until an actual selection is made inside it.
  const heroPairRow = (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => {
          analytics.track("Click", "Language picker source");
          setPickerFor("source");
        }}
        className={langBtnClass}
      >
        <span className="truncate">
          {currentSourceCode ? (getLanguage(currentSourceCode)?.nameNative ?? currentSourceCode) : t.autoDetect}
        </span>
      </button>
      <span className="flex w-10 shrink-0 items-center justify-center text-hint">
        <ArrowRightLeft size={16} />
      </span>
      <button
        onClick={() => {
          analytics.track("Click", "Language picker target");
          setPickerFor("target");
        }}
        className={langBtnClass}
      >
        <span className="truncate">{targetLanguage?.nameNative ?? defaultTarget}</span>
      </button>
    </div>
  );

  // Topic rows only — no background fill, active = bold text. Shared between
  // the permanent desktop sidebar and the mobile drawer (see below).
  const topicsList = (onPick: () => void) =>
    pairTopics.length === 0 ? (
      <div className="py-6 text-center text-sm text-hint">{t.noTopicsYet}</div>
    ) : (
      pairTopics.map((tp) => (
        <div key={tp.id} className="flex items-center gap-1">
          <button
            onClick={() => {
              switchTopic(tp.id);
              onPick();
            }}
            className={`flex min-w-0 flex-1 items-center gap-2 px-1 py-2.5 text-left text-sm transition active:scale-[0.99] ${
              tp.id === topic?.id ? "font-medium text-text" : "text-hint hover:text-text"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{tp.title || t.newTopic}</span>
          </button>
          <button
            onClick={() => deleteTopic(tp.id)}
            aria-label={t.deleteTopic}
            className="shrink-0 rounded-lg p-1.5 text-hint transition hover:text-red-500 active:scale-90"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))
    );

  return (
    <div className="flex flex-col gap-4">
      {/* SEO hero text comes first everywhere — above the widget on mobile,
          left of it on desktop — whether or not a topic exists yet; the
          widget is always fully live —
          topics live behind a toggle + sliding drawer, anchored to the
          widget itself, same on every breakpoint. */}
      <div className="flex flex-col gap-4 lg:grid lg:h-[calc(95vh_-_89px)] lg:grid-cols-[2fr_3fr] lg:gap-0 lg:rounded-2xl lg:border lg:border-border lg:overflow-hidden">
        <div className="flex min-w-0 flex-col items-start gap-6 rounded-2xl border border-border bg-[hsl(32_44%_92%)] p-6 text-start dark:bg-[hsl(32_14%_14%)] sm:p-8 lg:h-full lg:rounded-none lg:border-0">
          <div className="my-auto flex min-w-0 flex-col gap-4">
            <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
              {heroTexts.title}{" "}
              <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
                {heroTexts.titleAccent}
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{heroTexts.description}</p>
            {/* Pre-loads the composer on the right — home only, pair
                pages have nothing to pick, it's fixed by the slug. */}
            {!fixedPair && heroPairRow}
          </div>
        </div>

        <div className="relative flex h-[calc(95dvh_-_81px)] min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border lg:h-[calc(95vh_-_89px)] lg:rounded-none lg:border-0">
          {/* Chat spans the full height and scrolls behind the two
              islands — they're overlaid (absolute), not flex siblings, so
              they never shrink the scroll area. Padding on the scroll box
              matches each island's own box height so content never sits
              underneath one. */}
          <div
            ref={chatScrollRef}
            className={`absolute inset-0 z-0 flex flex-col overflow-y-auto px-4 pb-28 sm:px-6 ${pairKnown ? "pt-20" : "pt-4"}`}
          >
            {loadingTopic ? (
              <div className="flex justify-center py-10 text-hint">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <History
                rows={rows}
                langA={topic?.sourceLang ?? ""}
                langB={topic?.targetLang ?? ""}
                texts={texts.history}
              />
            )}
          </div>

          {pairKnown && (
            <div className="absolute inset-x-0 top-0 z-10 p-3 pb-0">
              <button
                onClick={() => {
                  analytics.track("Click", `Topics ${topicsOpen ? "close" : "open"}`);
                  setTopicsOpen((v) => !v);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg p-2.5 text-sm font-medium text-hint transition hover:text-text active:scale-[0.99]"
              >
                <PanelLeft size={16} />
                <span className="max-w-[10rem] truncate">{topic?.title || t.topics}</span>
              </button>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 p-3">{composerRow}</div>

          {/* Always mounted (not conditionally) so the transform/opacity
              transitions actually animate instead of popping in. Backdrop
              blurs the chat behind it — blur fades with the opacity since
              it rides the same element. */}
          <div
            className={`absolute inset-0 z-20 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
              topicsOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setTopicsOpen(false)}
          />
          <div
            className={`absolute inset-y-0 left-0 z-30 flex w-full max-w-[18rem] flex-col gap-3 overflow-hidden bg-bg p-4 transition-transform duration-300 ease-out sm:p-5 ${
              topicsOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex shrink-0 items-center justify-between">
              {/* Not a heading: this is the widget's sidebar label, and as an
                  <h2> it landed above every real section heading in the
                  document outline. */}
              <p className="px-1 text-xs font-semibold uppercase tracking-wide text-hint">{t.topics}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    newTopic();
                    setTopicsOpen(false);
                  }}
                  aria-label={t.newTopic}
                  className="rounded-lg p-1.5 text-hint transition hover:text-text active:scale-90"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => setTopicsOpen(false)}
                  aria-label={t.close}
                  className="rounded-lg p-1.5 text-hint transition active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {topicsList(() => setTopicsOpen(false))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Modal
          title={error}
          onClose={() => setError(null)}
          closeAria={t.close}
          footer={
            <button
              onClick={() => setError(null)}
              className="inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
            >
              {t.close}
            </button>
          }
        >
          {null}
        </Modal>
      )}

      {quotaModal && (
        <Modal
          title={texts.account.upgrade}
          onClose={() => setQuotaModal(false)}
          closeAria={t.close}
          footer={
            <a
              href={pricingHref}
              onClick={() => {
                analytics.track("Click", "Quota modal upgrade");
                analytics.flush();
              }}
              className="inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] px-4 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
            >
              {t.pricingLink}
            </a>
          }
        >
          <div className="px-5 py-4 text-sm text-hint">{t.errors.insufficientCredits}</div>
        </Modal>
      )}

      {pickerFor && (
        <LanguagePickerModal
          current={pickerFor === "source" ? currentSourceCode : (topic?.targetLang ?? defaultTarget)}
          forSource={pickerFor === "source"}
          texts={t}
          onClose={() => setPickerFor(null)}
          onSelect={pickerFor === "source" ? selectSource : (code) => code && selectTarget(code)}
        />
      )}
    </div>
  );
}
