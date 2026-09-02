import { ArrowRightLeft, Mic, Volume2 } from "lucide-react";
import { CARD } from "./shell";

type HeroTexts = {
  badgeVoice: string;
  badgeText: string;
  badgeLanguages: string;
  title: string;
  titleAccent: string;
  description: string;
  ctaTry: string;
  ctaSignIn: string;
  mockFromLabel: string;
  mockFromPhrase: string;
  mockToLabel: string;
  mockToPhrase: string;
};

// Mirrors the real composer: a language-pair strip over a text row with the
// gradient mic/send CTA hugging the right edge (see Translator.tsx's pairRow
// + composerRow), plus a translated-result bubble above it like the first
// turn of a real conversation.
function MockCard({ texts }: { texts: HeroTexts }) {
  return (
    <div className="flex h-full items-center justify-center bg-[hsl(32_44%_92%)] p-6 dark:bg-[hsl(32_14%_14%)] sm:p-10">
      <div className="flex w-full max-w-[300px] flex-col gap-3">
        <div className={`${CARD} bg-card p-4 shadow-xl`}>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-hint">
            <span>{texts.mockToLabel}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="text-base leading-relaxed">{texts.mockToPhrase}</p>
            <Volume2 size={16} className="mt-0.5 shrink-0 text-button" />
          </div>
        </div>
        <div className={`${CARD} flex flex-col overflow-hidden bg-card shadow-xl`}>
          <div className="flex items-stretch border-b border-border text-xs font-semibold">
            <span className="flex flex-1 items-center justify-center truncate px-2 py-2.5">{texts.mockFromLabel}</span>
            <span className="flex w-8 shrink-0 items-center justify-center text-hint">
              <ArrowRightLeft size={13} />
            </span>
            <span className="flex flex-1 items-center justify-center truncate px-2 py-2.5">{texts.mockToLabel}</span>
          </div>
          <div className="flex items-stretch">
            <p className="flex min-h-11 flex-1 items-center truncate px-4 text-sm text-hint">{texts.mockFromPhrase}</p>
            <span className="flex shrink-0 items-center justify-center bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] px-5 text-white">
              <Mic size={18} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Same left-column rhythm as iq-rest's FeatureHeroCard: gap-6 between the
// badge row / headline+sub block / CTA row, with the headline+sub themselves
// grouped in their own gap-4 block that centers vertically (`my-auto`)
// against the art panel's height instead of top-aligning.
export function Hero({ texts }: { texts: HeroTexts }) {
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[11fr_9fr]`}>
      <div className="order-1 flex min-w-0 flex-col items-start gap-6 p-6 text-start sm:p-8">
        <div className="my-auto flex min-w-0 flex-col gap-4">
          <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
            {texts.title}{" "}
            <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
              {texts.titleAccent}
            </span>
          </h1>
          <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{texts.description}</p>
        </div>
      </div>
      <div className="order-2 aspect-[4/3] lg:aspect-auto lg:min-h-[21.5rem]">
        <MockCard texts={texts} />
      </div>
    </div>
  );
}
