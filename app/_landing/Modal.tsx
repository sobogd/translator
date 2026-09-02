"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// The one modal shell: header (title + close) over a bottom border, scrollable
// unpadded content (each consumer brings its own padding — the language picker
// wants a flush full-width search field), and an optional footer above a top
// border whose CTA buttons all render h-9, same as the header CTAs. Portaled
// to <body> so no ancestor transform/backdrop-filter can trap it.
export function Modal({
  title,
  onClose,
  closeAria = "Close",
  maxWidth = "max-w-md",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  closeAria?: string;
  maxWidth?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl border shadow-xl sm:rounded-2xl`}
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label={closeAria}
            className="rounded-lg p-1.5 transition active:scale-90"
            style={{ color: "var(--hint)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
