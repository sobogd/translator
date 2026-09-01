import { Mic, Volume2, Keyboard, Copy, Globe2, Languages, RefreshCw, History, FileText, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Translator } from "./Translator";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE } from "./shell";
import type { Locale } from "@/lib/locales";
import type { TranslatorTexts, FeatureContent } from "./types";

// Icon set for a feature page's 3 spotlight cards, keyed by which feature
// the page targets. Same positional-icon convention as the home page's
// Spotlights (icon choice lives in code, copy lives in content.json).
const SPOTLIGHT_ICONS: Record<string, LucideIcon[][]> = {
  text: [
    [FileText, Sparkles],
    [Keyboard, Copy],
    [Globe2, History],
  ],
  voice: [
    [Mic, Volume2],
    [Globe2, Languages],
    [RefreshCw, History],
  ],
};

// Shared template for every SEO feature page (text translator, voice
// translator, ...). Same section order as the home page's Landing.tsx minus
// StatCards (redundant with hero copy on a single-feature page) — mirrors
// iq-rest's FeatureLandingTemplate for digital-menu-for-restaurants.
export function FeatureLanding({
  signedIn,
  locale,
  chrome,
  content,
  icons,
  pathname,
}: {
  signedIn: boolean;
  locale: Locale;
  chrome: TranslatorTexts;
  content: FeatureContent;
  icons: "text" | "voice";
  pathname: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "IQ Translate",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    description: content.meta.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <main className={PAGE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header
        signedIn={signedIn}
        homeHref={locale === "en" ? "/" : `/${locale}`}
        locale={locale}
        texts={chrome.header}
        featureLinks={chrome.footer.featureLinks}
      />
      <Container>
        <Band id="app">
          <Translator texts={chrome} />
        </Band>
        <Band>
          <Hero texts={content.hero} />
        </Band>
        <Band id="features">
          <Spotlights items={content.spotlights} icons={SPOTLIGHT_ICONS[icons]} />
        </Band>
        <Band id="comparison">
          <Comparison texts={content.comparison} />
        </Band>
        <Band id="faq">
          <Faq
            heading={content.faq.heading}
            headingAccent={content.faq.headingAccent}
            sub={content.faq.sub}
            items={content.faq.items}
          />
        </Band>
        <Band>
          <FinalCta
            heading={content.finalCta.heading}
            headingAccent={content.finalCta.headingAccent}
            sub={content.finalCta.sub}
            ctaLabel={content.finalCta.ctaLabel}
          />
        </Band>
      </Container>
      <Footer locale={locale} pathname={pathname} texts={chrome.footer} />
    </main>
  );
}
