import { locales } from "./locales";
import { localeHome, localePath } from "./locale-paths";

// Record<logicalRouteKey, Record<locale, slug>> — single source of truth for
// per-locale SEO slugs, mirroring iq-rest's lib/locale-slug-overrides.ts.
// Empty until the first SEO feature page ships; sitemap, hreflang and the
// footer locale switcher already read from this map so a future feature page
// only ever needs one registration, not a change in four places.
export const LOCALE_SLUG_OVERRIDES: Record<string, Record<string, string>> = {
  // Empty since 2026-09-02: the two original feature pages (text /
  // instant-voice) were removed in favour of the language-pair pages, which
  // are locale-unique and deliberately NOT registered here (no hreflang).
};

// Resolves a shared route key (e.g. "/text-translator") to its localized
// href for one locale, falling back to the key itself when unregistered.
export function featureHref(routeKey: string, locale: string): string {
  // "/" is the universal "all languages" link — the locale's home, where the
  // unrestricted translator lives.
  if (routeKey === "/") return localeHome(locale);
  const slug = LOCALE_SLUG_OVERRIDES[routeKey]?.[locale] ?? routeKey;
  return localePath(locale, slug);
}

export type FeatureLinkDef = { routeKey: string; label: string };

// Mirrors iq-rest's localizedFeatureLinks: header dropdown and footer column
// both render from the same `footer.featureLinks` (routeKey + label) list,
// so a page's copy never points at a stale slug for the other locale.
export function localizedFeatureLinks(
  locale: string,
  links: FeatureLinkDef[],
): { href: string; label: string }[] {
  return links.map((l) => ({ href: featureHref(l.routeKey, locale), label: l.label }));
}

// Safe locale-switcher href: home stays home, a registered feature route maps
// to its translated slug, and anything else (pair pages, /pricing) falls back
// to the target locale's home — never to an untranslated slug that would 404.
export function localeSwitchHref(pathname: string, locale: string, target: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const rest = (seg[0] === locale ? seg.slice(1) : seg).join("/");
  if (!rest) return localeHome(target);
  const routeKey = Object.entries(LOCALE_SLUG_OVERRIDES).find(([, m]) => m[locale] === rest)?.[0];
  const targetSlug = routeKey ? LOCALE_SLUG_OVERRIDES[routeKey][target] : undefined;
  return targetSlug ? localePath(target, targetSlug) : localeHome(target);
}

// Swaps the locale segment of a pathname, translating the slug through the
// map when the path belongs to a registered route. Falls back to a plain
// locale-prefix swap for anything not yet in the map (i.e. every path today).
export function swapLocale(pathname: string, targetLocale: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const hasLocale = seg.length > 0 && (locales as readonly string[]).includes(seg[0]);
  const currentLocale = hasLocale ? seg[0] : "en";
  const restSegs = hasLocale ? seg.slice(1) : seg;

  if (restSegs.length === 0) return localeHome(targetLocale);

  // Map values are stored without a leading slash (e.g. "text-translator"),
  // so compare against the un-prefixed path segment, not `rest` itself —
  // otherwise this never matches and every feature page falls through to
  // the raw-path fallback below (wrong slug on the target locale, 404).
  const restSlug = restSegs.join("/");
  const rest = `/${restSlug}`;
  const routeKey = Object.entries(LOCALE_SLUG_OVERRIDES).find(
    ([, map]) => map[currentLocale] === restSlug,
  )?.[0];
  const targetSlug = routeKey ? (LOCALE_SLUG_OVERRIDES[routeKey][targetLocale] ?? routeKey) : rest;
  return localePath(targetLocale, targetSlug);
}
