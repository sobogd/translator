import type { Metadata } from "next";
import type { FeatureContent } from "@/app/_landing/types";
import { featureAlternates, routeKeyFromCanonical } from "./hreflang";
import { OG_IMAGE, SITE_URL, TWITTER_CARD } from "./site";

// Mirrors iq-rest's build-feature-metadata.ts so every feature page emits
// identical metadata structure without repeating boilerplate per page.tsx.
/** `ogImagePath` is the pair page's own social card (public/og/<locale>/<slug>.png,
 *  see scripts/gen-og-pairs.py). Without it every one of the 259 URLs shared
 *  the same generic preview, so a link to a specific pair looked like a link
 *  to the home page. */
export function buildFeatureMetadata(content: FeatureContent, ogImagePath?: string): Metadata {
  const routeKey = routeKeyFromCanonical(content.meta.canonical);
  const image = ogImagePath
    ? { url: ogImagePath, width: 1200, height: 630, alt: content.meta.ogTitle }
    : { ...OG_IMAGE, alt: content.meta.ogTitle };
  const languages = routeKey ? featureAlternates(routeKey) : undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: content.meta.title,
    description: content.meta.description,
    alternates: { canonical: content.meta.canonical, ...(languages ? { languages } : {}) },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type: "website",
      url: content.meta.canonical,
      siteName: "IQ Translate",
      locale: content.meta.ogLocale,
      title: content.meta.ogTitle,
      description: content.meta.ogDescription,
      images: [image],
    },
    twitter: {
      ...TWITTER_CARD,
      images: [image.url],
      title: content.meta.ogTitle,
      description: content.meta.ogDescription,
    },
  };
}
