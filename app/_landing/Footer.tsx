import { NARROW } from "./shell";
import { locales, defaultLocale, type Locale } from "@/lib/locales";
import { swapLocale, localizedFeatureLinks, type FeatureLinkDef } from "@/lib/locale-slug-overrides";

type FooterTexts = {
  tagline: string;
  brand: string;
  featuresHeading?: string;
  featureLinks?: FeatureLinkDef[];
};

const DEFAULT_TEXTS: FooterTexts = {
  tagline: "Instant voice translation, 186 languages",
  brand: "IQ Translate",
  featuresHeading: "Features",
  featureLinks: [
    { routeKey: "/text-translator", label: "Text translator" },
    { routeKey: "/instant-voice-translator", label: "Voice translator" },
  ],
};

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
  const otherLocale = locales.find((l) => l !== locale) ?? locale;
  const featureLinks = localizedFeatureLinks(locale, texts.featureLinks ?? []);

  return (
    <footer className="border-t border-border py-8">
      <div className={`${NARROW} flex flex-col gap-6`}>
        {featureLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{texts.featuresHeading ?? "Features"}</p>
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
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-hint sm:flex-row">
          <span>{`© ${new Date().getFullYear()} ${texts.brand}`}</span>
          <span>{texts.tagline}</span>
          <a
            href={swapLocale(pathname, otherLocale)}
            className="shrink-0 uppercase tracking-wide transition hover:text-text"
          >
            {otherLocale}
          </a>
        </div>
      </div>
    </footer>
  );
}
