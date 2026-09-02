import type { Metadata } from "next";
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
    title: texts.meta.twitterTitle,
    description: texts.meta.twitterDescription,
  },
};

// Statically prerendered, like every page here: quota, topics and the
// signed-in flag are resolved after hydration by SessionProvider.
export default function EnHomePage() {
  return <Landing locale="en" texts={texts} homeHref="/" pathname="/" />;
}
