import type { Metadata } from "next";
import type { FeatureContent } from "@/app/_landing/types";
import { featureAlternates, routeKeyFromCanonical } from "./hreflang";
import { SITE_URL } from "./site";

// Mirrors iq-rest's build-feature-metadata.ts so every feature page emits
// identical metadata structure without repeating boilerplate per page.tsx.
export function buildFeatureMetadata(content: FeatureContent): Metadata {
  const routeKey = routeKeyFromCanonical(content.meta.canonical);
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
      images: [{ url: "/icon-512.png", width: 512, height: 512, alt: content.meta.ogTitle }],
    },
    twitter: {
      card: "summary",
      title: content.meta.ogTitle,
      description: content.meta.ogDescription,
    },
  };
}
