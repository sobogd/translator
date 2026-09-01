import type { Metadata } from "next";
import { getServerSessionEmail } from "@/lib/auth";
import { buildFeatureMetadata } from "@/lib/build-feature-metadata";
import { FeatureLanding } from "../../_landing/FeatureLanding";
import type { TranslatorTexts, FeatureContent } from "../../_landing/types";
import chromeJson from "../texts.json";
import contentJson from "./content.json";

const chrome = chromeJson as TranslatorTexts;
const content = contentJson as FeatureContent;

export const metadata: Metadata = buildFeatureMetadata(content);

export default async function PerevodchikRechiVTekstPage() {
  const email = await getServerSessionEmail();
  return (
    <FeatureLanding
      signedIn={!!email}
      locale="ru"
      chrome={chrome}
      content={content}
      icons="voice"
      pathname="/ru/perevodchik-rechi-v-tekst"
    />
  );
}
