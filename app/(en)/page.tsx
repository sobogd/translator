import type { Metadata } from "next";
import { getServerSessionEmail } from "@/lib/auth";
import { getServerQuota } from "@/lib/quota-server";
import { Landing } from "../_landing/Landing";
import { homeAlternates } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/site";
import type { TranslatorTexts } from "../_landing/types";
import textsJson from "./texts.json";

const texts = textsJson as TranslatorTexts;

export const metadata: Metadata = {
  title: texts.meta.title,
  description: texts.meta.description,
  alternates: { canonical: SITE_URL, languages: homeAlternates() },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: texts.footer.brand,
    locale: "en_US",
    title: texts.meta.ogTitle,
    description: texts.meta.ogDescription,
  },
  twitter: {
    card: "summary",
    title: texts.meta.twitterTitle,
    description: texts.meta.twitterDescription,
  },
};

export default async function EnHomePage() {
  const email = await getServerSessionEmail();
  const initialQuota = await getServerQuota();
  return (
    <Landing signedIn={!!email} initialQuota={initialQuota} locale="en" texts={texts} homeHref="/" pathname="/" />
  );
}
