import type { MetadataRoute } from "next";
import { localeHome, localePath } from "@/lib/locale-paths";
import { homeAlternates, featureAlternates, pricingAlternates } from "@/lib/hreflang";
import { LOCALE_SLUG_OVERRIDES } from "@/lib/locale-slug-overrides";
import { PAIRS } from "@/lib/pairs";
import { PAIR_CONTENT, READY_LOCALES, CHROME } from "@/content";
import { SITE_URL } from "@/lib/site";

// Fixed snapshot date, not `new Date()` — matches iq-rest's convention of not
// faking freshness on every deploy. Bump when the home page copy changes.
const HOME_LAST_MODIFIED = "2026-09-01";
const FEATURE_LAST_MODIFIED = "2026-09-01";
const PAIR_LAST_MODIFIED = "2026-09-01";
const PRICING_LAST_MODIFIED = "2026-09-02";
const LEGAL_LAST_MODIFIED = "2026-09-02";

// Same form as the canonical tags: the English home is SITE_URL with no
// trailing slash, so the sitemap must not advertise a second, slashed variant.
const url = (locale: string, slug?: string) =>
  slug ? `${SITE_URL}${localePath(locale, slug)}` : `${SITE_URL}${localeHome(locale)}`.replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const homeLanguages = homeAlternates();
  const homeEntries: MetadataRoute.Sitemap = READY_LOCALES.map((locale) => ({
    url: url(locale),
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
        url: url(locale, slugMap[locale]),
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
    url: url(p.locale, p.slug),
    lastModified: PAIR_LAST_MODIFIED,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // One /pricing per shipped locale, gated the same way app/[seg]/pricing
  // gates its static params.
  const pricingLanguages = pricingAlternates();
  const pricingEntries: MetadataRoute.Sitemap = READY_LOCALES.filter((l) => CHROME[l]?.pricing).map(
    (locale) => ({
      url: url(locale, "pricing"),
      lastModified: PRICING_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      alternates: { languages: pricingLanguages },
    }),
  );

  // English-only legal pages (app/(en)/privacy, app/(en)/terms).
  const legalEntries: MetadataRoute.Sitemap = ["privacy", "terms"].map((slug) => ({
    url: url("en", slug),
    lastModified: LEGAL_LAST_MODIFIED,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [...homeEntries, ...featureEntries, ...pairEntries, ...pricingEntries, ...legalEntries];
}
