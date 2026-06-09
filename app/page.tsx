"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { NewThreadModal } from "@/components/NewThreadModal";
import { apiFetch, initTelegram } from "@/lib/client";
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
    await apiFetch(`/api/threads/${id}`, { method: "DELETE" });
    setThreads((ts) => ts.filter((t) => t.id !== id));
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 py-10 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            RU <span className="text-emerald-500">⇄</span> ES
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-emerald-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Plus size={16} /> Новый перевод
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-16 text-zinc-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-zinc-400">
            <MessageSquare size={26} />
            <p className="text-sm">
              Пока нет тредов. Создай первый — задай тему, и ИИ будет в курсе
              контекста разговора.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/t/${t.id}`)}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={15} className="shrink-0 text-emerald-500" />
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  {t.context && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {t.context}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    {t._count.translations} переводов
                  </p>
                </div>
                <span
                  onClick={(e) => remove(t.id, e)}
                  role="button"
                  aria-label="Удалить тред"
                  className="shrink-0 rounded-lg p-2 text-zinc-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} />
                </span>
              </button>
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
