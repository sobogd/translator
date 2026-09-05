// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the desktop shows TWO glass windows of the
// same design, stacked in ONE common scroll (no nested scroll):
//   1) the translator window — full height on mobile, 70dvh on desktop, so on
//      arrival only it is visible (on mobile) / the content window is already
//      peeking below it (on desktop); scrolling moves it up and away;
//   2) the content window — same design as before (the window that used to be
//      the single scroll block), separated by the same LAYOUT_GAP as the gap
//      between the header and the first window.
// Scrolling back up returns the translator window.
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it brings
// the translator window back (scrolls the single scroll area to its top).
import { LAYOUT_GAP } from "./layout";

export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

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
        // The desktop field is the page's own zero background: the scroll area
        // is transparent, so the base wallpaper shows through everywhere the
        // blocks don't cover it (gaps included). The content window below is
        // the glass surface the original single window had.
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain">
          {/* Zone 1 — the translator blocks. Full first screen on mobile,
              70dvh on desktop. Transparent itself; the blocks inside carry the
              window surface. */}
          <section
            aria-label="Translator"
            className="flex h-[calc(100dvh-72px)] w-full shrink-0 flex-col overflow-hidden sm:h-[70dvh]"
          >
            {product}
          </section>

          {/* Window 2 — the page content: the same glass window the single
              scroll window used to be, separated by the same LAYOUT_GAP.
              No inner scroll: it passes through the one outer scroll. */}
          <section
            style={{ marginTop: LAYOUT_GAP }}
            className="window-glass w-full overflow-hidden rounded-lg"
          >
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
