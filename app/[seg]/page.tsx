import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSessionEmail } from "@/lib/auth";
import { getServerQuota } from "@/lib/quota-server";
import { locales, type Locale } from "@/lib/locales";
import { localeHome } from "@/lib/locale-paths";
import { homeAlternates } from "@/lib/hreflang";
import { buildFeatureMetadata } from "@/lib/build-feature-metadata";
import { OG_LOCALES } from "@/lib/og-locales";
import { SITE_URL } from "@/lib/site";
import { findPair } from "@/lib/pairs";
import { CHROME, PAIR_CONTENT, READY_LOCALES } from "@/content";
import { Landing } from "../_landing/Landing";
import { FeatureLanding } from "../_landing/FeatureLanding";

// One dynamic segment, two page kinds (Next forbids sibling [locale] and
// [pairSlug] dirs at the same level, so both share this route):
//  - /<locale>       → generated locale home (en and ru keep their static routes)
//  - /<en-pair-slug> → an English pair page at the root, e.g. /translate-english-to-spanish
export const dynamicParams = false;

const isReadyLocale = (seg: string): seg is Locale =>
  seg !== "en" && seg !== "ru" && (locales as readonly string[]).includes(seg) && READY_LOCALES.includes(seg);

export function generateStaticParams() {
  const homes = READY_LOCALES.filter((l) => l !== "en" && l !== "ru").map((seg) => ({ seg }));
  const enPairs = Object.keys(PAIR_CONTENT)
    .filter((k) => k.startsWith("en/"))
    .map((k) => ({ seg: k.slice(3) }));
  return [...homes, ...enPairs];
}

export async function generateMetadata({ params }: { params: Promise<{ seg: string }> }): Promise<Metadata> {
  const { seg } = await params;
  if (isReadyLocale(seg)) {
    const texts = CHROME[seg];
    return {
      title: texts.meta.title,
      description: texts.meta.description,
      alternates: { canonical: `${SITE_URL}${localeHome(seg)}`, languages: homeAlternates() },
      openGraph: {
        type: "website",
        url: `${SITE_URL}${localeHome(seg)}`,
        siteName: texts.footer.brand,
        locale: OG_LOCALES[seg],
        title: texts.meta.ogTitle,
        description: texts.meta.ogDescription,
      },
      twitter: {
        card: "summary",
        title: texts.meta.twitterTitle,
        description: texts.meta.twitterDescription,
      },
    };
  }
  const content = PAIR_CONTENT[`en/${seg}`];
  return content ? buildFeatureMetadata(content) : {};
}

export default async function SegPage({ params }: { params: Promise<{ seg: string }> }) {
  const { seg } = await params;
  const email = await getServerSessionEmail();
  const initialQuota = await getServerQuota();

  if (isReadyLocale(seg)) {
    return (
      <Landing
        signedIn={!!email} initialQuota={initialQuota}
        locale={seg}
        texts={CHROME[seg]}
        homeHref={`/${seg}`}
        pathname={`/${seg}`}
      />
    );
  }

  const pair = findPair("en", seg);
  const content = PAIR_CONTENT[`en/${seg}`];
  if (!pair || !content) notFound();
  return (
    <FeatureLanding
      signedIn={!!email} initialQuota={initialQuota}
      locale="en"
      chrome={CHROME.en}
      content={content}
      icons="pair"
      pathname={`/${seg}`}
      presetSource={pair.from}
      presetTarget={pair.to}
    />
  );
}
