import Link from "next/link";
import { NARROW, PRIMARY_BTN } from "./shell";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className={`${NARROW} flex h-16 items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 text-sm font-bold text-white">
            IQ
          </span>
          IQ Translate
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-hint sm:flex">
          <Link href="/#features" className="hover:text-text">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-text">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-text">
            FAQ
          </Link>
        </nav>
        <a href="/api/auth/google/start" className={PRIMARY_BTN}>
          Sign in with Google
        </a>
      </div>
    </header>
  );
}
