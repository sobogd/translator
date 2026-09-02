// JSON-LD builders, shared by the home / feature / pricing templates so all
// three describe the same entity instead of three slightly different ones.
import { PLANS, PLAN_ORDER } from "./plans";
import { SITE_URL } from "./site";
import { localeHome, localePath } from "./locale-paths";
import { OG_LOCALES } from "./og-locales";

const ORG_ID = `${SITE_URL}/#organization`;
const APP_ID = `${SITE_URL}/#app`;

// Every plan plus the free tier, so the "price: 0" the app used to advertise
// on its own is no longer the whole (and misleading) story.
const prices = PLAN_ORDER.map((id) => PLANS[id].priceMonthly);

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "IQ Translate",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    image: `${SITE_URL}/og.png`,
  };
}

export function webSiteLd(locale: string) {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "IQ Translate",
    inLanguage: (OG_LOCALES[locale] ?? "en_US").replace("_", "-"),
    publisher: { "@id": ORG_ID },
  };
}

// `offers` defaults to the whole-catalogue AggregateOffer. /pricing passes
// per-plan Offers instead — see planOffersLd.
export function softwareApplicationLd(description: string, offers?: object) {
  return {
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": APP_ID,
    name: "IQ Translate",
    applicationCategory: "UtilitiesApplication",
    applicationSubCategory: "Translation",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript and a microphone for voice input",
    url: SITE_URL,
    description,
    publisher: { "@id": ORG_ID },
    offers: offers ?? {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      // Free tier (no sign-up) through the top plan — see lib/plans.ts.
      lowPrice: "0",
      highPrice: prices[prices.length - 1].toFixed(2),
      offerCount: prices.length + 1,
    },
  };
}

// One Offer per plan, for /pricing only — that is the one page where the
// three tariffs are actually on screen. Emitting them site-wide would be
// markup describing content the visitor cannot see, which is exactly what
// the structured-data guidelines call out.
export function planOffersLd(locale: string) {
  const url = `${SITE_URL}${localePath(locale, "pricing")}`;
  return PLAN_ORDER.map((id) => {
    const plan = PLANS[id];
    const price = plan.priceMonthly.toFixed(2);
    return {
      "@type": "Offer",
      name: plan.name,
      url,
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      // Subscriptions need the billing period spelled out, otherwise the
      // price reads as a one-off purchase.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: "USD",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
      },
    };
  });
}

// FAQPage as JSON-LD. The questions used to be marked up with microdata
// attributes inside Faq.tsx; one format in one place is easier to keep valid,
// and it keeps every node of the page in the same @graph.
export function faqPageLd(items: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbLd(locale: string, page: { name: string; url: string }) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "IQ Translate",
        item: `${SITE_URL}${localeHome(locale)}`,
      },
      { "@type": "ListItem", position: 2, name: page.name, item: page.url },
    ],
  };
}

// One <script> per page: a @graph keeps the nodes cross-referenced by @id
// instead of repeating the organization in every block.
export function graphLd(nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
