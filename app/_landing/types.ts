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
    faq: string;
    signIn: string;
    logOut: string;
    tryItNow: string;
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
  };
  translator: {
    topics: string;
    newTopic: string;
    noTopicsYet: string;
    deleteTopic: string;
    deleteTopicConfirm: string;
    detectingLanguage: string;
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
    };
  };
  history: {
    emptyState: string;
    readAloudAria: string;
    copyAria: string;
  };
}
