import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { PAIR_COOKIE, parsePairCookie } from "@/lib/cookies";
import { SITE_URL } from "@/lib/site";
import { CHROME, READY_LOCALES } from "@/content";
import { AppPage } from "../../_landing/AppPage";

// /<locale>/app for every locale except en and ru, which own their static
// routes under (en)/ and ru/. The static "app" segment wins over [pair].
export const dynamicParams = false;

export function generateStaticParams() {
  return READY_LOCALES.filter((l) => l !== "en" && l !== "ru").map((seg) => ({ seg }));
}

export async function generateMetadata({ params }: { params: Promise<{ seg: string }> }): Promise<Metadata> {
  const { seg } = await params;
  const chrome = CHROME[seg];
  if (!chrome) return {};
  return {
    title: chrome.meta.title,
    description: chrome.meta.description,
    // Hard-excluded from search: noindex is what actually removes a URL from
    // the index (a robots.txt Disallow would only stop the crawl — the URL can
    // still be listed, and the noindex would never be seen). nofollow on top
    // since every link here also exists on the indexable pages. Not in the
    // sitemap either.
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    alternates: { canonical: `${SITE_URL}/${seg}/app` },
  };
}

export default async function LocaleAppPage({ params }: { params: Promise<{ seg: string }> }) {
  const { seg } = await params;
  const chrome = CHROME[seg];
  if (!chrome) notFound();
  const pair = parsePairCookie((await cookies()).get(PAIR_COOKIE)?.value);
  return <AppPage locale={seg as Locale} texts={chrome} homeHref={`/${seg}`} pair={pair} />;
}
