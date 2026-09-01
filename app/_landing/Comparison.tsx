import { Check, Minus } from "lucide-react";
import { CARD } from "./shell";
import type { ComparisonRow } from "./types";

type ComparisonTexts = {
  title: string;
  titleAccent: string;
  description: string;
  usLabel: string;
  themLabel: string;
  rows: ComparisonRow[];
};

export function Comparison({ texts }: { texts: ComparisonTexts }) {
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[2fr_3fr]`}>
      <div className="flex flex-col justify-center gap-3 bg-[hsl(28_48%_93%)] p-6 dark:bg-[hsl(28_15%_13%)] sm:p-8">
        <h2 className="text-2xl font-medium sm:text-[1.75rem]">
          {texts.title}{" "}
          <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
            {texts.titleAccent}
          </span>
        </h2>
        <p className="text-sm text-hint sm:text-base">{texts.description}</p>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {texts.rows.map((r) => (
          <div key={r.title} className="flex flex-col gap-2 p-5 sm:p-6">
            <h3 className="text-base font-semibold">{r.title}</h3>
            <div className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-button" />
              <span>
                <strong>{texts.usLabel}</strong>: {r.us}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-hint">
              <Minus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{texts.themLabel}</strong>: {r.them}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
