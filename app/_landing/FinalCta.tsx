import Link from "next/link";
import { PRIMARY_BTN } from "./shell";

// The closing block of a page: heading, one muted line and (on the landing
// surfaces) a CTA back to the widget — full width, no box, nothing wrapping
// the text into a narrow column (mirrors iq-mermaid's FinalCta).
export function FinalCta({
  heading = "Instant voice translation,",
  headingAccent = "ready in 10 seconds.",
  sub = "Try it right on this page — no sign-up, no downloads, 186 languages included.",
  ctaLabel = "Try it now",
  ctaHref,
}: {
  heading?: string;
  headingAccent?: string;
  sub?: string;
  ctaLabel?: string;
  /** When given, renders a solid CTA that lands the visitor back on the
   *  widget (`#app` on the locale home). Omit for pages with no widget. */
  ctaHref?: string;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <h2 className="text-balance text-2xl font-semibold leading-[1.15] tracking-tight text-text sm:text-3xl">
        {heading} {headingAccent}
      </h2>
      <p className="text-pretty text-[15px] leading-relaxed text-text/75 sm:text-base">{sub}</p>
      {ctaHref && (
        <Link href={ctaHref} className={`mt-3 ${PRIMARY_BTN}`}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
