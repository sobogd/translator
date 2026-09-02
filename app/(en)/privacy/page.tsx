import type { Metadata } from "next";
import { LegalPage } from "../../_landing/LegalPage";
import { LEGAL_UPDATED, OPERATOR, PRIVACY_SECTIONS } from "../../_landing/legal-content";
import { OG_IMAGE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy | IQ Translate",
  description:
    "What IQ Translate collects, what happens to your voice recordings and translations, who processes them, and how to have your data deleted.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/privacy`,
    siteName: OPERATOR.service,
    locale: "en_US",
    title: "Privacy Policy",
    description: "What we collect, who processes it, how long we keep it, and how to have it deleted.",
    images: [OG_IMAGE],
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro={`How ${OPERATOR.service} (${OPERATOR.site}) handles your data when you translate, sign in or subscribe.`}
      sections={PRIVACY_SECTIONS}
      pathname="/privacy"
    />
  );
}
