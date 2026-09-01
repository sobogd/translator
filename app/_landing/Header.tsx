"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { NARROW, PRIMARY_FILL } from "./shell";
import { LogoIcon } from "./LogoIcon";
import { InstallAppButton } from "./InstallAppButton";
import { localizedFeatureLinks, type FeatureLinkDef } from "@/lib/locale-slug-overrides";
import { defaultLocale, type Locale } from "@/lib/locales";

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
}

type HeaderTexts = {
  logo: string;
  features: string;
  pricing: string;
  mobileApp: string;
  signIn: string;
  logOut: string;
  tryItNow: string;
};

const DEFAULT_TEXTS: HeaderTexts = {
  logo: "Translate",
  features: "Features",
  pricing: "Pricing",
  mobileApp: "Mobile app",
  signIn: "Sign in",
  logOut: "Log out",
  tryItNow: "Try it now",
};

// `signedIn` is resolved server-side (getServerSessionEmail in page.tsx) and
// passed down, so the sign-in/log-out state is correct on first paint —
// no client fetch, no flash between the two.
//
// `texts`/`homeHref`/`locale` default to English literals so the
// not-yet-localized /pricing page can keep calling <Header signedIn={...} />
// unchanged.
//
// Same dropdown/burger logic as iq-rest's LandingHeader: a hover-opened
// "Features" panel on desktop (open instantly, close after a short delay so
// the pointer can cross the gap to the panel) and a click-opened burger menu
// on mobile that closes on outside click / Escape — scaled to this app's
// single nav group (no separate products/pricing/guide split).
export function Header({
  signedIn,
  homeHref = "/",
  locale = defaultLocale,
  texts = DEFAULT_TEXTS,
  featureLinks = [],
}: {
  signedIn: boolean;
  homeHref?: string;
  locale?: Locale;
  texts?: HeaderTexts;
  featureLinks?: FeatureLinkDef[];
}) {
  const links = localizedFeatureLinks(locale, featureLinks);
  const hasFeatureLinks = links.length > 0;

  const [featuresOpen, setFeaturesOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFeatures = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setFeaturesOpen(true);
  };
  const closeFeaturesSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFeaturesOpen(false), 120);
  };
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // The panel is a sibling of the header's own bottom edge (not of the
  // inline trigger, which sits vertically centered mid-row) so `top-full`
  // lands exactly on the header's border and the two read as one shape —
  // same measurement technique as iq-rest's LandingHeader (`productsLeft`).
  const headerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [featuresLeft, setFeaturesLeft] = useState(0);
  useEffect(() => {
    if (!hasFeatureLinks) return;
    const measure = () => {
      const header = headerRef.current;
      const trigger = triggerRef.current;
      if (!header || !trigger) return;
      setFeaturesLeft(trigger.getBoundingClientRect().left - header.getBoundingClientRect().left);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [hasFeatureLinks, featuresOpen]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md [transform:translateZ(0)]"
    >
      <div className={`${NARROW} flex h-14 items-center justify-between gap-3 sm:h-16`}>
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-1.5 text-lg font-semibold tracking-tight sm:text-xl"
        >
          <LogoIcon className="h-7 w-7 sm:h-8 sm:w-8" />
          {texts.logo}
        </Link>
        <nav className="mr-auto hidden items-stretch gap-6 pl-8 text-sm font-semibold sm:flex">
          {hasFeatureLinks ? (
            <div
              ref={triggerRef}
              className="flex cursor-pointer items-center"
              onMouseEnter={openFeatures}
              onMouseLeave={closeFeaturesSoon}
            >
              <button
                type="button"
                aria-expanded={featuresOpen}
                onClick={() => setFeaturesOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-1 transition-opacity hover:opacity-70"
              >
                {texts.features}
                <ChevronDown className="h-3.5 w-3.5 text-hint" />
              </button>
            </div>
          ) : (
            <Link href={`${homeHref}#features`} className="transition-opacity hover:opacity-70">
              {texts.features}
            </Link>
          )}
          <Link href="/pricing" className="transition-opacity hover:opacity-70">
            {texts.pricing}
          </Link>
          <InstallAppButton label={texts.mobileApp} className="transition-opacity hover:opacity-70" />
        </nav>
        {signedIn ? (
          <button
            onClick={logout}
            className="hidden shrink-0 text-sm font-semibold transition-opacity hover:opacity-70 sm:inline-flex"
          >
            {texts.logOut}
          </button>
        ) : (
          <a
            href="/api/auth/google/start"
            className="hidden shrink-0 text-sm font-semibold transition-opacity hover:opacity-70 sm:inline-flex"
          >
            {texts.signIn}
          </a>
        )}
        <Link
          href={`${homeHref}#app`}
          className={`hidden h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] sm:inline-flex ${PRIMARY_FILL}`}
        >
          {texts.tryItNow}
        </Link>

        {/* Mobile burger — the nav row above is sm:flex only, so small
            screens need their own way into features/pricing/faq/auth. */}
        <div className="relative sm:hidden" ref={menuRef}>
          <button
            type="button"
            aria-label={texts.features}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-card"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 flex min-w-[220px] flex-col rounded-2xl border border-border bg-bg p-2 shadow-xl">
              {hasFeatureLinks
                ? links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-70"
                      onClick={() => setMenuOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))
                : (
                  <Link
                    href={`${homeHref}#features`}
                    className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-70"
                    onClick={() => setMenuOpen(false)}
                  >
                    {texts.features}
                  </Link>
                )}
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-70"
                onClick={() => setMenuOpen(false)}
              >
                {texts.pricing}
              </Link>
              <InstallAppButton
                label={texts.mobileApp}
                className="rounded-lg px-3 py-2 text-left text-sm font-semibold transition-opacity hover:opacity-70"
                onClick={() => setMenuOpen(false)}
              />
              {signedIn ? (
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2 text-left text-sm font-semibold transition-opacity hover:opacity-70"
                >
                  {texts.logOut}
                </button>
              ) : (
                <a
                  href="/api/auth/google/start"
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-70"
                  onClick={() => setMenuOpen(false)}
                >
                  {texts.signIn}
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Sibling of the header's inner row (not of the trigger), so `top-full`
          is measured off the header's own box and `left` still opens the
          panel directly under "Features". 1px gap so the header's own
          bottom border stays visible as its own hairline instead of the
          panel's shadow fusing straight onto it — still grows out of the
          bar, not a separate floating card (no top border, rounded only at
          the bottom). Solid bg, no blur: the header above already runs its
          own backdrop-blur, and a second backdrop-filter nested inside it
          has nothing left to sample — it renders as flat, near-invisible
          transparency instead of a frosted panel. */}
      {hasFeatureLinks && (
        <div
          onMouseEnter={openFeatures}
          onMouseLeave={closeFeaturesSoon}
          style={{ left: featuresLeft }}
          className={`absolute top-full mt-px hidden min-w-[220px] flex-col rounded-b-2xl border-x border-b border-border bg-bg py-2 shadow-xl transition-all duration-200 sm:flex ${
            featuresOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
          }`}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
              onClick={() => setFeaturesOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
