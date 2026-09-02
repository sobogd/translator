import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { pricingAlternates } from "@/lib/hreflang";
import { OG_LOCALES } from "@/lib/og-locales";
import { OG_IMAGE, SITE_URL, TWITTER_CARD } from "@/lib/site";
import { CHROME, READY_LOCALES } from "@/content";
import { PricingPage } from "../../_landing/PricingPage";

// Localized /<locale>/pricing for every locale except en (which lives at the
// static /pricing route). The static "pricing" segment wins over [pair].
export const dynamicParams = false;

export function generateStaticParams() {
  // Gated on the pricing section actually existing so a mid-rollout build
  // (some locales not yet translated) skips them instead of crashing.
  return READY_LOCALES.filter((l) => l !== "en" && CHROME[l]?.pricing).map((seg) => ({ seg }));
}

export async function generateMetadata({ params }: { params: Promise<{ seg: string }> }): Promise<Metadata> {
  const { seg } = await params;
  const chrome = CHROME[seg];
  if (!chrome) return {};
  const url = `${SITE_URL}/${seg}/pricing`;
  return {
    title: chrome.pricing.meta.title,
    description: chrome.pricing.meta.description,
    alternates: { canonical: url, languages: pricingAlternates() },
    openGraph: {
      type: "website",
      url,
      siteName: chrome.footer.brand,
      locale: OG_LOCALES[seg],
      title: chrome.pricing.meta.title,
      description: chrome.pricing.meta.description,
      images: [OG_IMAGE],
    },
    twitter: {
      ...TWITTER_CARD,
      title: chrome.pricing.meta.title,
      description: chrome.pricing.meta.description,
    },
  };
}

export default async function LocalePricingPage({ params }: { params: Promise<{ seg: string }> }) {
  const { seg } = await params;
  const chrome = CHROME[seg];
  if (!chrome) notFound();
  return <PricingPage locale={seg as Locale} chrome={chrome} />;
}
