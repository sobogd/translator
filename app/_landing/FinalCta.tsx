import { PRIMARY_BTN } from "./shell";
import { TrackedNavLink } from "./TrackedLink";

// Same layout as iq-rest's FinalCta: one plain bordered block, left-aligned
// (not centered), heading/sub/CTA row stacked in one column, no gradient on
// the accent — that's Hero-only there.
export function FinalCta({
  heading = "Instant voice translation,",
  headingAccent = "ready in 10 seconds.",
  sub = "Try it right on this page — no sign-up, no downloads, 186 languages included.",
  ctaLabel = "Try it now",
  ctaHref = "/",
}: {
  heading?: string;
  headingAccent?: string;
  sub?: string;
  ctaLabel?: string;
  /** Always the locale's home page: the widget sits at the top of it, so the
   *  CTA lands on it from every page (and scrolls to top on the home page
   *  itself — Link's default scroll behaviour). */
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border p-6 text-start sm:p-8">
      <h2 className="text-2xl font-medium leading-[1.15] tracking-tight sm:text-[1.75rem]">
        {heading} {headingAccent}
      </h2>
      <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{sub}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <TrackedNavLink href={ctaHref} track="Final CTA" className={PRIMARY_BTN}>
          {ctaLabel}
        </TrackedNavLink>
      </div>
    </div>
  );
}
