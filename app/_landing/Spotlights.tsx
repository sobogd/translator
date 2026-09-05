import { Mic, Keyboard, Globe2, Volume2, Copy, RefreshCw, History, Eraser, ShieldCheck, LogIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Spotlight } from "./types";

// Bullet icons, positional (index-matched to each spotlight's `bullets`
// array in the texts) since the copy lives in the dictionary but the icon
// choice doesn't need to. Home-page defaults; pair pages pass their own set.
const ICONS: LucideIcon[][] = [
  [Mic, Volume2, Keyboard],
  [RefreshCw, Copy, Mic],
  [Globe2, History, Eraser],
  [LogIn, ShieldCheck],
];

// The feature pillars on the home page — one per row, each a single plain
// block: an h2, a sub paragraph, then its bullet points. No cards, no grid
// (mirrors iq-mermaid's Spotlights).
export function Spotlights({ items, icons = ICONS }: { items: Spotlight[]; icons?: LucideIcon[][] }) {
  return (
    <div className="flex flex-col gap-y-12 sm:gap-y-16">
      {items.map((s, i) => (
        <article key={s.heading} className="flex flex-col items-start gap-3">
          <h2 className="text-2xl font-semibold leading-[1.2] tracking-tight text-text sm:text-3xl">{s.heading}</h2>
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-text/75">{s.sub}</p>
          <ul className="mt-4 flex w-full flex-col gap-4">
            {s.bullets.map((b, j) => {
              const Icon = icons[i]?.[j] ?? Mic;
              return (
                <li key={b.title} className="flex max-w-[72ch] items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-button" strokeWidth={1.75} />
                  <p className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-snug text-text">{b.title}</span>
                    <span className="text-sm leading-relaxed text-hint">{b.sub}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
