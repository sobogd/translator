"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { NewThreadModal } from "@/components/NewThreadModal";
import { apiFetch, initTelegram, haptic } from "@/lib/client";
import type { Thread, ThreadWithCount } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/threads");
      if (res.ok) setThreads(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initTelegram();
    // setThreads runs only after the awaited fetch — not a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function onCreated(t: Thread) {
    router.push(`/t/${t.id}`);
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить этот тред со всей историей?")) return;
    haptic();
    await apiFetch(`/api/threads/${id}`, { method: "DELETE" });
    setThreads((ts) => ts.filter((t) => t.id !== id));
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center px-4 py-6"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-bold tracking-tight">
            RU <span className="text-emerald-500">⇄</span> ES
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-95"
          >
            <Plus size={16} /> Новый
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-16" style={{ color: "var(--hint)" }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 py-16 text-center"
            style={{ color: "var(--hint)" }}
          >
            <MessageSquare size={26} />
            <p className="text-sm">
              Пока нет тредов. Создай первый — задай тему, и ИИ будет в курсе
              контекста разговора.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {threads.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/t/${t.id}`)}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition active:scale-[0.99]"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={15} className="shrink-0 text-emerald-500" />
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  {t.context && (
                    <p
                      className="mt-1 line-clamp-2 text-sm"
                      style={{ color: "var(--hint)" }}
                    >
                      {t.context}
                    </p>
                  )}
                  <p className="mt-1 text-xs" style={{ color: "var(--hint)" }}>
                    {t._count.translations} переводов
                  </p>
                </div>
                <button
                  onClick={(e) => remove(t.id, e)}
                  aria-label="Удалить тред"
                  className="shrink-0 rounded-lg p-2 text-red-500 transition active:scale-90"
                  style={{ background: "color-mix(in srgb, red 8%, transparent)" }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewThreadModal onClose={() => setShowModal(false)} onCreated={onCreated} />
      )}
    </main>
  );
}
