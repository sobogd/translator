"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eraser,
  Loader2,
  MessagesSquare,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { History } from "@/components/History";
import { apiFetch } from "@/lib/client";
import type { Topic, TopicDetail } from "@/lib/types";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { CARD } from "./shell";
import type { TranslatorTexts } from "./types";

const TO_KEY = "translator_to_lang";
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-t-3xl border p-4 shadow-xl sm:rounded-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{texts.chooseLanguage}</h2>
          <button
            onClick={onClose}
            aria-label={texts.close}
            className="rounded-lg p-1.5 transition active:scale-90"
            style={{ color: "var(--hint)" }}
          >
            <X size={18} />
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder={texts.searchPlaceholder}
          className="w-full rounded-xl border px-3 py-2.5 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-button/30"
          style={{ background: "var(--bg)", borderColor: "var(--border)" }}
        />
        <div className="flex-1 overflow-y-auto">
          {forSource && (
            <button
              onClick={() => onSelect(null)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99]"
              style={current === null ? { background: "var(--bg)" } : undefined}
            >
              <span className="text-xl">🌐</span>
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
              <span className="text-xl">{l.flag}</span>
              <span className="min-w-0 flex-1 truncate">{l.nameNative}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopicPickerModal({
  topics,
  activeId,
  texts,
  onClose,
  onSelect,
  onCreate,
  onDelete,
}: {
  topics: Topic[];
  activeId: string | null;
  texts: WidgetTexts;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-3 overflow-hidden rounded-t-3xl border p-4 shadow-xl sm:rounded-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{texts.topics}</h2>
          <button
            onClick={onClose}
            aria-label={texts.close}
            className="rounded-lg p-1.5 transition active:scale-90"
            style={{ color: "var(--hint)" }}
          >
            <X size={18} />
          </button>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-button transition active:scale-[0.99]"
        >
          <Plus size={16} /> {texts.newTopic}
        </button>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {topics.length === 0 && (
            <div className="py-8 text-center text-sm text-hint">{texts.noTopicsYet}</div>
          )}
          {topics.map((tp) => (
            <div key={tp.id} className="flex items-center gap-1">
              <button
                onClick={() => onSelect(tp.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99]"
                style={tp.id === activeId ? { background: "var(--bg)" } : undefined}
              >
                <span className="min-w-0 flex-1 truncate">{tp.title || texts.newTopic}</span>
              </button>
              <button
                onClick={() => onDelete(tp.id)}
                aria-label={texts.deleteTopic}
                className="shrink-0 rounded-lg p-1.5 text-hint transition hover:text-red-500 active:scale-90"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Translator({ texts }: { texts: TranslatorTexts }) {
  const t = texts.translator;
  const [defaultTarget, setDefaultTarget] = useState(DEFAULT_TO);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(true);
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<"source" | "target" | null>(null);
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<WavRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pending = textBusy || status === "processing";

  useEffect(() => {
    const saved = localStorage.getItem(TO_KEY);
    // one-time init from localStorage, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDefaultTarget(saved);
  }, []);

  const loadTopics = useCallback(async () => {
    const res = await apiFetch("/api/topics");
    if (res.ok) setTopics(await res.json());
  }, []);

  const loadTopic = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/topics/${id}`);
    if (res.ok) setTopic(await res.json());
  }, []);

  const createTopic = useCallback(
    async (targetLang: string) => {
      const res = await apiFetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "error");
      await loadTopics();
      await loadTopic(created.id);
    },
    [loadTopics, loadTopic],
  );

  // bootstrap once: open the most recently used topic, or start a fresh one.
  useEffect(() => {
    (async () => {
      setLoadingTopic(true);
      try {
        const res = await apiFetch("/api/topics");
        const list: Topic[] = res.ok ? await res.json() : [];
        setTopics(list);
        if (list.length > 0) {
          await loadTopic(list[0].id);
        } else {
          await createTopic(localStorage.getItem(TO_KEY) || DEFAULT_TO);
        }
      } catch {
        setTopic(null);
      } finally {
        setLoadingTopic(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the newest turn in view without turning history into a scroll box —
  // it's page content, so the page itself scrolls.
  const turnCount = topic?.translations?.length ?? 0;
  useEffect(() => {
    if (turnCount === 0) return;
    requestAnimationFrame(() => {
      document.getElementById("app")?.scrollIntoView({ block: "nearest" });
    });
  }, [turnCount]);

  async function switchTopic(id: string) {
    setTopicPickerOpen(false);
    setText("");
    setError(null);
    setLoadingTopic(true);
    await loadTopic(id);
    setLoadingTopic(false);
  }

  async function newTopic() {
    setTopicPickerOpen(false);
    setText("");
    setError(null);
    setLoadingTopic(true);
    try {
      await createTopic(defaultTarget);
    } finally {
      setLoadingTopic(false);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm(t.deleteTopicConfirm)) return;
    await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
    const remaining = topics.filter((tp) => tp.id !== id);
    setTopics(remaining);
    if (id === topic?.id) {
      setLoadingTopic(true);
      try {
        if (remaining.length > 0) await loadTopic(remaining[0].id);
        else await createTopic(defaultTarget);
      } finally {
        setLoadingTopic(false);
      }
    }
  }

  // Both pickers list every language, including the one already selected on
  // the other side — a same-language pair is resolved by falling back the
  // source to auto-detect (target always stays a concrete language; only
  // the source can mean "figure it out from the text").
  async function selectSource(code: string | null) {
    setPickerFor(null);
    if (!topic) return;
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
    if (!topic) return;
    const nextSource = topic.sourceLang === code ? null : topic.sourceLang;
    setTopic({ ...topic, sourceLang: nextSource, targetLang: code });
    await apiFetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang: nextSource, targetLang: code }),
    });
  }

  function onResult() {
    if (topic) loadTopic(topic.id);
    loadTopics();
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
    const max = Math.round((window.visualViewport?.height ?? window.innerHeight) * 0.28);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }

  async function translateText() {
    if (!topic || !text.trim() || textBusy) return;
    setError(null);
    setTextBusy(true);
    const sent = text;
    setText("");
    requestAnimationFrame(autosize);
    try {
      const res = await apiFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sent, topicId: topic.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      onResult();
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message, t) : "Error");
      setText(sent);
    } finally {
      setTextBusy(false);
    }
  }

  async function startRec() {
    setError(null);
    try {
      const rec = new WavRecorder();
      await rec.start();
      recRef.current = rec;
      setStatus("recording");
    } catch {
      setError(t.micDeniedError);
    }
  }

  async function stopRec() {
    const rec = recRef.current;
    if (!rec) return;
    setStatus("processing");
    try {
      const blob = await rec.stop();
      recRef.current = null;
      const fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      if (topic) fd.append("topicId", topic.id);
      const res = await apiFetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      setText((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
      requestAnimationFrame(autosize);
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message, t) : "Error");
    } finally {
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => {
      clearInterval(tick);
      setElapsed(0);
    };
  }, [status]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const sourceLanguage = useMemo(() => (topic?.sourceLang ? getLanguage(topic.sourceLang) : undefined), [topic?.sourceLang]);
  const targetLanguage = useMemo(() => getLanguage(topic?.targetLang ?? defaultTarget), [topic?.targetLang, defaultTarget]);
  const rows = topic ? [...topic.translations].reverse() : [];

  return (
    <div className={`${CARD} flex flex-col gap-5 p-6 sm:p-8`}>
      {/* topic bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTopicPickerOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition active:scale-95"
        >
          <MessagesSquare size={15} className="shrink-0 text-hint" />
          <span className="max-w-[12rem] truncate">{topic?.title || t.newTopic}</span>
        </button>
        {rows.length > 0 && (
          <button
            onClick={clearHistory}
            aria-label={t.clearHistory}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-hint transition hover:text-text active:scale-95"
          >
            <Eraser size={14} /> {t.clearHistory}
          </button>
        )}
      </div>

      {/* translation history — plain page content, the page scrolls */}
      <div className="flex flex-col gap-3">
        {loadingTopic ? (
          <div className="flex justify-center py-10 text-hint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-hint">
            {t.noTranslationsYet}
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
          <div className="flex items-center gap-2 rounded-xl bg-bg p-3.5 text-sm text-hint">
            <Loader2 size={15} className="animate-spin" /> {t.translating}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <span>{error}</span>
            {error === t.errors.insufficientCredits && (
              <a href="/pricing" className="shrink-0 font-medium underline">
                {t.pricingLink}
              </a>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <button
          onClick={() => setPickerFor("source")}
          className="flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-hint transition active:scale-95"
        >
          {sourceLanguage ? (
            <>
              <span className="text-sm">{sourceLanguage.flag}</span>
              {sourceLanguage.nameNative}
            </>
          ) : (
            <>
              <span className="text-sm">🌐</span>
              {t.autoDetect}
            </>
          )}
        </button>

        <div className="flex flex-wrap items-end gap-2">
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
            className="max-h-[28dvh] min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base leading-relaxed outline-none"
          />
          <button
            onClick={status === "recording" ? stopRec : startRec}
            disabled={status === "processing"}
            aria-label={status === "recording" ? t.stopAria : t.recordAria}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40 ${
              status === "recording" ? "bg-red-500 text-white hover:bg-red-400" : "text-hint hover:text-text"
            }`}
          >
            {status === "recording" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
            )}
            {status === "processing" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : status === "recording" ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Mic size={18} />
            )}
          </button>
          <button
            onClick={() => setPickerFor("target")}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition active:scale-95"
          >
            <span className="text-lg">{targetLanguage?.flag ?? "🌐"}</span>
            {targetLanguage?.nameNative ?? defaultTarget}
          </button>
          <button
            onClick={translateText}
            disabled={!topic || !text.trim() || textBusy}
            aria-label={t.translateAria}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-button text-button-text transition hover:opacity-90 active:scale-90 disabled:opacity-40"
          >
            {textBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        {status === "recording" && (
          <span className="text-xs text-hint">{t.recording} · {fmtTime(elapsed)}</span>
        )}
        {status === "processing" && <span className="text-xs text-hint">{t.recognizing}</span>}
      </div>

      {pickerFor && (
        <LanguagePickerModal
          current={pickerFor === "source" ? (topic?.sourceLang ?? null) : (topic?.targetLang ?? defaultTarget)}
          forSource={pickerFor === "source"}
          texts={t}
          onClose={() => setPickerFor(null)}
          onSelect={pickerFor === "source" ? selectSource : (code) => code && selectTarget(code)}
        />
      )}

      {topicPickerOpen && (
        <TopicPickerModal
          topics={topics}
          activeId={topic?.id ?? null}
          texts={t}
          onClose={() => setTopicPickerOpen(false)}
          onSelect={switchTopic}
          onCreate={newTopic}
          onDelete={deleteTopic}
        />
      )}
    </div>
  );
}
