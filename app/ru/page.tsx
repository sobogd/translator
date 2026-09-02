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
  alternates: { canonical: `${SITE_URL}/ru`, languages: homeAlternates() },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/ru`,
    siteName: texts.footer.brand,
    locale: "ru_RU",
    title: texts.meta.ogTitle,
    description: texts.meta.ogDescription,
  },
  twitter: {
    title: texts.meta.twitterTitle,
    description: texts.meta.twitterDescription,
  },
};

export default function RuHomePage() {
  return <Landing locale="ru" texts={texts} homeHref="/ru" pathname="/ru" />;
}
