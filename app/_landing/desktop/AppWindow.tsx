// The content window: a glass rectangle floating over the desktop, its content
// scrolling *inside* the window rather than the page (mirrors iq-mermaid's
// AppWindow). Unlike mermaid's, this window is never closable and hides nothing
// underneath: the product — the translator widget — lives at the top of the
// window's own scroll area, so there is no editor reveal, no click-away and no
// open/close state machine. `scrollToTop()` below is what the header's
// "Translate" CTA uses to bring the widget back into view from any scroll
// depth inside the window.
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".window-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

export function AppWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {/* Body scrolls internally. Fade the top so content melts under the
          window's top edge. */}
      <div className="window-scroll size-full flex-1">
        <div className="min-h-full">{children}</div>
      </div>
    </div>
  );
}
