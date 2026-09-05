import { Globe2, Zap, History, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StatCard } from "./types";

// Positional icons (index-matched to `statCards` in the locale texts).
const ICONS: LucideIcon[] = [Globe2, Zap, History, Sparkles];

// The four quick claims under the widget: an icon, a bold line and one muted
// sentence. Two per row on every screen from sm up — a simple flex wrap
// (mirrors iq-mermaid's StatCards: no cards, no grid).
export function StatCards({ items }: { items: StatCard[] }) {
  return (
    <ul className="flex flex-col gap-y-8 sm:flex-row sm:flex-wrap sm:gap-x-6">
      {items.map(({ title, sub }, i) => {
        const Icon = ICONS[i] ?? Globe2;
        return (
          <li key={title} className="flex w-full flex-col items-start gap-2 sm:w-[calc(50%-12px)]">
            <Icon className="h-6 w-6 text-button" strokeWidth={1.75} />
            <p className="text-[15px] font-semibold leading-snug text-text">{title}</p>
            <p className="text-sm leading-relaxed text-hint">{sub}</p>
          </li>
        );
      })}
    </ul>
  );
}
