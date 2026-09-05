// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the window is two separate content parts:
//   1) the translator — fills the whole window below the header (nothing of
//      the second part is visible until you scroll) and has its own surface;
//   2) the page content — the second part, separated by a gap, that scrolls
//      *inside itself*.
// First the outer area scrolls until the translator has fully moved up under
// the header; then the gap passes and the second part takes over, scrolling
// on its own.
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it brings
// the translator part back (outer layer to its top) and resets the content
// part, so the next scroll starts from the content's beginning again.
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const inner = document.querySelector<HTMLElement>(".content-scroll");
  if (inner) inner.scrollTop = 0;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

// The window's viewport height under the fixed header (taskbar + margins),
// used for both parts so their seams line up exactly with the window edges.
const VIEW_H = "calc(100dvh - 64px)";
// Visible separation between the translator part and the content part.
const PART_GAP = 16;

export function AppWindow({
  product,
  children,
}: {
  /** Translator block — the first content part (fills the window, its own
   *  background). */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {product ? (
        // Outer scroll: carries the translator part up and away. `overscroll`
        // stays at its default so the inner content part can chain its own
        // scroll back up to this layer (no `overscroll-contain`).
        <div className="page-scroll h-full w-full overflow-y-auto">
          {/* Part 1 — the translator. Fills the whole window below the header
              (same height as the window itself), so on arrival nothing of the
              content part is visible; scrolling moves it up and away. */}
          <section
            aria-label="Translator"
            style={{ height: VIEW_H, marginBottom: PART_GAP }}
            className="flex w-full shrink-0 flex-col items-stretch bg-accent px-6 pb-6 pt-6 sm:px-8"
          >
            {product}
          </section>

          {/* Part 2 — the page content. The gap above it lets the window's
              surface show between the two parts while scrolling; once the
              translator is fully off the top this block fills the viewport
              and scrolls on its own. No overscroll-contain on purpose: at its
              top an upward scroll must chain to the outer layer so the
              translator part comes back. */}
          <section style={{ height: VIEW_H }} className="content-scroll w-full overflow-y-auto">
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
