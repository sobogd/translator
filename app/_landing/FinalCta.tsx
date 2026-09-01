import { CARD, PRIMARY_BTN } from "./shell";

export function FinalCta({
  heading = "Real-time voice translation,",
  headingAccent = "ready in 10 seconds.",
  sub = "Try it right on this page — no sign-up, no downloads, 186 languages included.",
  ctaLabel = "Try it now",
  ctaHref = "#app",
}: {
  heading?: string;
  headingAccent?: string;
  sub?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className={`${CARD} flex flex-col items-center gap-4 p-8 text-center sm:p-12`}>
      <h2 className="text-2xl font-medium sm:text-[1.75rem]">
        {heading}{" "}
        <span className="bg-gradient-to-br from-emerald-500 to-teal-400 bg-clip-text text-transparent">
          {headingAccent}
        </span>
      </h2>
      <p className="max-w-xl text-sm text-hint sm:text-base">{sub}</p>
      <a href={ctaHref} className={PRIMARY_BTN}>
        {ctaLabel}
      </a>
    </div>
  );
}
