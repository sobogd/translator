"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, ArrowUp, BookOpen, Loader2, Mic, Plus, Square, Trash2, X } from "lucide-react";
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

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-2 backdrop-blur-[4px]"
      onClick={onClose}
    >
      {/* One column, two rows, 8px apart; no shared background between them —
          the blur shows through the gap. */}
      <div
        className="flex w-full max-w-[420px] flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={texts.chooseLanguage}
      >
        {/* Row 1 — search field, on the same surface as the header. */}
        <div className="flex h-11 shrink-0 items-center rounded-lg bg-[var(--taskbar-bg)] px-3">
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
        </div>

        {/* Row 2 — the 400px scrollable list, one language per row, on the
            same surface as the header. */}
        <div className="h-[400px] overflow-y-auto overscroll-contain rounded-lg bg-[var(--taskbar-bg)] p-1">
          {forSource && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`flex w-full items-center px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-accent ${
                current === null ? "font-semibold text-text" : "text-text/80"
              }`}
            >
              {texts.autoDetect}
            </button>
          )}
          {list.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onSelect(l.code)}
              className={`flex w-full items-center px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-accent ${
                l.code === current ? "font-semibold text-text" : "text-text/80"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{l.nameNative}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
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
  // Pages that arrive with a concrete pair (SEO pair pages) seed the draft
  // with it and auto-open that pair's thread; everywhere else starts blank.
  const seededPair = presetSource !== undefined && presetTarget !== undefined;
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
        // Seeded pages (SEO pair pages) auto-open the topic matching their
        // starting pair — the one last used here if it still exists,
        // otherwise the most recent of that pair (the list arrives ordered by
        // lastUsedAt). Everywhere else starts blank: a topic is only created
        // once the user actually sends something in this session.
        const candidates = seededPair
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
  const TEXTAREA_MAX_H = 40;
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

  // Topics belong to a language pair. While the source side is still
  // "auto-detect" the pair isn't known yet (send → the server detects the
  // source language → it gets plugged into the selector), so the topics list
  // stays hidden until then; once the pair is known, only that pair's threads
  // are offered.
  const pairKnown = currentSourceCode !== null;
  const matchesPair = (tp: Topic): boolean =>
    currentSourceCode !== null &&
    ((tp.sourceLang === currentSourceCode && tp.targetLang === currentTargetCode) ||
      (tp.sourceLang === currentTargetCode && tp.targetLang === currentSourceCode));
  const pairTopics = pairKnown ? topics.filter(matchesPair) : [];

  // Composer half of the omnibar — text field, a mic separated by a left
  // border, and the accent translate CTA hugging the field edge.
  const showSend = status === "idle" && text.trim().length > 0;
  const micOrSend = status === "recording" ? stopRec : showSend ? translateText : startRec;

  const composerRow = (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {/* Turnstile render target. Empty (zero-height) unless Cloudflare
          decides this visitor has to interact with the challenge. */}
      <div ref={turnstileRef} className="empty:hidden" />
      {status !== "idle" ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 text-sm text-hint">
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
          className="min-h-9 flex-1 resize-none self-center border-0 bg-transparent px-2 py-1.5 text-base leading-6 outline-none"
        />
      )}
      {/* Square CTA — the accent action of the widget (record / stop /
          send), at the same size as the header CTA so the two read as one
          control. */}
      <button
        onClick={micOrSend}
        disabled={status === "processing" || (showSend && textBusy)}
        aria-label={status === "recording" ? t.stopAria : showSend ? t.translateAria : t.recordAria}
        className={`relative flex h-9 w-9 shrink-0 self-center items-center justify-center rounded-lg bg-button text-sm font-semibold text-button-text transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 ${
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

  // Topic rows only — no background fill, active = bold text. Shown in the
  // history column (full width on mobile, left column on desktop).
  const topicsList = (onPick: () => void) =>
    pairTopics.length === 0 ? (
      <div
        className="flex min-h-full w-full flex-col items-center justify-center gap-2.5 px-4 text-center text-[15px] opacity-50"
        style={{ color: "var(--hint)" }}
      >
        <BookOpen size={30} />
        <span>{t.noTopicsYet}</span>
      </div>
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
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-hint">{t.topics}</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => newTopic()}
              aria-label={t.newTopic}
              title={t.newTopic}
              className="rounded-lg p-1.5 text-hint transition hover:text-text active:scale-90"
            >
              <Plus size={15} />
            </button>
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
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
          {topicsList(() => setTopicsOpen(false))}
        </div>
      </div>

      {/* Pane 2 — the translator, three rows: languages, conversation,
          composer. */}
      <div
        className={`absolute inset-0 flex h-full w-full flex-col overflow-hidden transition-transform duration-300 ease-out sm:static sm:min-w-0 sm:flex-1 sm:translate-x-0 ${
          topicsOpen ? "translate-x-full" : "translate-x-0"
        }`}
        style={{ gap: LAYOUT_GAP }}
      >
        {/* Row 1 — language pair (source ⇄ target) + the mobile history
            toggle, on the same background as the content blocks. */}
        <div className="relative z-10 flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg bg-[var(--window-bg)] pl-1 pr-2">
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", `Topics ${topicsOpen ? "close" : "open"}`);
              setTopicsOpen((v) => !v);
            }}
            aria-label={t.topics}
            aria-expanded={topicsOpen}
            title={t.topics}
            className="flex w-10 shrink-0 items-center justify-center text-hint transition hover:bg-accent active:scale-[0.99] sm:hidden"
          >
            <BookOpen size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", "Language picker source");
              setPickerFor("source");
            }}
            title={sourceLanguageLabel}
            className="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded px-2 text-sm font-medium leading-none text-text transition-colors hover:bg-accent active:scale-[0.99]"
          >
            <span className="min-w-0 truncate">{sourceLanguageLabel}</span>
          </button>
          <span
            aria-hidden="true"
            className="flex w-8 shrink-0 items-center justify-center self-stretch text-hint"
          >
            <ArrowRightLeft size={14} />
          </span>
          <button
            type="button"
            onClick={() => {
              analytics.track("Click", "Language picker target");
              setPickerFor("target");
            }}
            title={targetLanguageLabel}
            className="flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded px-2 text-sm font-medium leading-none text-text transition-colors hover:bg-accent active:scale-[0.99]"
          >
            <span className="min-w-0 truncate">{targetLanguageLabel}</span>
          </button>
        </div>

        {/* Row 2 — the conversation of the current thread: flat window-tone
            panel with its own inner scroll. */}
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden rounded-lg bg-[var(--window-bg)]">
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
        </div>

        {/* Row 3 — composer, on the same background as the content blocks. */}
        <div className="relative z-10 flex h-10 shrink-0 items-stretch overflow-hidden rounded-lg bg-[var(--window-bg)] px-1.5">
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

      {pickerFor && (
        <LanguagePickerModal
          current={pickerFor === "source" ? currentSourceCode : currentTargetCode}
          forSource={pickerFor === "source"}
          texts={t}
          onClose={() => setPickerFor(null)}
          onSelect={pickerFor === "source" ? selectSource : (code) => code && selectTarget(code)}
        />
      )}
    </div>
  );
}
