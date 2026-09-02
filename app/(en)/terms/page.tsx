import type { Metadata } from "next";
import { LegalPage } from "../../_landing/LegalPage";
import { OPERATOR, TERMS_SECTIONS, TERMS_TITLE } from "../../_landing/legal-content";
import { OG_IMAGE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: `${TERMS_TITLE} | IQ Translate`,
  description:
    "The rules for using IQ Translate: free allowance, subscriptions and billing, acceptable use, your content, and the limits of an automated translation.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/terms`,
    siteName: OPERATOR.brand,
    locale: "en_US",
    title: TERMS_TITLE,
    description: "Free allowance, subscriptions and billing, acceptable use, and the limits of an automated translation.",
    images: [OG_IMAGE],
  },
};

export default function TermsPage() {
  return <LegalPage title={TERMS_TITLE} sections={TERMS_SECTIONS} pathname="/terms" />;
}
