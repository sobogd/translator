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
import { graphLd, organizationLd, softwareApplicationLd, webSiteLd } from "@/lib/structured-data";
import { SessionProvider } from "./session";
import type { TranslatorTexts } from "./types";

export function Landing({
  locale,
  texts,
  homeHref,
  pathname,
}: {
  locale: Locale;
  texts: TranslatorTexts;
  homeHref: string;
  pathname: string;
}) {
  // The home widget defaults its target to the page's own language (a /lv
  // visitor most likely translates INTO Latvian's pair, not Spanish); a
  // previously saved localStorage choice still wins over this soft default.
  const jsonLd = graphLd([
    organizationLd(),
    webSiteLd(locale),
    softwareApplicationLd(texts.meta.description),
  ]);

  return (
    <SessionProvider locale={locale} page="Home">
      <main className={PAGE}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header
          homeHref={homeHref}
          locale={locale}
          texts={texts.header}
          accountTexts={texts.account}
          featureLinks={texts.footer.featureLinks}
        />
        <Container>
          <Band id="app" section="widget">
            <Translator
              texts={texts}
              heroTexts={texts.hero}
              initialTarget={locale}
              pricingHref={localePath(locale, "pricing")}
            />
          </Band>
          <Band section="stats">
            <StatCards items={texts.statCards} />
          </Band>
          <Band id="features" section="features">
            <Spotlights items={texts.spotlights} />
          </Band>
          <Band id="comparison" section="comparison">
            <Comparison texts={texts.comparison} />
          </Band>
          <Band id="faq" section="faq">
            <Faq
              heading={texts.faq.heading}
              headingAccent={texts.faq.headingAccent}
              sub={texts.faq.sub}
              items={texts.faq.items}
            />
          </Band>
          <Band section="final_cta">
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
    </SessionProvider>
  );
}
