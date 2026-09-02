import type { Metadata } from "next";
import { getServerSessionEmail } from "@/lib/auth";
import { PricingPage } from "../_landing/PricingPage";
import { SITE_URL } from "@/lib/site";
import { CHROME } from "@/content";

const chrome = CHROME.en;

export const metadata: Metadata = {
  title: chrome.pricing.meta.title,
  description: chrome.pricing.meta.description,
  alternates: { canonical: `${SITE_URL}/pricing` },
};

export default async function EnPricingPage() {
  const email = await getServerSessionEmail();
  return <PricingPage signedIn={!!email} locale="en" chrome={chrome} />;
}
