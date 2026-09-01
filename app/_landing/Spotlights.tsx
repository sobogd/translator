import { Mic, Keyboard, Globe2, LogIn, Volume2, Copy, RefreshCw, History, Eraser, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARD } from "./shell";
import type { Spotlight } from "./types";

const TINTS = [
  "bg-[hsl(160_35%_95%)] dark:bg-[hsl(160_20%_14%)]",
  "bg-[hsl(200_35%_95%)] dark:bg-[hsl(200_20%_14%)]",
  "bg-[hsl(280_35%_96%)] dark:bg-[hsl(280_15%_14%)]",
  "bg-[hsl(40_45%_95%)] dark:bg-[hsl(40_20%_14%)]",
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

export function Spotlights({ items }: { items: Spotlight[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {items.map((s, i) => (
        <article key={s.heading} className={`${CARD} flex flex-col overflow-hidden`}>
          <div className={`${TINTS[i % TINTS.length]} p-6 sm:p-8`}>
            <h2 className="text-2xl font-medium sm:text-[1.75rem]">{s.heading}</h2>
            <p className="mt-2 text-sm text-hint sm:text-base">{s.sub}</p>
          </div>
          <ul className="flex flex-col gap-5 p-6 sm:p-8">
            {s.bullets.map((b, j) => {
              const Icon = ICONS[i]?.[j] ?? Mic;
              return (
                <li key={b.title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-7 w-7 shrink-0 text-button" />
                  <div>
                    <div className="font-semibold">{b.title}</div>
                    <p className="text-sm text-hint">{b.sub}</p>
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
