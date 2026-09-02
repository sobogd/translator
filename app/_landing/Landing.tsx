import { Header } from "./Header";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Translator } from "./Translator";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE } from "./shell";
import type { Locale } from "@/lib/locales";
import type { TranslatorTexts } from "./types";

export function Landing({
  signedIn,
  locale,
  texts,
  homeHref,
  pathname,
}: {
  signedIn: boolean;
  locale: Locale;
  texts: TranslatorTexts;
  homeHref: string;
  pathname: string;
}) {
  // The home widget defaults its target to the page's own language (a /lv
  // visitor most likely translates INTO Latvian's pair, not Spanish); a
  // previously saved localStorage choice still wins over this soft default.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "IQ Translate",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    description: texts.meta.description,
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
        homeHref={homeHref}
        locale={locale}
        texts={texts.header}
        featureLinks={texts.footer.featureLinks}
      />
      <Container className="py-6">
        <Band id="app">
          <Translator texts={texts} initialTarget={locale} />
        </Band>
        <Band>
          <Hero texts={texts.hero} />
        </Band>
        <Band>
          <StatCards items={texts.statCards} />
        </Band>
        <Band id="features">
          <Spotlights items={texts.spotlights} />
        </Band>
        <Band id="comparison">
          <Comparison texts={texts.comparison} />
        </Band>
        <Band id="faq">
          <Faq
            heading={texts.faq.heading}
            headingAccent={texts.faq.headingAccent}
            sub={texts.faq.sub}
            items={texts.faq.items}
          />
        </Band>
        <Band>
          <FinalCta
            heading={texts.finalCta.heading}
            headingAccent={texts.finalCta.headingAccent}
            sub={texts.finalCta.sub}
            ctaLabel={texts.finalCta.ctaLabel}
          />
        </Band>
      </Container>
      <Footer locale={locale} pathname={pathname} texts={texts.footer} />
    </main>
  );
}
