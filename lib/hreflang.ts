// Head-level hreflang alternates. Mirrors iq-rest's lib/hreflang.ts so the
// pattern ports over unchanged the day a feature page is added.
import { locales } from "./locales";
import { LOCALE_SLUG_OVERRIDES } from "./locale-slug-overrides";
import { localePath } from "./locale-paths";
import { SITE_URL } from "./site";

const homeUrl = (locale: string) => (locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`);

// Alternates for the per-locale home page. Identical map for every locale.
export function homeAlternates(): Record<string, string> {
  const languages: Record<string, string> = { "x-default": homeUrl("en") };
  locales.forEach((locale) => {
    languages[locale] = homeUrl(locale);
  });
  return languages;
}

// Alternates for a feature page, keyed by its shared route (e.g. "/translate-pdf").
// Unused until the first feature page exists — kept ready so that page's
// metadata builder can call it on day one without touching this file.
export function featureAlternates(routeKey: string): Record<string, string> {
  const overrideMap = LOCALE_SLUG_OVERRIDES[routeKey];
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    const slug = overrideMap?.[locale] ?? routeKey;
    languages[locale] = `${SITE_URL}${localePath(locale, slug)}`;
  });
  const enSlug = overrideMap?.en ?? routeKey;
  languages["x-default"] = `${SITE_URL}${localePath("en", enSlug)}`;
  return languages;
}

// Reverse-lookup the shared route key from a feature page's canonical URL.
export function routeKeyFromCanonical(canonical: string): string | undefined {
  let path = canonical.replace(SITE_URL, "").replace(/\/$/, "");
  const seg = path.match(/^\/([a-z]{2})(\/|$)/);
  if (seg && (locales as readonly string[]).includes(seg[1])) {
    path = path.slice(seg[1].length + 1);
  }
  const found = Object.entries(LOCALE_SLUG_OVERRIDES).find(([, m]) => Object.values(m).includes(path));
  return found?.[0];
}
