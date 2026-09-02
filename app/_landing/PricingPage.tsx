import { Header } from "./Header";
import { Footer } from "./Footer";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { PricingCards } from "./PricingCards";
import { Container, Band, PAGE } from "./shell";
import { localeHome, localePath } from "@/lib/locale-paths";
import type { Locale } from "@/lib/locales";
import type { Quota } from "@/lib/quota-server";
import type { TranslatorTexts } from "./types";

// Shared template for the localized /pricing page. All copy comes from the
// locale's chrome (texts.pricing); prices render from lib/plans.ts inside
// PricingCards. There is no free plan card and no free-tier strip — the free
// tier is the anonymous no-signup widget on the home page.
export function PricingPage({
  signedIn,
  initialQuota = null,
  locale,
  chrome,
}: {
  signedIn: boolean;
  initialQuota?: Quota | null;
  locale: Locale;
  chrome: TranslatorTexts;
}) {
  const p = chrome.pricing;
  const pathname = localePath(locale, "pricing");
  return (
    <main className={PAGE}>
      <Header
        signedIn={signedIn}
        homeHref={localeHome(locale)}
        locale={locale}
        texts={chrome.header}
        accountTexts={chrome.account}
        initialQuota={initialQuota}
        featureLinks={chrome.footer.featureLinks}
      />
      <Container>
        <Band>
          {/* One card at every breakpoint (unlike the feature hero, which
              splits into two on mobile): filled half carries the SEO copy,
              bare half the plans — flat with dividers, no card in a card. */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border lg:grid lg:grid-cols-[2fr_3fr]">
            <div className="flex min-w-0 flex-col items-start justify-center bg-[hsl(32_44%_92%)] p-6 text-start dark:bg-[hsl(32_14%_14%)] sm:p-8">
              <div className="my-auto flex min-w-0 flex-col gap-4">
                <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
                  {p.heading}{" "}
                  <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
                    {p.headingAccent}
                  </span>
                </h1>
                <p className="text-sm leading-relaxed text-hint/80 sm:text-base">{p.sub}</p>
              </div>
            </div>
            <div className="min-w-0 p-6 sm:p-8">
              <PricingCards texts={p} variant="flat" />
            </div>
          </div>
        </Band>
        <Band id="faq">
          <Faq
            heading={p.faq.heading}
            headingAccent={p.faq.headingAccent}
            sub={p.faq.sub}
            items={p.faq.items}
          />
        </Band>
        <Band>
          <FinalCta
            heading={p.finalCta.heading}
            headingAccent={p.finalCta.headingAccent}
            sub={p.finalCta.sub}
            ctaLabel={p.finalCta.ctaLabel}
            ctaHref={localeHome(locale)}
          />
        </Band>
      </Container>
      <Footer locale={locale} pathname={pathname} texts={chrome.footer} />
    </main>
  );
}
