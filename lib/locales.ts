export const locales = [
  "en", "es", "de", "fr", "it", "pt", "nl", "pl", "ru", "uk",
  "sv", "da", "no", "fi", "cs", "el", "tr", "ro", "hu", "bg",
  "hr", "sk", "sl", "et", "lv", "lt", "sr", "ca", "is",
  "fa", "ar", "ja", "ko", "zh",
] as const;

export const defaultLocale: Locale = "en";

// Mirrors iq-rest's lib/locales.ts (minus `ga` — no Google Ads language, the
// Irish audience searches in English and is covered by the en locale).
export const rtlLocales = ["fa", "ar"] as const;

export type Locale = (typeof locales)[number];
