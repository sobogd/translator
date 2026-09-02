"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// The one modal shell: header (title + close) over a bottom border, scrollable
// unpadded content (each consumer brings its own padding — the language picker
// wants a flush full-width search field), and an optional footer above a top
// border whose CTA buttons all render h-9, same as the header CTAs. Portaled
// to <body> so no ancestor transform/backdrop-filter can trap it. Enter/exit
// are animated: the shell fades its backdrop and slides/scales the card, and
// close requests play the exit animation before calling onClose.
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setMounted(true);
    // enter on the next frame so the initial (hidden) styles actually paint
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 sm:items-center sm:p-4 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      <div
        className={`flex max-h-[85dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl border shadow-xl transition-all duration-200 sm:rounded-2xl ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 opacity-0 sm:translate-y-2 sm:scale-95"
        }`}
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={close}
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
