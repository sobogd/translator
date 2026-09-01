export const locales = ["en", "ru"] as const;

export const defaultLocale: Locale = "en";

// No RTL locale yet — kept for shape parity with iq-rest's lib/locales.ts.
export const rtlLocales = [] as const;

export type Locale = (typeof locales)[number];
