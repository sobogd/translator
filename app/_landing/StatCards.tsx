import { Globe2, Zap, History, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARD } from "./shell";
import type { StatCard } from "./types";

// Positional icons (index-matched to `statCards` in texts.json).
const ICONS: LucideIcon[] = [Globe2, Zap, History, Sparkles];

export function StatCards({ items }: { items: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {items.map(({ title, sub }, i) => {
        const Icon = ICONS[i] ?? Globe2;
        return (
          <div key={title} className={`${CARD} flex flex-col gap-1.5 p-5 sm:p-6`}>
            <Icon className="mb-1 h-7 w-7 text-button" />
            <div className="font-semibold">{title}</div>
            <p className="text-base text-hint">{sub}</p>
          </div>
        );
      })}
    </div>
  );
}
