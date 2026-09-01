"use client";

import Link from "next/link";
import { NARROW, PRIMARY_FILL } from "./shell";
import { LogoIcon } from "./LogoIcon";

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

type HeaderTexts = {
  logo: string;
  features: string;
  pricing: string;
  faq: string;
  signIn: string;
  logOut: string;
  tryItNow: string;
};

const DEFAULT_TEXTS: HeaderTexts = {
  logo: "Translate",
  features: "Features",
  pricing: "Pricing",
  faq: "FAQ",
  signIn: "Sign in",
  logOut: "Log out",
  tryItNow: "Try it now",
};

// `signedIn` is resolved server-side (getServerSessionEmail in page.tsx) and
// passed down, so the sign-in/log-out state is correct on first paint —
// no client fetch, no flash between the two.
//
// `texts`/`homeHref` default to the English literals above so the
// not-yet-localized /pricing page can keep calling <Header signedIn={...} />
// unchanged.
export function Header({
  signedIn,
  homeHref = "/",
  texts = DEFAULT_TEXTS,
}: {
  signedIn: boolean;
  homeHref?: string;
  texts?: HeaderTexts;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md [transform:translateZ(0)]">
      <div className={`${NARROW} flex h-14 items-center justify-between gap-3 sm:h-16`}>
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tracking-tight sm:text-xl"
        >
          <LogoIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          {texts.logo}
        </Link>
        <nav className="mr-auto hidden items-center gap-6 pl-8 text-sm font-semibold sm:flex">
          <Link href={`${homeHref}#features`} className="transition-opacity hover:opacity-70">
            {texts.features}
          </Link>
          <Link href="/pricing" className="transition-opacity hover:opacity-70">
            {texts.pricing}
          </Link>
          <Link href={`${homeHref}#faq`} className="transition-opacity hover:opacity-70">
            {texts.faq}
          </Link>
        </nav>
        {signedIn ? (
          <button
            onClick={logout}
            className="inline-flex shrink-0 text-sm font-semibold transition-opacity hover:opacity-70"
          >
            {texts.logOut}
          </button>
        ) : (
          <a
            href="/api/auth/google/start"
            className="inline-flex shrink-0 text-sm font-semibold transition-opacity hover:opacity-70"
          >
            {texts.signIn}
          </a>
        )}
        <Link
          href={`${homeHref}#app`}
          className={`inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
        >
          {texts.tryItNow}
        </Link>
      </div>
    </header>
  );
}
