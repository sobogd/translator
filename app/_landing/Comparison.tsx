import { Check, Minus } from "lucide-react";
import type { ComparisonRow } from "./types";

type ComparisonTexts = {
  title: string;
  titleAccent: string;
  description: string;
  usLabel: string;
  themLabel: string;
  rows: ComparisonRow[];
};

// Same layout as iq-rest's FeatureComparison: tinted 40% column on the left
// (heading/sub, sticky while the right column scrolls, no gradient on the
// accent — that's Hero-only there), plain 60% column on the right with rows
// stacked one after another.
export function Comparison({ texts }: { texts: ComparisonTexts }) {
  return (
    <div className="grid grid-cols-1 rounded-2xl border border-border lg:grid-cols-[2fr_3fr]">
      <div className="rounded-t-2xl bg-[hsl(28_48%_93%)] dark:bg-[hsl(28_15%_13%)] lg:rounded-t-none lg:rounded-l-2xl">
        <div className="flex flex-col items-start gap-3 p-5 text-start sm:p-6 lg:sticky lg:top-16">
          <h2 className="text-2xl font-medium leading-[1.15] tracking-tight sm:text-[1.75rem]">
            {texts.title} {texts.titleAccent}
          </h2>
          <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{texts.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 p-5 sm:p-6">
        {texts.rows.map((r) => (
          <div key={r.title}>
            <h3 className="mb-2 text-base font-medium tracking-tight sm:text-lg">{r.title}</h3>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
                <p className="text-sm leading-relaxed">
                  <span className="font-medium">{texts.usLabel}: </span>
                  {r.us}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-hint/60" strokeWidth={2.5} />
                <p className="text-sm leading-relaxed text-hint/80">
                  <span className="font-medium">{texts.themLabel}: </span>
                  {r.them}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
