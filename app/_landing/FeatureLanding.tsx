import { Mic, Volume2, Keyboard, Copy, Globe2, Languages, RefreshCw, History, FileText, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Translator } from "./Translator";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { Breadcrumbs } from "./Breadcrumbs";
import { RelatedPairs } from "./RelatedPairs";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE } from "./shell";
import { localeHome, localePath } from "@/lib/locale-paths";
import { relatedPairs } from "@/lib/pairs";
import type { Locale } from "@/lib/locales";
import { breadcrumbLd, faqPageLd, graphLd, organizationLd, softwareApplicationLd, webSiteLd } from "@/lib/structured-data";
import { SessionProvider } from "./session";
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
  // Pair pages carry 4 sub-feature cards (vs 3 on the generic feature pages).
  pair: [
    [Mic, Volume2],
    [RefreshCw, History],
    [Globe2, Languages],
    [Keyboard, Copy],
  ],
};

// Shared template for every SEO feature page (text translator, voice
// translator, ...). Same section order as the home page's Landing.tsx —
// mirrors iq-rest's FeatureLandingTemplate for digital-menu-for-restaurants.
export function FeatureLanding({
  locale,
  chrome,
  content,
  icons,
  pathname,
  presetSource,
  presetTarget,
}: {
  locale: Locale;
  chrome: TranslatorTexts;
  content: FeatureContent;
  icons: "text" | "voice" | "pair";
  pathname: string;
  /** Language-pair preset for the translator widget (pair pages only). */
  presetSource?: string;
  presetTarget?: string;
}) {
  // Anchor text is looked up in the locale's own link list rather than
  // rebuilt from the slug, so it stays translated and stays in sync.
  const labelFor = (slug: string) =>
    chrome.footer.featureLinks.find((l) => l.routeKey.replace(/^\//, "") === slug)?.label;
  const related = relatedPairs(locale, pathname.replace(/^\/([a-z]{2}\/)?/, ""))
    .map((p) => ({ href: localePath(p.locale, p.slug), label: labelFor(p.slug) }))
    .filter((l): l is { href: string; label: string } => Boolean(l.label));

  const jsonLd = graphLd([
    organizationLd(),
    webSiteLd(locale),
    softwareApplicationLd(content.meta.description),
    // Home > this page: the pair pages are one level deep in every locale.
    // `name` is exactly the label the <Breadcrumbs> below renders — the
    // accent half of the hero title is marketing tail, not a page name.
    breadcrumbLd(locale, { name: content.hero.title, url: content.meta.canonical }),
    faqPageLd(content.faq.items),
  ]);

  return (
    <SessionProvider locale={locale} page="Pair">
      <main className={PAGE}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header
          homeHref={locale === "en" ? "/" : `/${locale}`}
          locale={locale}
          texts={chrome.header}
          accountTexts={chrome.account}
          featureLinks={chrome.footer.featureLinks}
        />
        <Container>
          <Band id="app" section="widget">
            <Translator
              texts={chrome}
              heroTexts={content.hero}
              presetSource={presetSource}
              presetTarget={presetTarget}
              pricingHref={localePath(locale, "pricing")}
            />
          </Band>
          <Band section="stats">
            <StatCards items={chrome.statCards} />
          </Band>
          <Band section="breadcrumbs">
            <Breadcrumbs
              homeHref={localeHome(locale)}
              homeLabel={chrome.footer.brand}
              current={content.hero.title}
            />
          </Band>
          <Band id="features" section="features">
            <Spotlights items={content.spotlights} icons={SPOTLIGHT_ICONS[icons]} />
          </Band>
          <Band section="related">
            <RelatedPairs heading={chrome.footer.pairsHeading} links={related} />
          </Band>
          <Band id="comparison" section="comparison">
            <Comparison texts={content.comparison} />
          </Band>
          <Band id="faq" section="faq">
            <Faq
              heading={content.faq.heading}
              headingAccent={content.faq.headingAccent}
              sub={content.faq.sub}
              items={content.faq.items}
            />
          </Band>
          <Band section="final_cta">
            <FinalCta
              heading={content.finalCta.heading}
              headingAccent={content.finalCta.headingAccent}
              sub={content.finalCta.sub}
              ctaLabel={content.finalCta.ctaLabel}
              ctaHref={localeHome(locale)}
            />
          </Band>
        </Container>
        <Footer locale={locale} pathname={pathname} texts={chrome.footer} />
      </main>
    </SessionProvider>
  );
}
