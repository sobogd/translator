"use client";

import Link from "next/link";
import { NARROW, PRIMARY_FILL } from "./shell";
import { LogoIcon } from "./LogoIcon";

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

// `signedIn` is resolved server-side (getServerSessionEmail in page.tsx) and
// passed down, so the sign-in/log-out state is correct on first paint —
// no client fetch, no flash between the two.
export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md [transform:translateZ(0)]">
      <div className={`${NARROW} flex h-14 items-center justify-between gap-3 sm:h-16`}>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tracking-tight sm:text-xl"
        >
          <LogoIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          Translate
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
        {signedIn ? (
          <button
            onClick={logout}
            className="inline-flex shrink-0 text-sm font-semibold transition-opacity hover:opacity-70"
          >
            Log out
          </button>
        ) : (
          <a
            href="/api/auth/google/start"
            className="inline-flex shrink-0 text-sm font-semibold transition-opacity hover:opacity-70"
          >
            Sign in
          </a>
        )}
        <Link
          href="/#app"
          className={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
        >
          Try it now
        </Link>
      </div>
    </header>
  );
}
