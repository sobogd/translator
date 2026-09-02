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
    a: "No. Try it right on this page with no sign-up. Sign in with Google only if you want a bigger monthly quota and history synced across devices.",
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

// Same layout as iq-rest's Faq: tinted 40% column on the left (heading/sub,
// sticky while the right column scrolls, no gradient on the accent — that's
// Hero-only there), plain 60% column on the right with the questions.
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
    <div
      itemScope
      itemType="https://schema.org/FAQPage"
      className="grid grid-cols-1 rounded-2xl border border-border lg:grid-cols-[2fr_3fr]"
    >
      <div className="rounded-t-2xl bg-[hsl(28_48%_93%)] dark:bg-[hsl(28_15%_13%)] lg:rounded-t-none lg:rounded-l-2xl">
        <div className="flex flex-col items-start gap-3 p-5 text-start sm:p-6 lg:sticky lg:top-16">
          <h2 className="text-2xl font-medium leading-[1.15] tracking-tight sm:text-[1.75rem]">
            {heading} {headingAccent}
          </h2>
          <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{sub}</p>
        </div>
      </div>

      <div className="flex flex-col gap-8 p-5 sm:p-6">
        {items.map((item) => (
          <div key={item.q} itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
            <h3 itemProp="name" className="mb-2 text-base font-medium tracking-tight sm:text-lg">
              {item.q}
            </h3>
            <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
              <p itemProp="text" className="text-sm leading-relaxed text-hint">
                {item.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
