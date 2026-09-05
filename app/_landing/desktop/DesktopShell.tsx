import type { ReactNode } from "react";
import Link from "next/link";
import { Taskbar } from "./Taskbar";
import type { AccountTexts, TaskbarTexts } from "./taskbar-texts";
import { AppWindow } from "./AppWindow";
import { LogoIcon } from "../LogoIcon";
import { localizedFeatureLinks, type FeatureLinkDef } from "@/lib/locale-slug-overrides";
import type { Locale } from "@/lib/locales";

// The PostHog desktop: the fixed wallpaper lives at the layout level
// (DesktopChrome in the locale layouts), so it survives navigation. This shell
// stacks the floating glass taskbar "island" on top and the page's content
// inside a window that scrolls internally — mirrored 1:1 from iq-mermaid's
// DesktopShell, minus the editor reveal (the window is never closable here: the
// translator widget is embedded at the top of the window's content instead).
export function DesktopShell({
  headerTexts,
  locale,
  homeHref,
  accountTexts,
  pricingHref,
  /** The locale's "features" links (language pairs + the catch-all "/" row),
   *  shown in the header's Features menu (previously the footer's list). */
  featureLinks = [],
  /** The fixed translator block pinned at the top of the window. Rendered on
   *  every page the same way, above the scrollable content. */
  product,
  showBrand = false,
  children,
}: {
  headerTexts: TaskbarTexts;
  locale: Locale;
  homeHref: string;
  accountTexts?: AccountTexts;
  pricingHref?: string;
  featureLinks?: FeatureLinkDef[];
  product?: ReactNode;
  /** Whether the content window leads with the brand row (icon + word). Only
   *  the home page shows it — inner pages start with their own heading. */
  showBrand?: boolean;
  children: ReactNode;
}) {
  const links = localizedFeatureLinks(locale, featureLinks);
  const pairLinks = links.filter((l) => l.routeKey !== "/");
  const anyLanguage = links.find((l) => l.routeKey === "/") ?? {
    href: homeHref,
    label: headerTexts.features,
    routeKey: "/",
  };

  return (
    <div className="pointer-events-none relative flex h-dvh flex-col overflow-hidden">
      {/* Floating island taskbar, above the wallpaper. */}
      <div className="pointer-events-auto relative z-30">
        <Taskbar
          homeHref={homeHref}
          locale={locale}
          texts={headerTexts}
          accountTexts={accountTexts}
          pricingHref={pricingHref}
          pairLinks={pairLinks}
          anyLanguage={anyLanguage}
        />
      </div>

      {/* The desktop canvas the window floats in. It is the page's <main>: the
          actual content is what the window shows, while the floating taskbar
          above stays a sibling <header> landmark. The window fills the canvas
          edge to edge below the header (constant 64px of chrome), so the
          two-part scroll inside it can size its halves from the viewport. */}
      <main className="pointer-events-none relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-6 sm:pb-2">
        <div className="pointer-events-none h-full w-full max-w-[1000px]">
          <AppWindow product={product}>
            {/* The full brand mark (icon + word) lives at the top of the home
                window content, as PostHog does — the taskbar above keeps only
                the small rounded "IQ" square. Inner pages don't repeat it. */}
            {showBrand && (
              <div className="flex items-center gap-1.5 px-6 pt-6 sm:px-8">
                <Link
                  href={homeHref}
                  className="inline-flex shrink-0 items-center gap-1.5 text-lg font-semibold tracking-tight sm:text-xl"
                  aria-label={headerTexts.logo}
                >
                  <LogoIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                  {headerTexts.logo}
                </Link>
              </div>
            )}
            {children}
          </AppWindow>
        </div>
      </main>
    </div>
  );
}
