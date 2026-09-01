import Link from "next/link";
import { NARROW } from "./shell";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md [transform:translateZ(0)]">
      <div className={`${NARROW} flex h-14 items-center justify-between gap-3 sm:h-16`}>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tracking-tight sm:text-xl"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 text-xs font-bold text-white sm:h-8 sm:w-8">
            IQ
          </span>
          IQ Translate
        </Link>
        <nav className="mr-auto hidden items-center gap-6 pl-8 text-sm font-semibold sm:flex">
          <Link href="/#features" className="transition-opacity hover:opacity-70">
            Features
          </Link>
          <Link href="/pricing" className="transition-opacity hover:opacity-70">
            Pricing
          </Link>
          <Link href="/#faq" className="transition-opacity hover:opacity-70">
            FAQ
          </Link>
        </nav>
        <a
          href="/api/auth/google/start"
          className="hidden shrink-0 text-sm font-semibold transition-opacity hover:opacity-70 lg:inline-flex"
        >
          Sign in
        </a>
        <Link
          href="/#app"
          className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 px-4 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]"
        >
          Try it now
        </Link>
      </div>
    </header>
  );
}
