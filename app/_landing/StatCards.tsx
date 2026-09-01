import { Globe2, Zap, History, Sparkles } from "lucide-react";
import { CARD } from "./shell";

const STATS = [
  {
    icon: Globe2,
    title: "186 languages",
    sub: "Speak or type, translated instantly, no extra downloads",
  },
  {
    icon: Zap,
    title: "No sign-up needed",
    sub: "Try it right on this page — sign in only for more credits",
  },
  {
    icon: History,
    title: "History per language pair",
    sub: "Every conversation stays organized and easy to find again",
  },
  {
    icon: Sparkles,
    title: "Free to start",
    sub: "Scroll down and start translating right away",
  },
];

export function StatCards() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {STATS.map(({ icon: Icon, title, sub }) => (
        <div key={title} className={`${CARD} flex flex-col gap-1.5 p-5 sm:p-6`}>
          <Icon className="mb-1 h-7 w-7 text-emerald-500" />
          <div className="font-semibold">{title}</div>
          <p className="text-sm text-hint">{sub}</p>
        </div>
      ))}
    </div>
  );
}
