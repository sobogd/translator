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
        // The scroll surface is full-bleed (its scrollbar sits at the very
        // edge of the screen); the windows below stay centred in the site's
        // max-w container, with the desktop surface around them.
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain">
          <div className="flex w-full flex-col px-2 py-2 sm:px-6">
            {/* Zone 1 — the translator. Full first screen on mobile, 70dvh on
                desktop. Transparent itself; the blocks inside carry the
                window surface. */}
            <section
              aria-label="Translator"
              className="mx-auto flex h-[calc(100dvh-72px)] w-full max-w-[1000px] shrink-0 flex-col overflow-hidden sm:h-[70dvh]"
            >
              {product}
            </section>

            {/* Window 2 — the page content: the same glass window the single
                scroll window used to be, separated by the same LAYOUT_GAP.
                No inner scroll: it passes through the one outer scroll. */}
            <section
              style={{ marginTop: LAYOUT_GAP }}
              className="window-glass mx-auto w-full max-w-[1000px] overflow-hidden rounded-lg"
            >
              {children}
            </section>
          </div>
        </div>
      ) : (
        <div className="window-scroll min-h-0 w-full flex-1">
          <div className="mx-auto min-h-full w-full max-w-[1000px] px-2 py-2 sm:px-6">{children}</div>
        </div>
      )}
    </div>
  );
}
