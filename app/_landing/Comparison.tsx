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

// IQ Translate vs the usual options, as one full-width column of type: the
// heading block on top, every comparison row beneath it. No sticky side
// column, no grid, no tinted surface (mirrors iq-mermaid's Comparison).
export function Comparison({ texts }: { texts: ComparisonTexts }) {
  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex flex-col items-start gap-3">
        <h2 className="text-2xl font-semibold leading-[1.15] tracking-tight text-text sm:text-3xl">
          {texts.title} {texts.titleAccent}
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-text/75">{texts.description}</p>
      </div>

      <div className="flex flex-col gap-y-10">
        {texts.rows.map((r) => (
          <section key={r.title} className="flex flex-col gap-2.5">
            <h3 className="text-lg font-semibold tracking-tight text-text">{r.title}</h3>
            <div className="flex flex-col gap-2">
              <p className="flex items-start gap-2 text-[15px] leading-relaxed text-text/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                <span>
                  <span className="font-medium text-text">{texts.usLabel}: </span>
                  {r.us}
                </span>
              </p>
              <p className="flex items-start gap-2 text-[15px] leading-relaxed text-text/60">
                <Minus className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span>
                  <span className="font-medium text-text/80">{texts.themLabel}: </span>
                  {r.them}
                </span>
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
