export type SpotlightBullet = { title: string; sub: string };
export type Spotlight = { heading: string; sub: string; bullets: SpotlightBullet[] };
export type StatCard = { title: string; sub: string };
export type ComparisonRow = { title: string; us: string; them: string };
export type FaqItem = { q: string; a: string };

export interface TranslatorTexts {
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    twitterTitle: string;
    twitterDescription: string;
  };
  header: {
    logo: string;
    features: string;
    pricing: string;
    mobileApp: string;
    signIn: string;
    logOut: string;
    tryItNow: string;
    account: string;
  };
  // The header's account modal (signed-in) / quota badge labels.
  account: {
    title: string;
    planLabel: string;
    freePlan: string;
    minutesLeft: string;
    charsLeft: string;
    manageSubscription: string;
    upgrade: string;
  };
  hero: {
    badgeVoice: string;
    badgeText: string;
    badgeLanguages: string;
    title: string;
    titleAccent: string;
    description: string;
    ctaTry: string;
    ctaSignIn: string;
    mockFromLabel: string;
    mockFromPhrase: string;
    mockToLabel: string;
    mockToPhrase: string;
  };
  statCards: StatCard[];
  spotlights: Spotlight[];
  comparison: {
    title: string;
    titleAccent: string;
    description: string;
    usLabel: string;
    themLabel: string;
    rows: ComparisonRow[];
  };
  faq: {
    heading: string;
    headingAccent: string;
    sub: string;
    items: FaqItem[];
  };
  finalCta: {
    heading: string;
    headingAccent: string;
    sub: string;
    ctaLabel: string;
  };
  footer: {
    tagline: string;
    brand: string;
    featuresHeading: string;
    /** Heading of the in-body related-pairs block on the pair pages. */
    pairsHeading: string;
    featureLinks: { routeKey: string; label: string }[];
  };
  // The /pricing page, localized. Quota numbers live inside the translated
  // feature strings (agents write them from lib/plans.ts facts).
  pricing: {
    meta: { title: string; description: string };
    heading: string;
    headingAccent: string;
    sub: string;
    perMonth: string;
    mostPopular: string;
    cta: string;
    freeNote: { title: string; sub: string };
    plans: { id: string; name: string; features: string[] }[];
    faq: { heading: string; headingAccent: string; sub: string; items: FaqItem[] };
    finalCta: { heading: string; headingAccent: string; sub: string; ctaLabel: string };
  };
  translator: {
    topics: string;
    newTopic: string;
    noTopicsYet: string;
    deleteTopic: string;
    deleteTopicConfirm: string;
    autoDetect: string;
    chooseLanguage: string;
    close: string;
    searchPlaceholder: string;
    clearHistory: string;
    clearHistoryConfirm: string;
    noTranslationsYet: string;
    translating: string;
    typePlaceholder: string;
    translateAria: string;
    micDeniedError: string;
    recording: string;
    recognizing: string;
    recordAria: string;
    stopAria: string;
    pricingLink: string;
    errors: {
      insufficientCredits: string;
      textTooLong: string;
      turnstileFailed: string;
    };
  };
  history: {
    emptyState: string;
    readAloudAria: string;
    copyAria: string;
  };
}

// Per-feature-page content (hero/spotlights/comparison/faq/finalCta copy +
// SEO meta), separate from `TranslatorTexts` chrome (header/footer/translator
// widget) which every feature page imports unchanged from its locale's
// texts.json — mirrors iq-rest's CHROME_JSON + CONTENT_JSON split.
export interface FeatureContent {
  meta: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
    canonical: string;
    ogLocale: string;
  };
  hero: {
    badgeVoice: string;
    badgeText: string;
    badgeLanguages: string;
    title: string;
    titleAccent: string;
    description: string;
    ctaTry: string;
    ctaSignIn: string;
    mockFromLabel: string;
    mockFromPhrase: string;
    mockToLabel: string;
    mockToPhrase: string;
  };
  spotlights: Spotlight[];
  comparison: {
    title: string;
    titleAccent: string;
    description: string;
    usLabel: string;
    themLabel: string;
    rows: ComparisonRow[];
  };
  faq: {
    heading: string;
    headingAccent: string;
    sub: string;
    items: FaqItem[];
  };
  finalCta: {
    heading: string;
    headingAccent: string;
    sub: string;
    ctaLabel: string;
  };
}
