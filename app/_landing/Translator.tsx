"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Eraser, Loader2, Mic, Plus, Send, Square, Trash2 } from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { History } from "@/components/History";
import { apiFetch } from "@/lib/client";
import type { Topic, TopicDetail } from "@/lib/types";
import type { InitialTopics } from "@/lib/topics-server";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { CARD } from "./shell";
import { Modal } from "./Modal";
import { QUOTA_EVENT } from "./AccountControls";
import type { TranslatorTexts } from "./types";

const TO_KEY = "translator_to_lang";
// Which thread SSR should hydrate next time (see lib/topics-server.ts).
const LAST_TOPIC_COOKIE = "iqt_last_topic";
const rememberTopic = (id: string) => {
  document.cookie = `${LAST_TOPIC_COOKIE}=${id}; path=/; max-age=${400 * 86400}; samesite=lax`;
};
const DEFAULT_TO = "es";

type RecStatus = "idle" | "recording" | "processing";
type WidgetTexts = TranslatorTexts["translator"];

function friendlyError(code: string, texts: WidgetTexts): string {
  if (code === "insufficient_credits") return texts.errors.insufficientCredits;
  if (code === "text too long for your plan") return texts.errors.textTooLong;
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

export function Translator({
  texts,
  presetSource,
  presetTarget,
  initialTarget,
  pricingHref = "/pricing",
  initialData = null,
}: {
  texts: TranslatorTexts;
  /** Pair-page preset: pre-picked source language for the draft state. */
  presetSource?: string;
  /** Pair-page preset: pre-picked target language; wins over localStorage. */
  presetTarget?: string;
  /** Soft default target (locale homes): initial value only, localStorage wins. */
  initialTarget?: string;
  /** Locale-local pricing path for the out-of-quota error link. */
  pricingHref?: string;
  /** SSR-preloaded topic list + last-opened thread (lib/topics-server.ts). */
  initialData?: InitialTopics | null;
}) {
  const t = texts.translator;
  const [defaultTarget, setDefaultTarget] = useState(presetTarget ?? initialTarget ?? DEFAULT_TO);
  const [topics, setTopics] = useState<Topic[]>(initialData?.topics ?? []);
  const [topic, setTopic] = useState<TopicDetail | null>(initialData?.topic ?? null);
  // Source language chosen before a topic exists yet — carried into the
  // topic created on first send. Mirrors topic.sourceLang's semantics
  // (null = auto-detect).
  const [draftSourceLang, setDraftSourceLang] = useState<string | null>(presetSource ?? null);
  const [loadingTopic, setLoadingTopic] = useState(!initialData);
  const [pickerFor, setPickerFor] = useState<"source" | "target" | null>(null);
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState(false);
  // Remaining voice seconds, fetched when recording starts — the ticking
  // timer stops the mic the moment the free/plan pool would run out.
  const secondsLeftRef = useRef<number | null>(null);

  const recRef = useRef<WavRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const pending = textBusy || status === "processing";

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
    // SSR already delivered the list + last thread — nothing to fetch.
    if (initialData) return;
    (async () => {
      setLoadingTopic(true);
      try {
        const res = await apiFetch("/api/topics");
        const list: Topic[] = res.ok ? await res.json() : [];
        setTopics(list);
        if (list.length > 0) await loadTopic(list[0].id);
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
    setTopic(null);
    setDraftSourceLang(null);
    setText("");
    setError(null);
  }

  async function deleteTopic(id: string) {
    if (!confirm(t.deleteTopicConfirm)) return;
    await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
    const remaining = topics.filter((tp) => tp.id !== id);
    setTopics(remaining);
    if (id === topic?.id) {
      if (remaining.length > 0) {
        setLoadingTopic(true);
        try {
          await loadTopic(remaining[0].id);
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
  async function selectSource(code: string | null) {
    setPickerFor(null);
    if (!topic) {
      // Draft state, nothing to PATCH yet — carried into the topic created
      // on first send.
      setDraftSourceLang(code !== null && code === defaultTarget ? null : code);
      return;
    }
    const nextSource = code !== null && code === topic.targetLang ? null : code;
    setTopic({ ...topic, sourceLang: nextSource });
    await apiFetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang: nextSource }),
    });
  }

  async function selectTarget(code: string) {
    setPickerFor(null);
    localStorage.setItem(TO_KEY, code);
    setDefaultTarget(code);
    if (!topic) {
      setDraftSourceLang((prev) => (prev === code ? null : prev));
      return;
    }
    const nextSource = topic.sourceLang === code ? null : topic.sourceLang;
    setTopic({ ...topic, sourceLang: nextSource, targetLang: code });
    await apiFetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang: nextSource, targetLang: code }),
    });
  }

  async function clearHistory() {
    if (!topic) return;
    if (!confirm(t.clearHistoryConfirm)) return;
    await apiFetch(`/api/topics/${topic.id}/translations`, { method: "DELETE" });
    await loadTopic(topic.id);
  }

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function translateText() {
    if (!text.trim() || textBusy) return;
    setError(null);
    setTextBusy(true);
    const sent = text;
    setText("");
    requestAnimationFrame(autosize);
    try {
      // First send with no topic yet: create one now, carrying over
      // whatever source/target were picked in draft state.
      const topicId = topic?.id ?? (await createTopic(defaultTarget, draftSourceLang));
      const res = await apiFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sent, topicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      await loadTopic(topicId);
      await loadTopics();
      window.dispatchEvent(new Event(QUOTA_EVENT));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "insufficient_credits") setQuotaModal(true);
      else setError(friendlyError(msg, t));
      setText(sent);
    } finally {
      setTextBusy(false);
    }
  }

  async function startRec() {
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
    } catch {
      setError(t.micDeniedError);
    }
  }

  // Out of seconds mid-recording: drop the take (sending it would just 402)
  // and surface the quota modal instead.
  async function cancelRec() {
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
    setStatus("processing");
    try {
      const blob = await rec.stop();
      recRef.current = null;
      const topicId = topic?.id ?? (await createTopic(defaultTarget, draftSourceLang));
      const fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      fd.append("topicId", topicId);
      const res = await apiFetch("/api/translate-voice", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      await loadTopic(topicId);
      await loadTopics();
      window.dispatchEvent(new Event(QUOTA_EVENT));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      if (msg === "insufficient_credits") setQuotaModal(true);
      else setError(friendlyError(msg, t));
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

  const currentSourceCode = topic ? topic.sourceLang : draftSourceLang;
  const sourceLanguage = useMemo(() => (currentSourceCode ? getLanguage(currentSourceCode) : undefined), [currentSourceCode]);
  const targetLanguage = useMemo(() => getLanguage(topic?.targetLang ?? defaultTarget), [topic?.targetLang, defaultTarget]);
  // Once a message has locked the pair (topic.sourceLang set), it stays
  // fixed for the rest of the topic — no re-picking, no resetting back to
  // auto-detect. Later turns can come from either side of that pair (see
  // translatePair server-side); the picker only ever applied to a draft or
  // a topic still waiting on its first message.
  const pairLocked = !!topic && topic.sourceLang !== null;
  const rows = topic ? [...topic.translations].reverse() : [];

  // Reverse the pair. Only while it is still editable and the source is
  // concrete — auto-detect has no "other side" to swap to, and a locked
  // topic already translates both directions.
  const canSwap = !pairLocked && !!currentSourceCode;
  async function swapPair() {
    if (!canSwap || !currentSourceCode) return;
    const newSource = topic ? topic.targetLang : defaultTarget;
    const newTarget = currentSourceCode;
    localStorage.setItem(TO_KEY, newTarget);
    setDefaultTarget(newTarget);
    if (!topic) {
      setDraftSourceLang(newSource);
      return;
    }
    setTopic({ ...topic, sourceLang: newSource, targetLang: newTarget });
    await apiFetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang: newSource, targetLang: newTarget }),
    });
  }

  // Progressive disclosure: until the very first translation exists there is
  // nothing to manage — show just the omnibar; the topics/chat card unfolds
  // above it once the first turn lands.
  const compactMode = topics.length === 0 && rows.length === 0;

  // Composer half of the omnibar — text field, a mic separated by a left
  // border, and the accent translate CTA hugging the card edge (the card's
  // overflow-hidden supplies its only rounded corner).
  const showSend = status === "idle" && text.trim().length > 0;
  const micOrSend = status === "recording" ? stopRec : showSend ? translateText : startRec;

  const composerRow = (
    <div className="flex min-w-0 flex-1 items-stretch">
      {status !== "idle" ? (
        <div className="flex min-h-11 flex-1 items-center gap-3 px-4 text-sm text-hint">
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
          className="max-h-[120px] min-h-11 flex-1 resize-none self-center border-0 bg-transparent px-4 py-2.5 text-base leading-6 outline-none"
        />
      )}
      <button
        onClick={micOrSend}
        disabled={status === "processing" || (showSend && textBusy)}
        aria-label={status === "recording" ? t.stopAria : showSend ? t.translateAria : t.recordAria}
        className={`flex shrink-0 items-center justify-center px-5 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${
          status === "recording" || (status === "idle" && !showSend)
            ? "w-12 border-l border-border text-hint hover:text-text"
            : "bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] text-white hover:opacity-90"
        } ${status === "recording" ? "text-red-500" : ""}`}
      >
        {status === "processing" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : status === "recording" ? (
          <Square size={14} fill="currentColor" />
        ) : showSend ? (
          textBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )
        ) : (
          <Mic size={18} />
        )}
      </button>
    </div>
  );

  // Language buttons: full-width halves on mobile (their own row), capped
  // on desktop so the text field keeps the lion's share of the omnibar.
  const langBtnClass =
    "flex min-h-11 min-w-0 flex-1 items-center justify-center px-3 text-sm font-semibold transition hover:bg-bg disabled:pointer-events-none sm:w-32 sm:flex-none lg:w-40";

  // Language pair half of the omnibar — source, reverse, target. Pickers
  // stay disabled once the pair locks.
  const pairRow = (
    <div className="flex items-stretch border-b border-border sm:border-b-0 sm:border-r">
      <button onClick={() => setPickerFor("source")} disabled={pairLocked} className={langBtnClass}>
        <span className="truncate">{sourceLanguage ? sourceLanguage.nameNative : t.autoDetect}</span>
      </button>
      <button
        onClick={swapPair}
        disabled={!canSwap}
        aria-label="⇄"
        className="flex w-10 shrink-0 items-center justify-center text-hint transition hover:text-text active:scale-90 disabled:opacity-40"
      >
        <ArrowRightLeft size={16} />
      </button>
      <button onClick={() => setPickerFor("target")} disabled={pairLocked} className={langBtnClass}>
        <span className="truncate">{targetLanguage?.nameNative ?? defaultTarget}</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
    {/* Topics + chat unfold above the omnibar once there is a first turn, so
        the composer stays pinned to the bottom edge the way a chat reads. */}
    {!compactMode && (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:h-[27rem] lg:grid-cols-[2fr_3fr]`}>
      {/* Mirrors the Hero card horizontally: tinted panel first (~40%,
          same hue as the hero's art panel), functional column second — a
          scrollable list of topics instead of a device mockup. */}
      <div className="flex flex-col gap-3 bg-[hsl(32_44%_92%)] p-4 dark:bg-[hsl(32_14%_14%)] sm:p-5 lg:h-full lg:min-h-0">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-hint">{t.topics}</h2>
        {topics.length > 0 && (
          <button
            onClick={newTopic}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-sm font-medium text-button transition active:scale-[0.99]"
          >
            <Plus size={16} /> {t.newTopic}
          </button>
        )}
        <div className="flex flex-col gap-1 overflow-y-auto lg:min-h-0 lg:flex-1">
          {topics.length === 0 ? (
            <div className="py-6 text-center text-sm text-hint">{t.noTopicsYet}</div>
          ) : (
            topics.map((tp) => (
              <div key={tp.id} className="flex items-center gap-1">
                <button
                  onClick={() => switchTopic(tp.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition active:scale-[0.99] ${
                    tp.id === topic?.id ? "bg-card font-medium" : "hover:bg-card/60"
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
          )}
        </div>
      </div>

      {/* No background — clear-history bar pinned top, chat scrolls below.
          The composer is no longer in here; it lives in the omnibar. */}
      <div className="flex flex-col lg:h-full lg:min-h-0">
        {rows.length > 0 && (
          <div className="flex shrink-0 items-center justify-end border-b border-border px-4 py-2 sm:px-5">
            <button
              onClick={clearHistory}
              aria-label={t.clearHistory}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-hint transition hover:text-text active:scale-95"
            >
              <Eraser size={14} /> {t.clearHistory}
            </button>
          </div>
        )}

        {/* chat — its own scroll box on desktop (min-h-0 lets a flex child
            actually shrink instead of pushing the composer off-screen) */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:min-h-0">
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
          {pending && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-bg p-3.5 text-sm text-hint">
              <Loader2 size={15} className="animate-spin" /> {t.translating}
            </div>
          )}
        </div>
      </div>

    </div>
    )}

      {/* Omnibar: language pair, text field, mic and translate CTA on one
          row. On mobile the pair wraps onto its own row above the input —
          three clusters never fit a phone width. */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-col sm:flex-row">
          {pairRow}
          {composerRow}
        </div>
        {error && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
            <span>{error}</span>
            {error === t.errors.insufficientCredits && (
              <a href={pricingHref} className="shrink-0 font-medium underline">
                {t.pricingLink}
              </a>
            )}
          </div>
        )}
      </div>

      {quotaModal && (
        <Modal
          title={texts.account.upgrade}
          onClose={() => setQuotaModal(false)}
          closeAria={t.close}
          footer={
            <a
              href={pricingHref}
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
