"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/client";
import type { Chat } from "@/lib/types";
import { LANGUAGES, getLanguage } from "@/lib/languages";

const FROM_LANG_KEY = "translator_from_lang";
const DEFAULT_FROM_LANG = "ru";

type BillingMe = {
  plan: string;
  planName: string;
  creditsBalance: number;
  hasSubscription: boolean;
};

type LangRow = {
  code: string;
  nameRu: string;
  nameNative: string;
  flag: string;
  lastUsedAt?: string;
  translationCount?: number;
};

function matchesQuery(l: { nameRu: string; nameNative: string }, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    l.nameRu.toLowerCase().includes(needle) || l.nameNative.toLowerCase().includes(needle)
  );
}

// Lightweight searchable language list, reused both for the "from" picker
// and (inline, below) for the main destination list.
function LanguagePickerModal({
  current,
  onClose,
  onSelect,
}: {
  current: string;
  onClose: () => void;
  onSelect: (code: string) => void;
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
          <h2 className="text-lg font-semibold">Мой язык</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
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
          placeholder="Поиск языка…"
          className="w-full rounded-xl border px-3 py-2.5 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30"
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
              <span className="min-w-0 flex-1 truncate">{l.nameRu}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [fromLang, setFromLang] = useState(DEFAULT_FROM_LANG);
  const [query, setQuery] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingMe | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chats");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (res.ok) setChats(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(FROM_LANG_KEY);
    // one-time init from localStorage/network (external), not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setFromLang(saved);
    load();
    apiFetch("/api/billing/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setBilling(data))
      .catch(() => {});
  }, [load]);

  async function openBillingPortal() {
    const res = await apiFetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  function selectFromLang(code: string) {
    setFromLang(code);
    localStorage.setItem(FROM_LANG_KEY, code);
    setShowPicker(false);
  }

  const rows = useMemo<LangRow[]>(() => {
    const used = new Map<string, LangRow>();
    for (const c of chats) {
      if (c.langA !== fromLang && c.langB !== fromLang) continue;
      const otherCode = c.langA === fromLang ? c.langB : c.langA;
      const lang = getLanguage(otherCode);
      if (!lang) continue;
      used.set(otherCode, {
        code: otherCode,
        nameRu: lang.nameRu,
        nameNative: lang.nameNative,
        flag: lang.flag,
        lastUsedAt: c.lastUsedAt,
        translationCount: c.translationCount,
      });
    }
    const recent = [...used.values()].sort(
      (a, b) => new Date(b.lastUsedAt ?? 0).getTime() - new Date(a.lastUsedAt ?? 0).getTime(),
    );
    const rest = LANGUAGES.filter((l) => l.code !== fromLang && !used.has(l.code))
      .map((l) => ({ code: l.code, nameRu: l.nameRu, nameNative: l.nameNative, flag: l.flag }))
      .sort((a, b) => a.nameRu.localeCompare(b.nameRu, "ru"));
    return [...recent, ...rest];
  }, [chats, fromLang]);

  const filteredRows = rows.filter((r) => matchesQuery(r, query));

  async function openChat(toCode: string) {
    if (creating) return;
    setCreating(toCode);
    try {
      const res = await apiFetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromLang, to: toCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      router.push(`/app/t/${data.id}`);
    } catch {
      setCreating(null);
    }
  }

  if (forbidden) {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <p className="text-base font-medium">Доступ отозван</p>
      </main>
    );
  }

  const fromLanguage = getLanguage(fromLang);

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center px-4 py-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <header className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-bold tracking-tight">Переводчик</h1>
          <div className="flex items-center gap-3">
            {billing && (
              <button
                onClick={billing.hasSubscription ? openBillingPortal : undefined}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95"
                style={{ borderColor: "var(--border)", color: "var(--hint)" }}
                title={billing.hasSubscription ? "Manage billing" : undefined}
              >
                {billing.planName} · {billing.creditsBalance} кредитов
              </button>
            )}
            {!billing?.hasSubscription && (
              <a
                href="/pricing"
                className="text-sm transition active:scale-95"
                style={{ color: "var(--hint)" }}
              >
                Тарифы
              </a>
            )}
            <button
              onClick={async () => {
                await apiFetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
              className="text-sm transition active:scale-95"
              style={{ color: "var(--hint)" }}
            >
              Выйти
            </button>
          </div>
        </header>

        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <span className="text-lg">{fromLanguage?.flag ?? "🌐"}</span>
          {fromLanguage?.nameRu ?? fromLang}
        </button>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--hint)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск языка…"
            className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16" style={{ color: "var(--hint)" }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 py-16 text-center"
            style={{ color: "var(--hint)" }}
          >
            <p className="text-sm">Ничего не найдено.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredRows.map((r) => (
              <div
                key={r.code}
                onClick={() => openChat(r.code)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition active:scale-[0.99]"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <span className="text-2xl">{r.flag}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.nameRu}</div>
                  {!!r.translationCount && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--hint)" }}>
                      {r.translationCount} переводов
                    </p>
                  )}
                </div>
                {creating === r.code && (
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--hint)" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showPicker && (
        <LanguagePickerModal
          current={fromLang}
          onClose={() => setShowPicker(false)}
          onSelect={selectFromLang}
        />
      )}
    </main>
  );
}
