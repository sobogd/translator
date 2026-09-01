import { CARD, PRIMARY_BTN } from "./shell";

export function FinalCta() {
  return (
    <div className={`${CARD} flex flex-col items-center gap-4 p-8 text-center sm:p-12`}>
      <h2 className="text-2xl font-medium sm:text-[1.75rem]">
        Real-time voice translation,{" "}
        <span className="bg-gradient-to-br from-emerald-500 to-teal-400 bg-clip-text text-transparent">
          ready in 10 seconds.
        </span>
      </h2>
      <p className="max-w-xl text-sm text-hint sm:text-base">
        Sign in with Google and start talking — no downloads, no passwords, 186
        languages included.
      </p>
      <a href="/api/auth/google/start" className={PRIMARY_BTN}>
        Sign in with Google
      </a>
    </div>
  );
}
