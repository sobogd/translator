import type { MetadataRoute } from "next";
import { locales } from "@/lib/locales";
import { localeHome } from "@/lib/locale-paths";
import { homeAlternates } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/site";

// Fixed snapshot date, not `new Date()` — matches iq-rest's convention of not
// faking freshness on every deploy. Bump when the home page copy changes.
const HOME_LAST_MODIFIED = "2026-09-01";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = homeAlternates();
  return locales.map((locale) => ({
    url: `${SITE_URL}${localeHome(locale)}`,
    lastModified: HOME_LAST_MODIFIED,
    changeFrequency: "weekly",
    priority: locale === "en" ? 1 : 0.9,
    alternates: { languages },
  }));
}
