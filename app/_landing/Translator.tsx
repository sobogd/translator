"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Eraser,
  Keyboard,
  Loader2,
  Mic,
  Send,
  Square,
  X,
} from "lucide-react";
import { WavRecorder } from "@/lib/recorder";
import { History } from "@/components/History";
import { apiFetch } from "@/lib/client";
import type { ChatDetail } from "@/lib/types";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import { CARD } from "./shell";

const FROM_KEY = "translator_from_lang";
const TO_KEY = "translator_to_lang";
const DEFAULT_FROM = "en";
const DEFAULT_TO = "es";

// Tab list is a plain array on purpose — new input modes (image, document…)
// slot in here later without touching the switch below.
const TABS = [
  { id: "text" as const, label: "Text", icon: Keyboard },
  { id: "voice" as const, label: "Voice", icon: Mic },
];
type Tab = (typeof TABS)[number]["id"];

type RecStatus = "idle" | "recording" | "processing";

function friendlyError(code: string): string {
  if (code === "insufficient_credits") return "Кредиты закончились — обновите тариф";
  if (code === "text too long for your plan") return "Слишком длинный текст для вашего тарифа";
  return code;
}

function matchesQuery(l: { nameRu: string; nameNative: string }, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return l.nameRu.toLowerCase().includes(needle) || l.nameNative.toLowerCase().includes(needle);
}

function LanguagePickerModal({
  current,
  exclude,
  onClose,
  onSelect,
}: {
  current: string;
  exclude?: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const list = LANGUAGES.filter((l) => l.code !== exclude && matchesQuery(l, query));

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
          <h2 className="text-lg font-semibold">Choose a language</h2>
          <button
            onClick={onClose}
            aria-label="Close"
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
          placeholder="Search a language…"
          className="w-full rounded-xl border px-3 py-2.5 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-button/30"
          style={{ background: "var(--bg)", borderColor: "var(--border)" }}
        />
        <div className="flex-1 overflow-y-auto">
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

export function Translator() {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [pickerFor, setPickerFor] = useState<"from" | "to" | null>(null);
  const [tab, setTab] = useState<Tab>("text");

  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [text, setText] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<WavRecorder | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pending = textBusy || status === "processing";

  useEffect(() => {
    const savedFrom = localStorage.getItem(FROM_KEY);
    const savedTo = localStorage.getItem(TO_KEY);
    // one-time init from localStorage, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedFrom) setFrom(savedFrom);
    if (savedTo) setTo(savedTo);
  }, []);

  const loadChat = useCallback(async () => {
    setLoadingChat(true);
    setError(null);
    try {
      const res = await apiFetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "error");
      const detail = await apiFetch(`/api/chats/${created.id}`);
      if (detail.ok) setChat(await detail.json());
    } catch {
      setChat(null);
    } finally {
      setLoadingChat(false);
    }
  }, [from, to]);

  useEffect(() => {
    // fetches then sets state — external load, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChat();
  }, [loadChat]);

  // keep the newest turn in view without turning history into a scroll box —
  // it's page content, so the page itself scrolls.
  const turnCount = chat?.translations?.length ?? 0;
  useEffect(() => {
    if (turnCount === 0) return;
    requestAnimationFrame(() => {
      document.getElementById("app")?.scrollIntoView({ block: "nearest" });
    });
  }, [turnCount]);

  function selectFrom(code: string) {
    setFrom(code);
    localStorage.setItem(FROM_KEY, code);
    setPickerFor(null);
  }

  function selectTo(code: string) {
    setTo(code);
    localStorage.setItem(TO_KEY, code);
    setPickerFor(null);
  }

  function swap() {
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    localStorage.setItem(FROM_KEY, nextFrom);
    localStorage.setItem(TO_KEY, nextTo);
  }

  function onResult() {
    loadChat();
  }

  async function clearHistory() {
    if (!chat) return;
    if (!confirm("Clear all translations for this language pair?")) return;
    await apiFetch(`/api/chats/${chat.id}/translations`, { method: "DELETE" });
    await loadChat();
  }

  function autosize() {
    const el = taRef.current;
    if (!el) return;
    const max = Math.round((window.visualViewport?.height ?? window.innerHeight) * 0.28);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }

  async function translateText() {
    if (!chat || !text.trim() || textBusy) return;
    setError(null);
    setTextBusy(true);
    const sent = text;
    setText("");
    requestAnimationFrame(autosize);
    try {
      const res = await apiFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sent, chatId: chat.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      onResult();
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : "Error");
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
      setError("Microphone access denied");
    }
  }

  async function stopRec() {
    const rec = recRef.current;
    if (!rec || !chat) return;
    setStatus("processing");
    try {
      const blob = await rec.stop();
      recRef.current = null;
      const fd = new FormData();
      fd.append("audio", blob, "speech.wav");
      fd.append("chatId", chat.id);
      const res = await apiFetch("/api/translate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");
      onResult();
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : "Error");
    } finally {
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (status !== "recording") return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [status]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const fromLanguage = useMemo(() => getLanguage(from), [from]);
  const toLanguage = useMemo(() => getLanguage(to), [to]);
  const rows = chat ? [...chat.translations].reverse() : [];

  return (
    <div className={`${CARD} flex flex-col gap-5 bg-card p-6 sm:p-8`}>
      {/* mode tabs — more will be added here later */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              tab === id ? "border-button text-text" : "border-transparent text-hint hover:text-text"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* language pair */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPickerFor("from")}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition active:scale-95"
        >
          <span className="text-lg">{fromLanguage?.flag ?? "🌐"}</span>
          {fromLanguage?.nameNative ?? from}
        </button>
        <button
          onClick={swap}
          aria-label="Swap languages"
          className="rounded-full border border-border p-2 text-hint transition hover:text-text active:scale-95"
        >
          <ArrowLeftRight size={16} />
        </button>
        <button
          onClick={() => setPickerFor("to")}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition active:scale-95"
        >
          <span className="text-lg">{toLanguage?.flag ?? "🌐"}</span>
          {toLanguage?.nameNative ?? to}
        </button>
        {rows.length > 0 && (
          <button
            onClick={clearHistory}
            aria-label="Clear history"
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-hint transition hover:text-text active:scale-95"
          >
            <Eraser size={14} /> Clear history
          </button>
        )}
      </div>

      {/* translation history — plain page content, the page scrolls */}
      <div className="flex flex-col gap-3">
        {loadingChat ? (
          <div className="flex justify-center py-10 text-hint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-hint">
            No translations yet for this language pair.
          </div>
        ) : (
          <History rows={rows} langA={chat?.langA ?? ""} langB={chat?.langB ?? ""} />
        )}
        {pending && (
          <div className="flex items-center gap-2 rounded-xl bg-bg p-3.5 text-sm text-hint">
            <Loader2 size={15} className="animate-spin" /> Translating…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <span>{error}</span>
            {error.includes("Кредиты") && (
              <a href="/pricing" className="shrink-0 font-medium underline">
                Pricing
              </a>
            )}
          </div>
        )}
      </div>

      {/* input zone — text or voice, per the active tab */}
      <div className="border-t border-border pt-4">
        {tab === "text" ? (
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onInput={autosize}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) translateText();
              }}
              placeholder="Type a message…"
              rows={1}
              className="max-h-[28dvh] min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-base leading-relaxed outline-none"
            />
            <button
              onClick={translateText}
              disabled={!chat || !text.trim() || textBusy}
              aria-label="Translate"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-button text-button-text transition hover:opacity-90 active:scale-90 disabled:opacity-40"
            >
              {textBusy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <button
              onClick={status === "recording" ? stopRec : startRec}
              disabled={!chat || status === "processing"}
              aria-label={status === "recording" ? "Stop" : "Record"}
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition active:scale-90 disabled:opacity-40 ${
                status === "recording" ? "bg-red-500 hover:bg-red-400" : "bg-button hover:opacity-90"
              }`}
            >
              {status === "recording" && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
              )}
              {status === "processing" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : status === "recording" ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <Mic size={22} />
              )}
            </button>
            <span className="text-sm text-hint">
              {status === "recording"
                ? `Recording · ${fmtTime(elapsed)}`
                : status === "processing"
                  ? "Recognizing…"
                  : "Tap to speak"}
            </span>
          </div>
        )}
      </div>

      {pickerFor && (
        <LanguagePickerModal
          current={pickerFor === "from" ? from : to}
          exclude={pickerFor === "from" ? to : from}
          onClose={() => setPickerFor(null)}
          onSelect={pickerFor === "from" ? selectFrom : selectTo}
        />
      )}
    </div>
  );
}
