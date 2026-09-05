import type { Metadata } from "next";
import { LegalPage } from "../../_landing/LegalPage";
import { OPERATOR, PRIVACY_SECTIONS, PRIVACY_TITLE } from "../../_landing/legal-content";
import { OG_IMAGE, SITE_URL, TWITTER_CARD } from "@/lib/site";

export const metadata: Metadata = {
  title: `${PRIVACY_TITLE} | IQ Translate`,
  description:
    "What IQ Translate collects, what happens to your voice recordings and translations, who processes them, how long they are kept, and how to have them deleted.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/privacy`,
    siteName: OPERATOR.brand,
    locale: "en_US",
    title: PRIVACY_TITLE,
    description: "What we collect, who processes it, how long we keep it, and how to have it deleted.",
    images: [OG_IMAGE],
  },
  twitter: {
    ...TWITTER_CARD,
    title: PRIVACY_TITLE,
    description: "What we collect, who processes it, how long we keep it, and how to have it deleted.",
  },
};

export default function PrivacyPage() {
  return <LegalPage title={PRIVACY_TITLE} sections={PRIVACY_SECTIONS} />;
}
