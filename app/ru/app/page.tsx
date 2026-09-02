import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppPage } from "../../_landing/AppPage";
import { PAIR_COOKIE, parsePairCookie } from "@/lib/cookies";
import { SITE_URL } from "@/lib/site";
import textsJson from "../texts.json";
import type { TranslatorTexts } from "../../_landing/types";

const texts = textsJson as TranslatorTexts;

export const metadata: Metadata = {
  title: texts.meta.title,
  description: texts.meta.description,
  // Hard-excluded from search: noindex is what actually removes a URL from the
  // index (a robots.txt Disallow would only stop the crawl — the URL can still
  // be listed, and the noindex would never be seen). nofollow on top since
  // every link here also exists on the indexable pages. Not in the sitemap.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: `${SITE_URL}/ru/app` },
};

export default async function RuAppPage() {
  const pair = parsePairCookie((await cookies()).get(PAIR_COOKIE)?.value);
  return <AppPage locale="ru" texts={texts} homeHref="/ru" pair={pair} />;
}
