import { NARROW } from "./shell";
import { defaultLocale, type Locale } from "@/lib/locales";
import { localeSwitchHref, localizedFeatureLinks, type FeatureLinkDef } from "@/lib/locale-slug-overrides";
import { READY_LOCALES } from "@/content";
import { getLanguage } from "@/lib/languages";

type FooterTexts = {
  tagline: string;
  brand: string;
  featuresHeading?: string;
  featureLinks?: FeatureLinkDef[];
  languagesHeading?: string;
};

const DEFAULT_TEXTS: FooterTexts = {
  tagline: "Instant voice translation, 186 languages",
  brand: "IQ Translate",
  featuresHeading: "Features",
  featureLinks: [{ routeKey: "/", label: "All 186 languages" }],
  languagesHeading: "Languages",
};

// Same label style as the Topics heading in the translator widget — uppercase,
// muted, tracked-out.
const SECTION_HEADING = "text-xs font-semibold uppercase tracking-wide text-hint";

// `locale`/`pathname`/`texts` default to English/home so the not-yet-localized
// /pricing page can keep calling <Footer /> unchanged.
//
// Same 1:1 logic as iq-rest's LandingFooter: a features column (heading +
// link list, derived from the shared route-key slug mapping so it never
// points at a stale locale slug) sits above the copyright/tagline/language
// row — scaled down to this app's 2 feature pages (no legal/currency rows,
// which don't exist here).
export function Footer({
  locale = defaultLocale,
  pathname = "/",
  texts = DEFAULT_TEXTS,
}: {
  locale?: Locale;
  pathname?: string;
  texts?: FooterTexts;
}) {
  const featureLinks = localizedFeatureLinks(locale, texts.featureLinks ?? []);

  return (
    <footer className="border-t border-border py-8">
      <div className={`${NARROW} flex flex-col gap-6`}>
        {featureLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className={SECTION_HEADING}>{texts.featuresHeading ?? "Features"}</p>
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              {featureLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm text-hint transition-colors hover:text-text"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        )}
        {/* Locale switcher: every shipped locale's home (or the registered
            translation of the current feature route). Doubles as internal
            linking to the localized homes. */}
        <div className="flex flex-col gap-2">
          <p className={SECTION_HEADING}>{texts.languagesHeading ?? "Languages"}</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {READY_LOCALES.map((l) =>
              l === locale ? (
                <span key={l} className="text-sm font-semibold text-text">
                  {getLanguage(l)?.nameNative ?? l}
                </span>
              ) : (
                <a
                  key={l}
                  href={localeSwitchHref(pathname, locale, l)}
                  className="text-sm text-hint transition-colors hover:text-text"
                >
                  {getLanguage(l)?.nameNative ?? l}
                </a>
              ),
            )}
          </nav>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-hint sm:flex-row">
          <span>{`© ${new Date().getFullYear()} ${texts.brand}`}</span>
          <span>{texts.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
