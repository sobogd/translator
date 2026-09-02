import type { Metadata } from "next";
import { LegalPage } from "../../_landing/LegalPage";
import { LEGAL_UPDATED, OPERATOR, TERMS_SECTIONS } from "../../_landing/legal-content";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service | IQ Translate",
  description:
    "The rules for using IQ Translate: free allowance, subscriptions and billing, acceptable use, your content, and the limits of an automated translation.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/terms`,
    siteName: OPERATOR.service,
    locale: "en_US",
    title: "Terms of Service",
    description: "Free allowance, subscriptions and billing, acceptable use, and the limits of an automated translation.",
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro={`The agreement between you and ${OPERATOR.service} (${OPERATOR.site}) when you use the translator, with or without an account.`}
      sections={TERMS_SECTIONS}
      pathname="/terms"
    />
  );
}
