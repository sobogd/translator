import { Header } from "./Header";
import { Footer } from "./Footer";
import { Translator } from "./Translator";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE } from "./shell";
import { localeHome, localePath } from "@/lib/locale-paths";
import type { Locale } from "@/lib/locales";
import type { Quota } from "@/lib/quota-server";
import type { InitialTopics } from "@/lib/topics-server";
import type { TranslatorTexts } from "./types";

export function Landing({
  signedIn,
  initialQuota = null,
  initialTopics = null,
  locale,
  texts,
  homeHref,
  pathname,
}: {
  signedIn: boolean;
  initialQuota?: Quota | null;
  initialTopics?: InitialTopics | null;
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
        accountTexts={texts.account}
        initialQuota={initialQuota}
        featureLinks={texts.footer.featureLinks}
      />
      <Container>
        <Band id="app">
          {/* TS_SITE is public by design; read here (server component)
              instead of renaming it to NEXT_PUBLIC_*. */}
          <Translator
            initialData={initialTopics}
            texts={texts}
            heroTexts={texts.hero}
            initialTarget={locale}
            pricingHref={localePath(locale, "pricing")}
            signedIn={signedIn}
            turnstileSiteKey={process.env.TS_SITE ?? null}
          />
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
          {/* On the home page itself a bare "/" link is a no-op — anchor the
              CTA to the header (#top) so it scrolls all the way up. */}
          <FinalCta
            heading={texts.finalCta.heading}
            headingAccent={texts.finalCta.headingAccent}
            sub={texts.finalCta.sub}
            ctaLabel={texts.finalCta.ctaLabel}
            ctaHref={`${localeHome(locale)}#top`}
          />
        </Band>
      </Container>
      <Footer locale={locale} pathname={pathname} texts={texts.footer} />
    </main>
  );
}
