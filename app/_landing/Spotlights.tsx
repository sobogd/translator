import { Mic, Keyboard, Globe2, LogIn, Volume2, Copy, RefreshCw, History, Eraser, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARD } from "./shell";
import type { Spotlight } from "./types";

// Same warm tint rotation as iq-rest's FeatureSpotlights (app/_landing/components/feature-spotlights.tsx there).
const TINTS = [
  "bg-[hsl(32_44%_92%)] dark:bg-[hsl(32_14%_14%)]",
  "bg-[hsl(18_40%_92%)] dark:bg-[hsl(18_14%_14%)]",
  "bg-[hsl(45_44%_92%)] dark:bg-[hsl(45_14%_14%)]",
  "bg-[hsl(24_40%_92%)] dark:bg-[hsl(24_14%_14%)]",
];

// Bullet icons, positional (index-matched to each spotlight's `bullets`
// array in texts.json) since the copy lives in the dictionary but the icon
// choice doesn't need to.
const ICONS: LucideIcon[][] = [
  [Mic, Volume2, Keyboard],
  [RefreshCw, Copy, Mic],
  [Globe2, History, Eraser],
  [LogIn, ShieldCheck],
];

export function Spotlights({ items, icons = ICONS }: { items: Spotlight[]; icons?: LucideIcon[][] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {items.map((s, i) => (
        <article key={s.heading} className={`${CARD} flex flex-col overflow-hidden`}>
          <div className={`${TINTS[i % TINTS.length]} p-6 sm:p-8`}>
            <h2 className="text-2xl font-medium leading-[1.15] tracking-tight sm:text-[1.75rem]">
              {s.heading}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-hint/80">{s.sub}</p>
          </div>
          <ul className="flex flex-col gap-5 p-6 sm:p-8">
            {s.bullets.map((b, j) => {
              const Icon = icons[i]?.[j] ?? Mic;
              return (
                <li key={b.title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-7 w-7 shrink-0 text-button" strokeWidth={1.75} />
                  <div>
                    <div className="text-base font-semibold">{b.title}</div>
                    <p className="text-base leading-relaxed text-hint/80">{b.sub}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}
