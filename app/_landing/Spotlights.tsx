import { Mic, Keyboard, Globe2, LogIn, Volume2, Copy, RefreshCw, History, Eraser, ShieldCheck } from "lucide-react";
import { CARD } from "./shell";

const TINTS = [
  "bg-[hsl(160_35%_95%)] dark:bg-[hsl(160_20%_14%)]",
  "bg-[hsl(200_35%_95%)] dark:bg-[hsl(200_20%_14%)]",
  "bg-[hsl(280_35%_96%)] dark:bg-[hsl(280_15%_14%)]",
  "bg-[hsl(40_45%_95%)] dark:bg-[hsl(40_20%_14%)]",
];

const SPOTLIGHTS = [
  {
    heading: "Real-time voice translation",
    sub: "Tap the mic and talk. Your speech is transcribed and translated in seconds — no typing needed.",
    bullets: [
      { icon: Mic, title: "Speak, get instant translation", sub: "One tap starts recording, translation appears right after" },
      { icon: Volume2, title: "Hear it aloud", sub: "Tap the speaker to have the translation read out loud" },
      { icon: Keyboard, title: "Voice or text, your choice", sub: "Switch modes anytime with a single tap" },
    ],
  },
  {
    heading: "Text translation too",
    sub: "Prefer typing? Switch to keyboard mode and translate a message instantly.",
    bullets: [
      { icon: RefreshCw, title: "Flip original and translation", sub: "Tap or swipe a line to see it in either language" },
      { icon: Copy, title: "Copy with one tap", sub: "Grab the translated text to paste anywhere" },
      { icon: Mic, title: "Switch to voice anytime", sub: "Start typing, then dictate the next line instead" },
    ],
  },
  {
    heading: "186 languages, organized by conversation",
    sub: "Pick your language once, then browse everyone else's — each language pair keeps its own saved thread.",
    bullets: [
      { icon: Globe2, title: "186 languages included", sub: "No extra downloads or language packs to install" },
      { icon: History, title: "Conversations stay organized", sub: "Every language pair has its own saved history" },
      { icon: Eraser, title: "Clear or delete anytime", sub: "Wipe a thread's history or remove it entirely from the menu" },
    ],
  },
  {
    heading: "Google sign-in, no passwords",
    sub: "One tap to sign in with your Google account — nothing else to set up.",
    bullets: [
      { icon: LogIn, title: "One-tap sign-in", sub: "No registration form, no password to remember" },
      { icon: ShieldCheck, title: "Your email, nothing else", sub: "Only your Google email identifies your account" },
    ],
  },
];

export function Spotlights() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {SPOTLIGHTS.map((s, i) => (
        <article key={s.heading} className={`${CARD} flex flex-col overflow-hidden`}>
          <div className={`${TINTS[i % TINTS.length]} p-6 sm:p-8`}>
            <h2 className="text-2xl font-medium sm:text-[1.75rem]">{s.heading}</h2>
            <p className="mt-2 text-sm text-hint sm:text-base">{s.sub}</p>
          </div>
          <ul className="flex flex-col gap-5 p-6 sm:p-8">
            {s.bullets.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-7 w-7 shrink-0 text-emerald-500" />
                <div>
                  <div className="font-semibold">{title}</div>
                  <p className="text-sm text-hint">{sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
