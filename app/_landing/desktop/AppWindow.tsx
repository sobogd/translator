// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the window is ONE scroll carrying two
// independent panels with visibly different surfaces (no nested scroll):
//   1) the translator panel (own background: bg-card) — large, but leaves the
//      second panel's top visible on arrival;
//   2) the page content panel (own background: bg-accent).
// A wide gap between them shows the darker scroll surface (bg-bg), so the two
// backgrounds never merge. Scrolling moves the translator panel up and the
// content panel passes through the same single scroll; scrolling back up
// returns the translator panel.
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it brings
// the translator panel back (scrolls the window's single scroll area to top).
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

// The gap between the panels: the darker surface (bg-bg) shows through here,
// separating the two panel backgrounds from each other.
const PART_GAP = 36;

export function AppWindow({
  product,
  children,
}: {
  /** Translator block — the first panel (own background). */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {product ? (
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain bg-bg">
          {/* Panel 1 — the translator. Big enough to dominate the first screen,
              but not full-height: the gap and the top of the content panel
              below stay visible, so the two blocks are clearly separate. */}
          <section
            aria-label="Translator"
            style={{ height: "clamp(420px, 70dvh, 700px)" }}
            className="flex w-full shrink-0 flex-col items-stretch rounded-xl border border-border bg-card px-5 pb-5 pt-5 shadow-sm sm:px-8"
          >
            {product}
          </section>

          {/* Panel 2 — the page content: a separate block on its own surface
              (bg-accent). The PART_GAP above it shows the darker page-scroll
              background between the panels. It scrolls with the same single
              scroll as everything else (no nested scroll). */}
          <section style={{ marginTop: PART_GAP }} className="w-full rounded-xl border border-border bg-accent pb-2">
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
