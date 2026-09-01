import { locales } from "./locales";
import { localeHome, localePath } from "./locale-paths";

// Record<logicalRouteKey, Record<locale, slug>> — single source of truth for
// per-locale SEO slugs, mirroring iq-rest's lib/locale-slug-overrides.ts.
// Empty until the first SEO feature page ships; sitemap, hreflang and the
// footer locale switcher already read from this map so a future feature page
// only ever needs one registration, not a change in four places.
export const LOCALE_SLUG_OVERRIDES: Record<string, Record<string, string>> = {
  "/text-translator": { en: "text-translator", ru: "perevod-teksta-onlayn" },
  "/instant-voice-translator": { en: "instant-voice-translator", ru: "perevodchik-rechi-v-tekst" },
};

// Swaps the locale segment of a pathname, translating the slug through the
// map when the path belongs to a registered route. Falls back to a plain
// locale-prefix swap for anything not yet in the map (i.e. every path today).
export function swapLocale(pathname: string, targetLocale: string): string {
  const seg = pathname.split("/").filter(Boolean);
  const hasLocale = seg.length > 0 && (locales as readonly string[]).includes(seg[0]);
  const currentLocale = hasLocale ? seg[0] : "en";
  const restSegs = hasLocale ? seg.slice(1) : seg;

  if (restSegs.length === 0) return localeHome(targetLocale);

  const rest = `/${restSegs.join("/")}`;
  const routeKey = Object.entries(LOCALE_SLUG_OVERRIDES).find(
    ([, map]) => map[currentLocale] === rest,
  )?.[0];
  const targetSlug = routeKey ? (LOCALE_SLUG_OVERRIDES[routeKey][targetLocale] ?? routeKey) : rest;
  return localePath(targetLocale, targetSlug);
}
