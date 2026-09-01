"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Eraser, Trash2 } from "lucide-react";

export function ThreadMenu({
  onClear,
  onDelete,
}: {
  onClear: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const items = [
    { label: "Очистить историю", icon: Eraser, fn: onClear, danger: false },
    { label: "Удалить чат", icon: Trash2, fn: onDelete, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Меню"
        className="rounded-lg p-1.5 transition active:scale-90"
        style={{ color: "var(--hint)" }}
      >
        <MoreVertical size={20} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border shadow-xl"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {items.map(({ label, icon: Icon, fn, danger }) => (
            <button
              key={label}
              onClick={run(fn)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition active:opacity-70 ${
                danger ? "text-red-500" : ""
              }`}
              style={danger ? undefined : { color: "var(--text)" }}
            >
              <Icon size={16} className={danger ? "" : "text-emerald-500"} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
