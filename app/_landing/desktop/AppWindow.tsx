// The content window: a glass rectangle floating over the desktop, mirrored
// from iq-mermaid's AppWindow. Unlike mermaid's it is never closable: the top
// of the window is the fixed translator widget (`product`) and below it the
// page content scrolls *inside* the window (.window-scroll) — the page itself
// never scrolls. `scrollContentToTop()` is what the header's "Translate" CTA
// uses to bring the content back to its start.
export function scrollContentToTop() {
  if (typeof window === "undefined") return;
  const el = document.querySelector<HTMLElement>(".window-scroll");
  el?.scrollTo({ top: 0, behavior: "smooth" });
}

export function AppWindow({
  product,
  children,
}: {
  /** Fixed translator block, always visible above the scrollable content. */
  product?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="window-glass pointer-events-auto relative flex size-full flex-col overflow-hidden rounded-lg">
      {/* The product (translator) is pinned at the top of the window — it is
          its own content part and never scrolls away. */}
      {product && (
        <div className="relative z-10 shrink-0 px-6 pb-4 pt-5 sm:px-8">
          <div className="h-[clamp(300px,56dvh,560px)]">{product}</div>
        </div>
      )}
      {/* Page content scrolls inside the window below the product. */}
      <div className="window-scroll min-h-0 w-full flex-1">
        <div className="min-h-full">{children}</div>
      </div>
    </div>
  );
}
