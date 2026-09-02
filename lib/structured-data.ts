// JSON-LD builders, shared by the home / feature / pricing templates so all
// three describe the same entity instead of three slightly different ones.
import { PLANS, PLAN_ORDER } from "./plans";
import { SITE_URL } from "./site";
import { localeHome } from "./locale-paths";
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

export function softwareApplicationLd(description: string) {
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
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      // Free tier (no sign-up) through the top plan — see lib/plans.ts.
      lowPrice: "0",
      highPrice: prices[prices.length - 1].toFixed(2),
      offerCount: prices.length + 1,
    },
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
