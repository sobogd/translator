import { CARD } from "./shell";

export type FaqItem = { q: string; a: string };

const DEFAULT_ITEMS: FaqItem[] = [
  {
    q: "How does voice translation work?",
    a: "Tap the mic and speak — your voice is transcribed and translated in a few seconds, shown as text and available to hear read aloud. No typing needed.",
  },
  {
    q: "How many languages are supported?",
    a: "186 languages. Pick your own language once, then start a conversation thread with anyone else's.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. Try it right on this page with no sign-up. Sign in with Google only if you want more daily credits and history synced across devices.",
  },
  {
    q: "Is my translation history saved?",
    a: "Yes, per language pair, so past conversations stay organized — even without signing in, your browser is remembered. Clear or delete any thread anytime from its menu.",
  },
  {
    q: "Can I use text instead of voice?",
    a: "Yes. Switch to keyboard mode anytime and type your message instead of speaking.",
  },
  {
    q: "Does it work for two-way conversation?",
    a: "Yes. Tap or swipe a translated line to flip between the original and the translation, so both sides can follow along on one screen.",
  },
];

export function Faq({
  heading = "Frequently asked",
  headingAccent = "questions",
  sub = "What people ask before trying it. No sign-up needed — scroll up and try it yourself.",
  items = DEFAULT_ITEMS,
}: {
  heading?: string;
  headingAccent?: string;
  sub?: string;
  items?: FaqItem[];
}) {
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[2fr_3fr]`}>
      <div className="flex flex-col justify-center gap-3 bg-[hsl(160_30%_95%)] p-6 dark:bg-[hsl(160_18%_13%)] sm:p-8">
        <h2 className="text-2xl font-medium sm:text-[1.75rem]">
          {heading}{" "}
          <span className="bg-gradient-to-br from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            {headingAccent}
          </span>
        </h2>
        <p className="text-sm text-hint sm:text-base">{sub}</p>
      </div>
      <div className="flex flex-col divide-y divide-border" itemScope itemType="https://schema.org/FAQPage">
        {items.map((item) => (
          <div
            key={item.q}
            className="p-5 sm:p-6"
            itemScope
            itemProp="mainEntity"
            itemType="https://schema.org/Question"
          >
            <h3 itemProp="name" className="text-base font-semibold">
              {item.q}
            </h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="mt-1.5 text-sm text-hint">
                {item.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
