import { DesktopShell } from "./desktop/DesktopShell";
import { mergeTaskbarTexts } from "./desktop/taskbar-texts";
import { Translator } from "./Translator";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Band } from "./shell";
import { localePath } from "@/lib/locale-paths";
import type { Locale } from "@/lib/locales";
import { faqPageLd, graphLd, organizationLd, softwareApplicationLd, webSiteLd } from "@/lib/structured-data";
import { SessionProvider } from "./session";
import type { TranslatorTexts } from "./types";

// The locale home. Every page now lives in the desktop chrome (taskbar +
// internally-scrolling window, ported from iq-mermaid): the translator widget
// is the first band of the window's content — always visible at the top —
// and the marketing sections follow as one plain column of type (no cards).
export function Landing({
  locale,
  texts,
  homeHref,
}: {
  locale: Locale;
  texts: TranslatorTexts;
  homeHref: string;
}) {
  // The home widget defaults its target to the page's own language (a /lv
  // visitor most likely translates INTO Latvian's pair, not Spanish); a
  // previously saved localStorage choice still wins over this soft default.
  const jsonLd = graphLd([
    organizationLd(),
    webSiteLd(locale),
    softwareApplicationLd(texts.meta.description),
    faqPageLd(texts.faq.items),
  ]);

  const pricingHref = localePath(locale, "pricing");

  return (
    <SessionProvider locale={locale} page="Home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DesktopShell
        locale={locale}
        homeHref={homeHref}
        headerTexts={mergeTaskbarTexts(texts.header)}
        accountTexts={texts.account}
        pricingHref={pricingHref}
        featureLinks={texts.footer.featureLinks}
        showBrand
      >
        {/* The translator sits at the top of the window's content; everything
            below is one running column of type — each section a plain Band
            that shares the brand row's side padding and spaces itself with
            vertical padding only. */}
        <Band id="app" section="widget" className="px-6 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-10">
          <Translator
            texts={texts}
            heroTexts={texts.hero}
            initialTarget={locale}
            pricingHref={pricingHref}
          />
        </Band>

        <Band section="stats" className="px-6 pb-12 sm:px-8 sm:pb-16">
          <StatCards items={texts.statCards} />
        </Band>

        <Band id="features" section="features" className="px-6 pb-12 sm:px-8 sm:pb-16">
          <Spotlights items={texts.spotlights} />
        </Band>

        <Band id="comparison" section="comparison" className="px-6 pb-12 sm:px-8 sm:pb-16">
          <Comparison texts={texts.comparison} />
        </Band>

        <Band id="faq" section="faq" className="px-6 pb-12 sm:px-8 sm:pb-16">
          <Faq
            heading={texts.faq.heading}
            headingAccent={texts.faq.headingAccent}
            sub={texts.faq.sub}
            items={texts.faq.items}
          />
        </Band>

        <Band section="final_cta" className="px-6 pb-16 sm:px-8 sm:pb-24">
          <FinalCta
            heading={texts.finalCta.heading}
            headingAccent={texts.finalCta.headingAccent}
            sub={texts.finalCta.sub}
            ctaLabel={texts.finalCta.ctaLabel}
            ctaHref={`${homeHref}#app`}
          />
        </Band>
      </DesktopShell>
    </SessionProvider>
  );
}
