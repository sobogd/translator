import type { Metadata } from "next";
import { PricingPage } from "../../_landing/PricingPage";
import { pricingAlternates } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/site";
import { CHROME } from "@/content";

const chrome = CHROME.en;

export const metadata: Metadata = {
  title: chrome.pricing.meta.title,
  description: chrome.pricing.meta.description,
  alternates: { canonical: `${SITE_URL}/pricing`, languages: pricingAlternates() },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pricing`,
    siteName: chrome.footer.brand,
    locale: "en_US",
    title: chrome.pricing.meta.title,
    description: chrome.pricing.meta.description,
  },
};

export default function EnPricingPage() {
  return <PricingPage locale="en" chrome={chrome} />;
}
