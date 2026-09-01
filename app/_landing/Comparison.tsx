import { Check, Minus } from "lucide-react";
import { CARD } from "./shell";

const ROWS = [
  {
    title: "Voice translation",
    us: "One tap records, transcribes and translates in seconds.",
    them: "Text-only, or requires typing out what you heard.",
  },
  {
    title: "Conversation history",
    us: "Every language pair keeps its own saved thread.",
    them: "History disappears when you close the tab.",
  },
  {
    title: "Getting started",
    us: "Try it immediately, right on this page — no account required.",
    them: "Account creation with email and password before you can try it.",
  },
  {
    title: "Voice playback",
    us: "Tap to hear the translation read aloud.",
    them: "No voice output.",
  },
  {
    title: "Languages",
    us: "186 languages available, no extra download.",
    them: "Limited offline language packs.",
  },
];

export function Comparison() {
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[2fr_3fr]`}>
      <div className="flex flex-col justify-center gap-3 bg-[hsl(160_30%_95%)] p-6 dark:bg-[hsl(160_18%_13%)] sm:p-8">
        <h2 className="text-2xl font-medium sm:text-[1.75rem]">
          Why voice{" "}
          <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
            comes first
          </span>
        </h2>
        <p className="text-sm text-hint sm:text-base">
          Most translation apps stop at typed text. The rows below are what actually
          differs when you need to talk, not type.
        </p>
      </div>
      <div className="flex flex-col divide-y divide-border">
        {ROWS.map((r) => (
          <div key={r.title} className="flex flex-col gap-2 p-5 sm:p-6">
            <h3 className="text-base font-semibold">{r.title}</h3>
            <div className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-button" />
              <span>
                <strong>IQ Translate</strong>: {r.us}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-hint">
              <Minus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Typical apps</strong>: {r.them}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
