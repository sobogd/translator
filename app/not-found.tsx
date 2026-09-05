import type { Metadata } from "next";
import Link from "next/link";
import { NARROW, PRIMARY_BTN, OUTLINE_BTN } from "./_landing/shell";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { PAIRS } from "@/lib/pairs";
import { PAIR_CONTENT, READY_LOCALES } from "@/content";
import { getLanguage } from "@/lib/languages";
import { localeHome } from "@/lib/locale-paths";

// This page owns its own <html>/<body>: the root layout deliberately renders
// bare children (each locale's layout supplies the document shell), and
// not-found renders under the ROOT layout, so without this the 404 has no
// document element at all.
//
// English-only on purpose. Next serves one root not-found for every unmatched
// path, and an unmatched path has no locale to read — /xx/whatever is not a
// locale we ship. The language list below is the way out for everyone else.

export const metadata: Metadata = {
  title: "Page not found — IQ Translate",
  // A 404 already carries the status code; the directive keeps it out of the
  // index if anything ever links to one.
  robots: { index: false, follow: true },
};

// A handful of the highest-intent English pairs, so the page is a way back
// into the site rather than a dead end.
const SUGGESTED = [
  "translate-english-to-spanish",
  "translate-english-to-french",
  "translate-english-to-german",
  "translate-spanish-to-english",
];

export default function NotFound() {
  const suggested = SUGGESTED.filter((slug) => PAIR_CONTENT[`en/${slug}`]).map((slug) => ({
    href: `/${slug}`,
    label: PAIRS.find((p) => p.locale === "en" && p.slug === slug)?.slug ?? slug,
  }));

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Resolved theme before first paint, like every locale shell. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <main className={`${NARROW} flex flex-1 flex-col justify-center gap-8 py-16`}>
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-hint">404</p>
            <h1 className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
              This page doesn&apos;t exist{" "}
              <span className="text-button">— the translator does</span>
            </h1>
            <p className="max-w-[62ch] text-[15px] leading-relaxed text-text/75 sm:text-base">
              The address you followed isn&apos;t a page here. Open the translator and speak or
              type in any of 186 languages, or jump straight to a language pair below.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/" className={PRIMARY_BTN}>
              Open the translator
            </Link>
            <Link href="/pricing" className={OUTLINE_BTN}>
              Pricing
            </Link>
          </div>

          {suggested.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-hint">
                Popular pairs
              </p>
              <nav className="flex flex-wrap gap-x-4 gap-y-2">
                {suggested.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="text-sm text-hint transition-colors hover:text-text"
                  >
                    {s.label.replace(/-/g, " ").replace(/^translate /, "")}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-hint">Languages</p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              {READY_LOCALES.map((l) => (
                <Link
                  key={l}
                  href={localeHome(l)}
                  className="text-sm text-hint transition-colors hover:text-text"
                >
                  {getLanguage(l)?.nameNative ?? l}
                </Link>
              ))}
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}
