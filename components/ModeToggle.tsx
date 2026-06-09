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
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
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
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 disabled:opacity-50 ${
              active ? "bg-emerald-600 text-white shadow" : ""
            }`}
            style={active ? undefined : { color: "var(--hint)" }}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
