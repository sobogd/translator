import { Header } from "./Header";
import { Footer } from "./Footer";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { PricingCards } from "./PricingCards";
import { Container, Band, PAGE } from "./shell";
import { localeHome, localePath } from "@/lib/locale-paths";
import type { Locale } from "@/lib/locales";
import type { TranslatorTexts } from "./types";

// Shared template for the localized /pricing page. All copy comes from the
// locale's chrome (texts.pricing); prices render from lib/plans.ts inside
// PricingCards. There is no free plan card — the free tier is the anonymous
// no-signup widget, called out in the freeNote strip under the cards.
export function PricingPage({
  signedIn,
  locale,
  chrome,
}: {
  signedIn: boolean;
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
        featureLinks={chrome.footer.featureLinks}
      />
      <Container className="py-6">
        <Band>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
              {p.heading}{" "}
              <span className="bg-gradient-to-br from-[hsl(9,100%,58%)] to-[hsl(35,95%,55%)] bg-clip-text text-transparent">
                {p.headingAccent}
              </span>
            </h1>
            <p className="max-w-xl text-sm text-hint sm:text-base">{p.sub}</p>
          </div>
          <PricingCards texts={p} />
          <div className="mt-6 rounded-2xl border border-border p-5 text-center">
            <p className="text-sm font-semibold">{p.freeNote.title}</p>
            <p className="mt-1 text-sm text-hint">{p.freeNote.sub}</p>
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
            ctaHref={`${localeHome(locale)}#app`}
          />
        </Band>
      </Container>
      <Footer locale={locale} pathname={pathname} texts={chrome.footer} />
    </main>
  );
}
