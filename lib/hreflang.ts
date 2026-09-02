// Head-level hreflang alternates. Mirrors iq-rest's lib/hreflang.ts so the
// pattern ports over unchanged the day a feature page is added.
import { locales } from "./locales";
import { LOCALE_SLUG_OVERRIDES } from "./locale-slug-overrides";
import { localePath } from "./locale-paths";
import { SITE_URL } from "./site";
import { READY_LOCALES } from "@/content";

const homeUrl = (locale: string) => (locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`);

// Alternates for the per-locale home page. Identical map for every locale.
// Gated on READY_LOCALES so a mid-rollout build never advertises a 404 home.
export function homeAlternates(): Record<string, string> {
  const languages: Record<string, string> = { "x-default": homeUrl("en") };
  locales.forEach((locale) => {
    if (READY_LOCALES.includes(locale)) languages[locale] = homeUrl(locale);
  });
  return languages;
}

// Alternates for a feature page, keyed by its shared route (e.g. "/translate-pdf").
// Only locales explicitly registered in LOCALE_SLUG_OVERRIDES get an
// alternate — an unregistered locale has no such page, and a fallback URL
// would 404.
export function featureAlternates(routeKey: string): Record<string, string> {
  const overrideMap = LOCALE_SLUG_OVERRIDES[routeKey] ?? {};
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    const slug = overrideMap[locale];
    if (slug) languages[locale] = `${SITE_URL}${localePath(locale, slug)}`;
  });
  if (overrideMap.en) languages["x-default"] = `${SITE_URL}${localePath("en", overrideMap.en)}`;
  return languages;
}

// Reverse-lookup the shared route key from a feature page's canonical URL.
export function routeKeyFromCanonical(canonical: string): string | undefined {
  let path = canonical.replace(SITE_URL, "").replace(/\/$/, "");
  const seg = path.match(/^\/([a-z]{2})(\/|$)/);
  if (seg && (locales as readonly string[]).includes(seg[1])) {
    path = path.slice(seg[1].length + 1);
  }
  // Map values are stored without a leading slash (e.g. "text-translator"),
  // so strip it from `path` before comparing — otherwise this never matches
  // and every feature page silently loses its hreflang alternates.
  const slug = path.startsWith("/") ? path.slice(1) : path;
  const found = Object.entries(LOCALE_SLUG_OVERRIDES).find(([, m]) => Object.values(m).includes(slug));
  return found?.[0];
}
