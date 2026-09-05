"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- the OAuth start route (/api/auth/google/start) must be a full document navigation */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Globe2,
  ShieldCheck,
  Monitor,
  Sun,
  Moon,
  Mic,
  Type,
  LogOut,
  ArrowRight,
  UserRound,
} from "lucide-react";
import { LogoIcon } from "../LogoIcon";
import { localePath } from "@/lib/locale-paths";
import { localeSwitchHref } from "@/lib/locale-slug-overrides";
import { getLanguage } from "@/lib/languages";
import { defaultLocale, locales, type Locale } from "@/lib/locales";
import { analytics } from "@/lib/analytics";
import { apiFetch } from "@/lib/client";
import { useSession } from "../session";
import { QuotaBadge } from "../AccountControls";
import { applyResolvedTheme, getThemeChoice, setThemeChoice, subscribeTheme, type ThemeChoice } from "@/lib/theme";
import {
  DEFAULT_ACCOUNT_TEXTS,
  DEFAULT_TEXTS,
  type AccountTexts,
  type TaskbarTexts,
} from "./taskbar-texts";

export type { AccountTexts, TaskbarTexts };

export type FeatureRow = { href: string; label: string; routeKey: string };

// Legal documents are English-only and sit at the root (/privacy, /terms) —
// every locale's menu links to the same two pages.
const LEGAL_LINKS = [
  { href: "/privacy", labelKey: "legalPrivacy" as const, track: "Header privacy" },
  { href: "/terms", labelKey: "legalTerms" as const, track: "Header terms" },
];

const THEME_OPTIONS: { key: ThemeChoice; icon: React.ReactNode }[] = [
  { key: "system", icon: <Monitor className="h-4 w-4" /> },
  { key: "light", icon: <Sun className="h-4 w-4" /> },
  { key: "dark", icon: <Moon className="h-4 w-4" /> },
];

const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export type MenuKind = "features" | "languages" | "legal" | "theme";

const MENU_ROWS: { kind: MenuKind; label: (t: TaskbarTexts) => string }[] = [
  { kind: "features", label: (t) => t.features },
  { kind: "languages", label: (t) => t.languages },
  { kind: "legal", label: (t) => t.legal },
  { kind: "theme", label: (t) => t.theme },
];

// PostHog's floating glass "island" taskbar: a capsule that floats over the
// wallpaper. Site navigation (language-pair features, languages, legal, theme)
// lives in the header now that the footer is gone; the right-edge red CTA
// brings the embedded translator widget back to the top of the content window.
export function Taskbar({
  homeHref = "/",
  locale = defaultLocale,
  texts = DEFAULT_TEXTS,
  accountTexts = DEFAULT_ACCOUNT_TEXTS,
  pricingHref,
  pairLinks = [],
  anyLanguage,
}: {
  homeHref?: string;
  locale?: Locale;
  texts?: TaskbarTexts;
  accountTexts?: AccountTexts;
  pricingHref?: string;
  /** The locale's language-pair links for the Features menu. */
  pairLinks?: FeatureRow[];
  /** The catch-all "translate to any language" row (routeKey "/"). */
  anyLanguage?: FeatureRow;
}) {
  const [openMenu, setOpenMenu] = useState<MenuKind | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSub, setMobileSub] = useState<MenuKind | null>(null);

  const { signedIn, quota, refreshQuota } = useSession();

  // The theme choice shown in the header's Theme menu, as an external store so
  // it stays in sync with lib/theme.ts without local state/effects.
  const subscribeThemes = useCallback((cb: () => void) => subscribeTheme(() => cb()), []);
  const theme = useSyncExternalStore(subscribeThemes, () => getThemeChoice(), () => "system");
  const pathname = usePathname();

  // Materialise the stored/system theme on <html> (the resolved attribute is
  // what the CSS actually reads). Live updates come through subscribeThemes.
  useEffect(() => {
    applyResolvedTheme();
  }, []);

  const isPaid = signedIn && quota?.kind === "account" && quota.plan !== "FREE";
  const nf = new Intl.NumberFormat(locale);

  async function openPortal() {
    analytics.track("Click", "Manage subscription");
    setPortalBusy(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        analytics.flush();
        window.location.href = data.url;
      }
    } finally {
      setPortalBusy(false);
    }
  }

  async function logout() {
    analytics.track("Click", "Log out");
    analytics.flush();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  function signIn() {
    analytics.track("Click", "Sign in with Google");
    analytics.flush();
  }

  const closeAll = () => {
    setOpenMenu(null);
    setAccountOpen(false);
    setMenuOpen(false);
    setMobileSub(null);
  };

  // Close any open desktop menu on outside press / Escape.
  useEffect(() => {
    if (!openMenu && !accountOpen) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest?.("#top")) return;
      setOpenMenu(null);
      setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, accountOpen]);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on outside press / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
      setMobileSub(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileSub(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // ---- shared row builders (rendered inside the desktop popovers and the
  // mobile menu's second level; `onDone` closes whichever surface owns them) ----

  const featuresContent = (onDone: () => void) => (
    <div className="flex flex-col">
      {pairLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          prefetch={false}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium leading-none transition-colors hover:bg-accent"
          onClick={() => {
            analytics.track("Click", `Header feature: ${l.routeKey}`);
            onDone();
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint">
            <Globe2 className="h-4 w-4" />
          </span>
          <span className="flex-1 truncate">{l.label}</span>
        </Link>
      ))}
      <div className="my-1 border-t border-border/60" />
      <Link
        href={anyLanguage?.href ?? homeHref}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium leading-none text-hint transition-colors hover:bg-accent hover:text-text"
        onClick={() => {
          analytics.track("Click", "Header feature: all languages");
          onDone();
        }}
      >
        <ArrowRight className="h-4 w-4 shrink-0" />
        <span className="flex-1">{anyLanguage?.label ?? texts.anyLanguageHint}</span>
      </Link>
    </div>
  );

  const languagesContent = (onDone: () => void) => (
    <ul className="flex max-h-[min(70vh,440px)] w-full flex-col overflow-y-auto">
      {locales.map((l) => {
        const active = l === locale;
        const name = getLanguage(l)?.nameNative ?? l;
        // Only registered routes translate across locales; everything else
        // (pair pages, pricing, English-only legal) falls back to the target
        // locale's home rather than a 404 slug (see localeSwitchHref).
        const href = active ? pathname : localeSwitchHref(pathname, locale, l);
        return (
          <li key={l}>
            {active ? (
              <span
                aria-current="true"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold leading-tight text-text"
              >
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="ml-auto h-1 w-1 shrink-0 rounded-full bg-button" aria-hidden="true" />
              </span>
            ) : (
              <Link
                href={href}
                prefetch={false}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-[13px] leading-tight text-hint transition-colors hover:bg-accent hover:text-text"
                onClick={() => {
                  analytics.track("Click", `Header language ${l}`);
                  onDone();
                }}
              >
                <span className="min-w-0 flex-1 truncate">{name}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  const legalContent = (onDone: () => void) => (
    <div className="flex flex-col">
      {LEGAL_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium leading-none transition-colors hover:bg-accent"
          onClick={() => {
            analytics.track("Click", l.track);
            onDone();
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="flex-1">{texts[l.labelKey]}</span>
        </Link>
      ))}
    </div>
  );

  const themeContent = (onDone: () => void) => (
    <div className="flex flex-col">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-pressed={theme === opt.key}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium leading-none transition-colors hover:bg-accent"
          onClick={() => {
            analytics.track("Click", `Header theme ${opt.key}`);
            setThemeChoice(opt.key);
            onDone();
          }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint">{opt.icon}</span>
          <span className="flex-1">
            {opt.key === "system" ? texts.themeSystem : opt.key === "light" ? texts.themeLight : texts.themeDark}
          </span>
          {theme === opt.key && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-button" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );

  const accountContent = (onDone: () => void) =>
    signedIn ? (
      <div className="flex w-full flex-col">
        <div className="flex flex-col gap-1 px-2 pb-2 pt-1">
          {quota?.email && <p className="truncate text-xs text-hint">{quota.email}</p>}
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-hint">{accountTexts.planLabel}</span>
            <span className="font-semibold leading-none">
              {isPaid ? (quota?.planName ?? quota?.plan) : accountTexts.freePlan}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-1.5 text-hint">
              <Mic className="h-3.5 w-3.5" /> {accountTexts.minutesLeft}
            </span>
            <span className="font-medium leading-none">{quota ? fmtSeconds(quota.seconds) : "…"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-1.5 text-hint">
              <Type className="h-3.5 w-3.5" /> {accountTexts.charsLeft}
            </span>
            <span className="font-medium leading-none">{quota ? nf.format(quota.chars) : "…"}</span>
          </div>
        </div>
        <div className="my-1 border-t border-border/60" />
        {isPaid ? (
          <button
            type="button"
            disabled={portalBusy}
            onClick={() => {
              closeAll();
              void openPortal();
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium leading-none transition-colors hover:bg-accent disabled:opacity-60"
          >
            <span className="flex-1">{accountTexts.manageSubscription}</span>
          </button>
        ) : (
          pricingHref && (
            <Link
              href={pricingHref}
              onClick={() => {
                analytics.track("Click", "Upgrade");
                analytics.flush();
                onDone();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium leading-none text-text transition-colors hover:bg-accent"
            >
              <span className="flex-1">{accountTexts.upgrade}</span>
              <ArrowRight className="h-4 w-4 text-hint" />
            </Link>
          )
        )}
        <button
          type="button"
          onClick={() => {
            closeAll();
            void logout();
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium leading-none text-text transition-colors hover:bg-accent"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint">
            <LogOut className="h-4 w-4" />
          </span>
          <span className="flex-1">{texts.logOut}</span>
        </button>
      </div>
    ) : (
      <div className="flex flex-col">
        <a
          href="/api/auth/google/start"
          onClick={signIn}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium leading-none transition-colors hover:bg-accent"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="flex-1">{texts.signIn}</span>
          <ArrowRight className="h-4 w-4 text-hint" />
        </a>
      </div>
    );

  const submenuTitle = (sub: MenuKind): string => {
    if (sub === "features") return texts.features;
    if (sub === "languages") return texts.languages;
    if (sub === "legal") return texts.legal;
    return texts.theme;
  };

  // ---- desktop trigger button for the nav menus ----
  const trigger = (kind: MenuKind, label: string) => (
    <button
      type="button"
      onClick={() => {
        const next = openMenu === kind ? null : kind;
        setOpenMenu(next);
        setAccountOpen(false);
        analytics.track("Click", `Header ${kind}`);
      }}
      aria-expanded={openMenu === kind}
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium leading-none transition-colors hover:bg-accent data-[state=open]:bg-accent"
    >
      {label}
      <ChevronDown className="h-3 w-3 opacity-60" />
    </button>
  );

  const menuByKind: Record<MenuKind, (onDone: () => void) => React.ReactNode> = {
    features: featuresContent,
    languages: languagesContent,
    legal: legalContent,
    theme: themeContent,
  };

  return (
    <header id="top" className="relative z-50 p-2 sm:p-2">
      <div className="taskbar-glass mx-auto flex h-10 w-full items-center justify-between gap-2 rounded-md px-2">
        {/* Brand mark: only the small rounded "IQ" square, no text. */}
        <Link
          href={homeHref}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-accent"
          aria-label={texts.logo}
          onClick={() => analytics.track("Click", "Header logo")}
        >
          <LogoIcon className="h-6 w-6" />
        </Link>

        {/* Mobile: the site menu sits right next to the logo, as a pill that
            opens the same menus the desktop bar uses. */}
        <div className="mr-auto flex items-center gap-1.5 sm:hidden">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={texts.menu}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => {
                analytics.track("Click", `Header menu ${menuOpen ? "close" : "open"}`);
                if (!menuOpen) setMobileSub(null);
                setMenuOpen((v) => !v);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-[13px] font-semibold leading-none text-text transition-colors hover:bg-accent data-[state=open]:bg-accent"
            >
              <span className="whitespace-nowrap">{texts.menu}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-text/60 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(75vh,560px)] w-64 max-w-[calc(100vw-3.5rem)] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-xl">
                {mobileSub ? (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] font-semibold leading-none text-text transition-colors hover:bg-accent"
                      onClick={() => setMobileSub(null)}
                    >
                      <ChevronLeft className="h-4 w-4 text-hint" />
                      <span>{submenuTitle(mobileSub)}</span>
                    </button>
                    <div className="my-1 border-t border-border/60" />
                    {menuByKind[mobileSub](() => {
                      setMenuOpen(false);
                      setMobileSub(null);
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {MENU_ROWS.map((row) => (
                      <button
                        key={row.kind}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-medium leading-none text-text transition-colors hover:bg-accent"
                        onClick={() => setMobileSub(row.kind)}
                      >
                        <span>{row.label(texts)}</span>
                        <ChevronRight className="h-4 w-4 text-hint" />
                      </button>
                    ))}
                    <Link
                      href={pricingHref ?? localePath(locale, "pricing")}
                      className="flex w-full items-center rounded-md px-2 py-2 text-sm font-medium leading-none text-text transition-colors hover:bg-accent"
                      onClick={() => {
                        analytics.track("Click", "Mobile menu pricing");
                        setMenuOpen(false);
                        setMobileSub(null);
                      }}
                    >
                      {texts.pricing}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop row: menu triggers first, Pricing at the end. Hidden below
            `sm` — on a phone these overflow the bar. */}
        <nav className="mr-auto hidden items-center gap-0.5 pl-2 text-[13px] font-medium leading-none sm:flex">
          {MENU_ROWS.map((row) => (
            <span key={row.kind} className="relative">
              {trigger(row.kind, row.label(texts))}
              {openMenu === row.kind && (
                <div
                  className={`absolute left-0 top-full mt-1 rounded-lg border border-border bg-card p-1.5 shadow-xl ${
                    row.kind === "languages" ? "w-64" : "w-[248px]"
                  }`}
                >
                  {menuByKind[row.kind](() => setOpenMenu(null))}
                </div>
              )}
            </span>
          ))}
          <Link
            href={pricingHref ?? localePath(locale, "pricing")}
            className="rounded py-1 pl-2 pr-2 transition-colors hover:bg-accent"
            onClick={() => analytics.track("Click", "Header pricing")}
          >
            {texts.pricing}
          </Link>
        </nav>

        {/* Remaining quota at a glance + Account as a context dropdown — on
            every size. The standalone "Translate" CTA is gone: the translator
            widget is already the always-present block on every page. */}
        <div className="ml-3 flex shrink-0 items-center gap-1.5">
          <QuotaBadge locale={locale} accountTexts={accountTexts} compact />
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                refreshQuota();
                setAccountOpen((v) => !v);
                setOpenMenu(null);
                analytics.track("Click", "Account menu");
              }}
              aria-label={texts.account}
              aria-expanded={accountOpen}
              title={texts.account}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text transition-colors hover:bg-accent active:scale-[0.99]"
            >
              <UserRound className="h-4 w-4" />
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-[248px] rounded-lg border border-border bg-card p-1.5 shadow-xl">
                {accountContent(() => setAccountOpen(false))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
