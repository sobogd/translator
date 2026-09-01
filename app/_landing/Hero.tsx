import { Mic, Volume2 } from "lucide-react";
import { CARD, PRIMARY_BTN, OUTLINE_BTN } from "./shell";

function MockCard() {
  return (
    <div className="flex h-full items-center justify-center bg-[hsl(160_35%_92%)] p-6 dark:bg-[hsl(160_20%_14%)] sm:p-10">
      <div className={`${CARD} w-full max-w-[280px] bg-card p-4 shadow-xl`}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-hint">
          <span>🇪🇸 Spanish</span>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-hint">Hola, ¿cómo estás?</p>
        <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-hint">
          <span>🇬🇧 English</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-base leading-relaxed">Hello, how are you?</p>
          <Volume2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
        </div>
        <div className="mt-5 flex justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 text-white">
            <Mic size={18} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className={`${CARD} grid grid-cols-1 overflow-hidden lg:grid-cols-[11fr_9fr]`}>
      <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-8 lg:order-1">
        <div className="flex items-center gap-3 text-sm text-hint/80">
          <span>Voice</span>
          <span>·</span>
          <span>Text</span>
          <span>·</span>
          <span>186 languages</span>
        </div>
        <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
          Real-time voice translation{" "}
          <span className="bg-gradient-to-br from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            for any conversation
          </span>
        </h1>
        <p className="text-sm text-hint/80 sm:text-base">
          Speak naturally and get an instant translation, spoken or written, in 186
          languages. No sign-up required to try it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#app" className={PRIMARY_BTN}>
            Try it now — free
          </a>
          <a href="/api/auth/google/start" className={OUTLINE_BTN}>
            Sign in with Google
          </a>
        </div>
      </div>
      <div className="order-1 h-full lg:order-2">
        <MockCard />
      </div>
    </div>
  );
}
