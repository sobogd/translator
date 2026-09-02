import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSessionEmail } from "@/lib/auth";
import type { Locale } from "@/lib/locales";
import { SITE_URL } from "@/lib/site";
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
  return {
    title: chrome.pricing.meta.title,
    description: chrome.pricing.meta.description,
    alternates: { canonical: `${SITE_URL}/${seg}/pricing` },
  };
}

export default async function LocalePricingPage({ params }: { params: Promise<{ seg: string }> }) {
  const { seg } = await params;
  const chrome = CHROME[seg];
  if (!chrome) notFound();
  const email = await getServerSessionEmail();
  return <PricingPage signedIn={!!email} locale={seg as Locale} chrome={chrome} />;
}
