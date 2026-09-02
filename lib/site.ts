export const SITE_URL = "https://iq-translate.com";

// Site-wide social preview (public/og.png, see scripts/gen-og-image.py).
// Next merges metadata one level deep only: a page that declares its own
// `openGraph` or `twitter` replaces the root layout's object wholesale, so
// every page has to spread these in rather than rely on inheritance.
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "IQ Translate" };
export const TWITTER_CARD = { card: "summary_large_image" as const, images: ["/og.png"] };
