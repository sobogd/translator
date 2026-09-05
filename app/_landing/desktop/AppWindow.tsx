// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable.
//
// With a product (the translator) the window is two separate content parts,
// not one frame with an inner scroll:
//   1) the translator — a full-width part ~80dvh tall with its own surface,
//      no page scroll inside it;
//   2) the page content — the second part that scrolls *inside itself*.
// First the outer area scrolls until the translator has fully moved up under
// the header; from then on only the second part scrolls (its inner area sits
// exactly where the translator was).
//
// `scrollContentToTop()` is what the header's "Translate" CTA uses: it scrolls
// the outer area back to the top so the translator part is shown again.
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".page-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

const CONTENT_H = "calc(100dvh - 64px)";

export function AppWindow({
  product,
  children,
}: {
  /** Translator block — the first content part (~80dvh, its own background). */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {product ? (
        <div className="page-scroll h-full w-full overflow-y-auto overscroll-contain">
          {/* Part 1 — the translator. Same height on every page so the widget
              is embedded identically everywhere; it scrolls up and away with
              the outer area until it is fully under the header. */}
          <section
            aria-label="Translator"
            className="flex h-[80dvh] w-full shrink-0 flex-col items-stretch bg-accent px-6 pb-6 pt-6 sm:px-8"
          >
            {product}
          </section>

          {/* Part 2 — the page content. Once the translator is fully off the
              top, this block fills the viewport and scrolls on its own. */}
          <section style={{ height: CONTENT_H }} className="content-scroll w-full overflow-y-auto overscroll-contain">
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
