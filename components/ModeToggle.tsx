"use client";

import { Mic, Type } from "lucide-react";

export type Mode = "text" | "audio";

export function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}) {
  const items: { id: Mode; label: string; icon: typeof Mic }[] = [
    { id: "text", label: "Текст", icon: Type },
    { id: "audio", label: "Аудио", icon: Mic },
  ];

  return (
    <div
      role="tablist"
      aria-label="Режим перевода"
      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100/80 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
