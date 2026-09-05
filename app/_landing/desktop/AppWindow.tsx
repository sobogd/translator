// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the window is ONE scroll that carries two
// independent panels — there is no nested scroll:
//   1) the translator panel — fills the whole window below the header (its
//      own background/border), so on arrival the content is not visible;
//   2) the page content panel — its own background/border, separated from the
//      translator by a gap through which the window's surface shows, so the
//      two panels read as separate blocks.
// Scrolling moves the translator panel up until it is fully under the header,
// then the gap and the content panel pass through the same scroll; scrolling
// back up returns the translator panel.
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it brings
// the translator panel back (scrolls the window's single scroll area to top).
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

// The window's viewport height under the fixed header (taskbar + margins).
const VIEW_H = "calc(100dvh - 64px)";
// Visible separation between the two panels: the window's surface shows here,
// separating the translator's background from the content's background.
const PART_GAP = 24;

export function AppWindow({
  product,
  children,
}: {
  /** Translator block — the first panel (fills the window, its own surface). */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {product ? (
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain">
          {/* Panel 1 — the translator. Fills the whole window below the header
              so nothing of the content is visible on arrival; scrolling moves
              it up and away in this same scroll. */}
          <section
            aria-label="Translator"
            style={{ height: VIEW_H }}
            className="flex w-full shrink-0 flex-col items-stretch rounded-xl border border-border bg-card px-5 pb-5 pt-5 sm:px-8"
          >
            {product}
          </section>

          {/* Panel 2 — the page content: a separate block with its own surface.
              The PART_GAP above it shows the window's background between the
              two panels, so they never share a background. It scrolls with the
              same single scroll as everything else (no nested scroll). */}
          <section style={{ marginTop: PART_GAP }} className="w-full rounded-xl border border-border bg-card">
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
