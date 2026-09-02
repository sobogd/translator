import type { MetadataRoute } from "next";
import { localeHome, localePath } from "@/lib/locale-paths";
import { homeAlternates, featureAlternates } from "@/lib/hreflang";
import { LOCALE_SLUG_OVERRIDES } from "@/lib/locale-slug-overrides";
import { PAIRS } from "@/lib/pairs";
import { PAIR_CONTENT, READY_LOCALES } from "@/content";
import { SITE_URL } from "@/lib/site";

// Fixed snapshot date, not `new Date()` — matches iq-rest's convention of not
// faking freshness on every deploy. Bump when the home page copy changes.
const HOME_LAST_MODIFIED = "2026-09-01";
const FEATURE_LAST_MODIFIED = "2026-09-01";
const PAIR_LAST_MODIFIED = "2026-09-01";

export default function sitemap(): MetadataRoute.Sitemap {
  const homeLanguages = homeAlternates();
  const homeEntries: MetadataRoute.Sitemap = READY_LOCALES.map((locale) => ({
    url: `${SITE_URL}${localeHome(locale)}`,
    lastModified: HOME_LAST_MODIFIED,
    changeFrequency: "weekly",
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages: homeLanguages },
  }));

  const featureEntries: MetadataRoute.Sitemap = Object.keys(LOCALE_SLUG_OVERRIDES).flatMap(
    (routeKey) => {
      const slugMap = LOCALE_SLUG_OVERRIDES[routeKey];
      const languages = featureAlternates(routeKey);
      return Object.keys(slugMap).map((locale) => ({
        url: `${SITE_URL}${localePath(locale, slugMap[locale])}`,
        lastModified: FEATURE_LAST_MODIFIED,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: { languages },
      }));
    },
  );

  // Pair pages are locale-unique (no hreflang alternates) and only enter the
  // sitemap once their content JSON has shipped.
  const pairEntries: MetadataRoute.Sitemap = PAIRS.filter(
    (p) => PAIR_CONTENT[`${p.locale}/${p.slug}`],
  ).map((p) => ({
    url: `${SITE_URL}${localePath(p.locale, p.slug)}`,
    lastModified: PAIR_LAST_MODIFIED,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...homeEntries, ...featureEntries, ...pairEntries];
}
