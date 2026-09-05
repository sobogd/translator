"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, BookOpen, ChevronDown, Loader2, Mic, Plus, Square, Trash2, X } from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { History } from "@/components/History";
import { apiFetch } from "@/lib/client";
import type { Topic, TopicDetail } from "@/lib/types";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { Modal } from "./Modal";
import { LAYOUT_GAP } from "./desktop/layout";
import { QUOTA_EVENT, useSession } from "./session";
import { PAIR_COOKIE, formatPairCookie, parsePairCookie, readCookieValue } from "@/lib/cookies";
import { analytics } from "@/lib/analytics";
import { useTurnstileGate } from "./Turnstile";
import type { TranslatorTexts } from "./types";

// Pre-cookie storage of the target half. Only read now, as a one-time
// migration for visitors who picked a language before PAIR_COOKIE existed.
const TO_KEY = "translator_to_lang";
// How long a remembered pair lives (see PAIR_COOKIE) — same ceiling as the
// session/locale cookies.
const PAIR_MAX_AGE = 400 * 86400;
const rememberPair = (source: string | null, target: string) => {
  document.cookie = `${PAIR_COOKIE}=${formatPairCookie(source, target)}; path=/; max-age=${PAIR_MAX_AGE}; samesite=lax`;
};
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
 *  with it, so clamp here.
 *
 *  A message with nothing ASCII in it (a browser's own localised network
 *  error, say) used to survive as a row of underscores — every such failure
 *  then looked identical in the analytics and said nothing about its cause.
 *  Those are reported as "unknown" instead. */
function trackError(code: string): string {
  const slug = code.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40);
  return /[A-Za-z0-9]/.test(slug) ? slug : "unknown";
}

// Server routes answer with opaque codes: printing an unrecognised one used to
// mean printing whatever the server threw (Prisma messages included), and the
// one hardcoded Russian string reached every locale untranslated.
function friendlyError(code: string, texts: WidgetTexts): string {
  const e = texts.errors;
  if (code === "insufficient_credits") return e.insufficientCredits;
  if (code === "text_too_long" || code === "audio_too_long") return e.textTooLong;
  if (code === "turnstile_required" || code === "turnstile_failed") return e.turnstileFailed;
  if (code === "not_recognized" || code === "bad_audio") return e.notRecognized;
  if (code === "rate_limited") return e.rateLimited;
  return e.generic;
}

function matchesQuery(l: { nameRu: string; nameNative: string }, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return l.nameRu.toLowerCase().includes(needle) || l.nameNative.toLowerCase().includes(needle);
}

// Language picker: a full-screen blurred modal.
// Everything behind is blurred (no dimming). Centred is one column of two
// rows, 8px apart: the search field on top and a 400px-tall scrollable list
// of languages below — both on the same background as the content panels.
// There is no header/close button; a click on the blurred background closes.
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
  // The currently active language always jumps to the first row (whether the
  // picker opened for source or target).
  const ordered = useMemo(() => {
    const cur = current;
    if (!cur) return list;
    const idx = list.findIndex((l) => l.code === cur);
    if (idx <= 0) return list;
    const copy = list.slice();
    copy.unshift(copy.splice(idx, 1)[0]);
    return copy;
  }, [list, current]);

  // Rendered IN PLACE of the conversation panel, with the same height: a
  // search block on top and a scrollable list below — no modal, no backdrop,
  // no blur, nothing else. Picking a language returns to the chat.
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* Search block — same height (h-14) and surface as the message input,
          with a bare close icon on the right (no border/background). */}
      <div className="flex h-12 shrink-0 items-center gap-1 rounded-lg bg-[var(--window-bg)] px-3">
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          name="language-search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore
          data-bwignore
          data-form-type="other"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder={texts.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-base leading-6 outline-none placeholder:text-hint"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={texts.close}
          title={texts.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-hint transition-colors hover:text-text active:scale-90"
        >
          <X size={16} />
        </button>
      </div>

      {/* Language list — fills the remaining height of the panel */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg bg-[var(--window-bg)] p-1">
        {forSource && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
              current === null ? "font-semibold text-text" : "text-text/80"
            }`}
          >
            {texts.autoDetect}
          </button>
        )}
        {ordered.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => onSelect(l.code)}
            className={`flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
              l.code === current ? "font-semibold text-text" : "text-text/80"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{l.nameNative}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Translator({
  texts,
  presetSource,
  presetTarget,
  initialTarget,
  initialSource = null,
  pricingHref = "/pricing",
}: {
  texts: TranslatorTexts;
  /** Seed source language for the draft pair (pair pages pass the page's
   *  own pair). Only an initial value — the pair is always switchable. */
  presetSource?: string;
  /** Seed target language (pair pages); wins over localStorage on mount. */
  presetTarget?: string;
  /** Soft default target (locale homes/pricing/legal): initial value only. */
  initialTarget?: string;
  /** Source half of the pair resolved server-side for pages that need it
   *  (null = auto-detect). */
  initialSource?: string | null;
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
  const [draftSourceLang, setDraftSourceLang] = useState<string | null>(presetSource ?? initialSource);
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
    // A seeded pair (SEO pair pages) wins over the remembered pair — reading
    // it again here would only overwrite the same values after hydration.
    if (presetTarget) return;
    const stored = parsePairCookie(readCookieValue(PAIR_COOKIE));
    // one-time init from storage, not a render cascade.
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDefaultTarget(stored.target);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftSourceLang(stored.source);
      return;
    }
    const saved = localStorage.getItem(TO_KEY);
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

  // Drops a topic that was created for a send that then failed — without this
  // every failed first attempt left an empty thread behind in the list (see
  // the discardIfCreated calls in translateText/stopRec).
  const discardTopic = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
      } catch {
        /* the thread stays in the list; not worth a second error on screen */
      }
      setTopic(null);
      setTopics((prev) => prev.filter((tp) => tp.id !== id));
    },
    [],
  );

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
        // History is global across all pairs. Restore the last thread the
        // visitor had open if it still exists, otherwise start with a blank
        // draft (a thread is only created once something is actually sent).
        let remembered: string | null = null;
        try {
          remembered = localStorage.getItem(LAST_TOPIC_KEY);
        } catch {
          /* private mode */
        }
        const match = remembered ? (list.find((tp) => tp.id === remembered) ?? null) : null;
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
  const chatMounted = !pickerFor;
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [turnCount, topic?.id, chatMounted]);

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
      // History is global: the next thread in the list takes over.
      const next = remaining[0];
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
    const next = code !== null && code === defaultTarget ? null : code;
    rememberPair(next, defaultTarget);
    setDraftSourceLang(next);
  }

  function selectTarget(code: string) {
    analytics.track("Click", `Language target ${code}`);
    setPickerFor(null);
    setDefaultTarget(code);
    setTopic(null);
    // A source colliding with the new target falls back to auto-detect — the
    // remembered pair has to follow.
    rememberPair(draftSourceLang === code ? null : draftSourceLang, code);
    setDraftSourceLang((prev) => (prev === code ? null : prev));
  }

  // Caps at 3 lines: leading-6 (24px) × 3 + the textarea's own py-2.5 (20px).
  // One line is 44px — the resting height of the field — and the island adds
  // its p-1.5 and border on top of that. Anything longer grows the island.
  const TEXTAREA_MAX_H = 96;
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
    // Set only when this send is what created the thread — a failure then has
    // to take it back out again, or the list fills up with empty threads.
    let createdId: string | null = null;
    try {
      // First send with no topic yet: create one now, carrying over
      // whatever source/target were picked in draft state.
      if (!(await ensurePass())) throw new Error("turnstile_failed");
      if (!topic) createdId = await createTopic(defaultTarget, draftSourceLang);
      const topicId = topic?.id ?? (createdId as string);
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
      if (createdId) await discardTopic(createdId);
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
    let createdId: string | null = null;
    try {
      const blob = await rec.stop();
      recRef.current = null;
      if (!(await ensurePass())) throw new Error("turnstile_failed");
      if (!topic) createdId = await createTopic(defaultTarget, draftSourceLang);
      const topicId = topic?.id ?? (createdId as string);
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
      // Nothing was transcribed, so the thread this send just opened is empty.
      if (createdId) await discardTopic(createdId);
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
  const currentTargetCode = topic?.targetLang ?? defaultTarget;
  const rows = topic ? [...topic.translations].reverse() : [];

  // History is global across all language pairs: every thread is listed
  // together (newest first, as the server returns them), with its pair and
  // last-used date shown per row.
  const langName = (code: string | null) => (code ? (getLanguage(code)?.nameNative ?? code) : t.autoDetect);
  const topicMeta = (tp: Topic) => `${langName(tp.sourceLang)} → ${langName(tp.targetLang)}`;
  const formatTopicDate = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
        day: "numeric",
        month: "short",
      }).format(new Date(iso));
    } catch {
      return "";
    }
  };

  // Composer half of the omnibar — text field, a mic separated by a left
  // border, and the accent translate CTA hugging the field edge.
  const showSend = status === "idle" && text.trim().length > 0;
  const micOrSend = status === "recording" ? stopRec : showSend ? translateText : startRec;

  const composerRow = (
    <div className="flex min-w-0 w-full items-center gap-2">
      {/* Turnstile render target. Empty (zero-height) unless Cloudflare
          decides this visitor has to interact with the challenge. */}
      <div ref={turnstileRef} className="empty:hidden" />
      {status !== "idle" ? (
        <div className="flex min-w-0 flex-1 items-center self-center gap-3 px-2 text-sm text-hint">
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
          style={{ height: 40, maxHeight: TEXTAREA_MAX_H }}
          className="min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base leading-6 outline-none"
        />
      )}
      {/* Square CTA — stays a fixed square (never stretches with the field);
          the input grows on its own. */}
      <button
        onClick={micOrSend}
        disabled={status === "processing" || (showSend && textBusy)}
        aria-label={status === "recording" ? t.stopAria : showSend ? t.translateAria : t.recordAria}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-button font-semibold text-button-text transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 ${
          status === "recording" ? "animate-pulse-ring" : ""
        }`}
      >
        {status === "processing" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : status === "recording" ? (
          <Square className="h-4 w-4" fill="currentColor" />
        ) : showSend ? (
          textBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
    </div>
  );

  const sourceLanguageLabel = currentSourceCode
    ? (getLanguage(currentSourceCode)?.nameNative ?? currentSourceCode)
    : t.autoDetect;
  const targetLanguageLabel = targetLanguage?.nameNative ?? defaultTarget;

  // Topic rows — the shared history across every pair. Each row shows the
  // thread title, the pair it belongs to and the last-activity date.
  const topicsList = (onPick: () => void) =>
    topics.length === 0 ? (
      <div
        className="flex min-h-full w-full flex-col items-center justify-center gap-2.5 px-4 text-center text-[15px] opacity-50"
        style={{ color: "var(--hint)" }}
      >
        <BookOpen size={30} />
        <span>{t.noTopicsYet}</span>
      </div>
    ) : (
      topics.map((tp) => {
        const date = formatTopicDate(tp.lastUsedAt || tp.createdAt);
        return (
          <div key={tp.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                switchTopic(tp.id);
                onPick();
              }}
              className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-2 text-left transition active:scale-[0.99] ${
                tp.id === topic?.id ? "text-text" : "text-hint hover:text-text"
              }`}
            >
              <span className={`w-full truncate text-sm ${tp.id === topic?.id ? "font-medium" : ""}`}>
                {tp.title || t.newTopic}
              </span>
              <span className="flex w-full items-center gap-1.5 text-xs text-hint">
                <span className="min-w-0 truncate">{topicMeta(tp)}</span>
                {date && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{date}</span>
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => deleteTopic(tp.id)}
              aria-label={t.deleteTopic}
              className="shrink-0 rounded-lg p-1.5 text-hint transition hover:text-red-500 active:scale-90"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })
    );

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden sm:flex sm:flex-row sm:gap-2">
      {/* Two-pane layout: [history] [translator].
          Mobile — the panes are two full-width screens stacked over each
          other: the translator is active by default, the history sits fully
          off-screen to the left. Opening the history slides the panes (each
          is 100% of the widget width), so the translator moves off-screen to
          the right and the history takes its place — no half-width panes.
          Desktop — no sliding: history column on the left (40%), the
          translator on the right (flex). */}
      {/* Pane 1 — history of saved threads. Always present as its own panel;
          shows the placeholder when there are no threads yet. */}
      <div
        className={`absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-lg bg-[var(--window-bg)] transition-transform duration-300 ease-out sm:static sm:w-[40%] sm:shrink-0 sm:translate-x-0 ${
          topicsOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* No history label — just the mobile back control on top. */}
        <div className="flex shrink-0 items-center justify-end px-2 pt-1">
          <button
            type="button"
            onClick={() => setTopicsOpen(false)}
            aria-label={t.close}
            title={t.close}
            className="rounded-lg p-1.5 text-hint transition hover:text-text active:scale-90 sm:hidden"
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {topicsList(() => setTopicsOpen(false))}
        </div>
        {/* "New topic" sits under the list and only appears once history has
            at least one thread. */}
        {topics.length > 0 && (
          <div className="flex shrink-0 items-center px-1 pb-2">
            <button
              type="button"
              onClick={() => newTopic()}
              aria-label={t.newTopic}
              title={t.newTopic}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-hint transition hover:text-text active:scale-90"
            >
              <Plus size={15} />
              <span>{t.newTopic}</span>
            </button>
          </div>
        )}
      </div>

      {/* Pane 2 — the translator, three rows: languages, conversation,
          composer. */}
      <div
        className={`absolute inset-0 flex h-full w-full flex-col overflow-hidden transition-transform duration-300 ease-out sm:static sm:min-w-0 sm:flex-1 sm:translate-x-0 ${
          topicsOpen ? "translate-x-full" : "translate-x-0"
        }`}
        style={{ gap: LAYOUT_GAP }}
      >
        {/* Row 1 — the two languages as separate blocks side by side (no
            swap icon), each with a header-style chevron on the right of the
            label hinting at the dropdown. The mobile history toggle keeps
            its own small block on the left. */}
        <div className="relative z-10 flex h-12 shrink-0 items-stretch gap-2">
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", `Topics ${topicsOpen ? "close" : "open"}`);
              setTopicsOpen((v) => !v);
            }}
            aria-label={t.topics}
            aria-expanded={topicsOpen}
            title={t.topics}
            className="flex w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--window-bg)] text-hint transition hover:bg-accent active:scale-[0.99] sm:hidden"
          >
            <BookOpen size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", `Language picker source ${pickerFor === "source" ? "close" : "open"}`);
              setPickerFor((cur) => (cur === "source" ? null : "source"));
            }}
            title={sourceLanguageLabel}
            className="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-[var(--window-bg)] px-2 text-sm font-medium leading-normal text-text transition-colors hover:bg-accent active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center justify-center gap-1">
              <span className="min-w-0 truncate">{sourceLanguageLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                  pickerFor === "source" ? "rotate-180 opacity-100" : "opacity-70"
                }`}
                aria-hidden="true"
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", `Language picker target ${pickerFor === "target" ? "close" : "open"}`);
              setPickerFor((cur) => (cur === "target" ? null : "target"));
            }}
            title={targetLanguageLabel}
            className="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-[var(--window-bg)] px-2 text-sm font-medium leading-normal text-text transition-colors hover:bg-accent active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center justify-center gap-1">
              <span className="min-w-0 truncate">{targetLanguageLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                  pickerFor === "target" ? "rotate-180 opacity-100" : "opacity-70"
                }`}
                aria-hidden="true"
              />
            </span>
          </button>
        </div>

        {/* Row 2 — the conversation of the current thread. While a language
            is being picked, the picker panel replaces this block in place,
            with the same height. */}
        {/* Row 2 — the conversation, or the language picker in its place.
            While the picker is open the wrapper has no background of its own:
            only the picker's search/list blocks paint, so the gap between
            them stays background-free. */}
        <div
          className={
            pickerFor
              ? "relative z-0 min-h-0 flex-1"
              : "relative z-0 min-h-0 flex-1 overflow-hidden rounded-lg bg-[var(--window-bg)]"
          }
        >
          {pickerFor ? (
            <LanguagePickerModal
              current={pickerFor === "source" ? currentSourceCode : currentTargetCode}
              forSource={pickerFor === "source"}
              texts={t}
              onClose={() => setPickerFor(null)}
              onSelect={pickerFor === "source" ? selectSource : (code) => code && selectTarget(code)}
            />
          ) : (
            <div ref={chatScrollRef} className="h-full overflow-y-auto px-3 py-3 sm:px-4">
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
          )}
        </div>

        {/* Row 3 — composer: resting height h-14 with the text vertically
            centred; it grows once the input needs more lines. The action
            button stays a fixed square, always centred. */}
        <div className="relative z-10 flex min-h-14 shrink-0 flex-col justify-center rounded-lg bg-[var(--window-bg)] px-2">
          {composerRow}
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
              className="inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-button px-4 text-sm font-semibold text-button-text transition-all hover:opacity-90 active:scale-[0.99]"
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
              className="inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-button px-4 text-sm font-semibold text-button-text transition-all hover:opacity-90 active:scale-[0.99]"
            >
              {t.pricingLink}
            </a>
          }
        >
          <div className="px-5 py-4 text-sm text-hint">{t.errors.insufficientCredits}</div>
        </Modal>
      )}


    </div>
  );
}
