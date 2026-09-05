// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the desktop shows TWO glass windows of the
// same design, stacked in ONE common scroll (no nested scroll):
//   1) the translator window — fills the whole area below the header, so on
//      arrival only it is visible; scrolling moves it up and away;
//   2) the content window — same design as before (the window that used to be
//      the single scroll block), below a gap of the desktop surface; it
//      scrolls through the same outer scroll after the translator is gone.
// Scrolling back up returns the translator window.
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it brings
// the translator window back (scrolls the single scroll area to its top).
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

// The window area under the fixed header (taskbar + margins) — the height the
// translator window fills on arrival.
const VIEW_H = "calc(100dvh - 64px)";
// Desktop-surface gap between the two windows (their backgrounds never touch).
const PART_GAP = 28;

export function AppWindow({
  product,
  children,
}: {
  /** Translator block — the top window (same glass design). */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {product ? (
        // The desktop field the two windows float on; both windows use the
        // same `.window-glass` surface as the original single window.
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain bg-bg">
          {/* Window 1 — the translator, fills the first screen (its own glass
              surface, exactly like the window below). */}
          <section
            aria-label="Translator"
            style={{ height: VIEW_H }}
            className="window-glass flex w-full shrink-0 flex-col items-stretch overflow-hidden rounded-lg px-5 pb-5 pt-5 sm:px-8"
          >
            {product}
          </section>

          {/* Window 2 — the page content: the same design the single scroll
              window used to have, sitting below a gap of the desktop surface.
              No inner scroll: it passes through the one outer scroll. */}
          <section style={{ marginTop: PART_GAP }} className="window-glass w-full overflow-hidden rounded-lg">
            {children}
          </section>
        </div>
      ) : (
        <div className="window-scroll min-h-0 w-full flex-1">
          <div className="min-h-full">{children}</div>
        </div>
      )}
    </div>
  );
}
