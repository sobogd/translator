// Layout + button tokens for the PostHog-style desktop landing (ported 1:1
// from iq-mermaid's app/_landing/shell.tsx).
//
// The whole site lives inside a glass AppWindow, so sections are plain bands
// that share the window's side padding and space themselves with vertical
// padding only — no wrappers, no cards — and CTAs use the solid brand red.
export const NARROW = "max-w-[960px] mx-auto px-4 sm:px-6";

const BTN_BOX =
  "h-10 px-4 text-sm font-semibold rounded-md whitespace-nowrap inline-flex items-center justify-center transition-all active:scale-[0.99]";

// Accent CTA: solid red `#d9534f` fill with white text.
const PRIMARY_FILL = "bg-button text-button-text";
export const PRIMARY_BTN = `${BTN_BOX} ${PRIMARY_FILL} hover:brightness-95`;
export const OUTLINE_BTN = `${BTN_BOX} border border-border text-text bg-transparent hover:bg-card`;
// PRIMARY_FILL is exported under its old name too — the translator widget and
// the account controls (AuthButton / modal CTAs) still compose it directly.
export { PRIMARY_FILL };

export function Band({
  id,
  section,
  className = "",
  children,
}: {
  id?: string;
  /** Stable name of the band, kept as a data attribute so a section can be
   *  referred to without relying on `id` (an anchor target, not always set). */
  section?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-section={section} className={className}>
      {children}
    </section>
  );
}
