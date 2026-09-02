import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppPage } from "../../_landing/AppPage";
import { PAIR_COOKIE, parsePairCookie } from "@/lib/cookies";
import { SITE_URL } from "@/lib/site";
import { CHROME } from "@/content";

const chrome = CHROME.en;

// The workspace carries no SEO copy of its own — the locale home ranks for
// this, and an indexed near-duplicate of it would only compete.
export const metadata: Metadata = {
  title: chrome.meta.title,
  description: chrome.meta.description,
  // Hard-excluded from search: noindex is what actually removes a URL from the
  // index (a robots.txt Disallow would only stop the crawl — the URL can still
  // be listed, and the noindex would never be seen). nofollow on top since
  // every link here also exists on the indexable pages. Not in the sitemap.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: `${SITE_URL}/app` },
};

// Reading the pair cookie makes this route render per request instead of at
// build time — fine here: the page is noindex and has no cached SEO body.
export default async function EnAppPage() {
  const pair = parsePairCookie((await cookies()).get(PAIR_COOKIE)?.value);
  return <AppPage locale="en" texts={chrome} homeHref="/" pair={pair} />;
}
