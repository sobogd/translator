import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/locales";
import { localePath } from "@/lib/locale-paths";
import { buildFeatureMetadata } from "@/lib/build-feature-metadata";
import { findPair } from "@/lib/pairs";
import { CHROME, PAIR_CONTENT } from "@/content";
import { FeatureLanding } from "../../_landing/FeatureLanding";

// Locale-prefixed pair pages, e.g. /ru/perevodchik-s-russkogo-na-angliyskiy.
// English pairs live at the root and are served by app/[seg]/page.tsx.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PAIR_CONTENT)
    .filter((k) => !k.startsWith("en/") && CHROME[k.split("/")[0]])
    .map((k) => {
      const [seg, pair] = k.split("/");
      return { seg, pair };
    });
}

export async function generateMetadata({ params }: { params: Promise<{ seg: string; pair: string }> }): Promise<Metadata> {
  const { seg, pair } = await params;
  const content = PAIR_CONTENT[`${seg}/${pair}`];
  return content ? buildFeatureMetadata(content, `/og/${seg}/${pair}.png`) : {};
}

export default async function LocalePairPage({ params }: { params: Promise<{ seg: string; pair: string }> }) {
  const { seg, pair } = await params;
  const def = findPair(seg, pair);
  const content = PAIR_CONTENT[`${seg}/${pair}`];
  const chrome = CHROME[seg];
  if (!def || !content || !chrome) notFound();
  return (
    <FeatureLanding
      locale={seg as Locale}
      chrome={chrome}
      content={content}
      icons="pair"
      pathname={localePath(seg, pair)}
      presetSource={def.from}
      presetTarget={def.to}
    />
  );
}
