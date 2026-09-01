import { NARROW } from "./shell";
import { locales, defaultLocale, type Locale } from "@/lib/locales";
import { swapLocale } from "@/lib/locale-slug-overrides";

type FooterTexts = { tagline: string; brand: string };

const DEFAULT_TEXTS: FooterTexts = {
  tagline: "Instant voice translation, 186 languages",
  brand: "IQ Translate",
};

// `locale`/`pathname`/`texts` default to English/home so the not-yet-localized
// /pricing page can keep calling <Footer /> unchanged.
export function Footer({
  locale = defaultLocale,
  pathname = "/",
  texts = DEFAULT_TEXTS,
}: {
  locale?: Locale;
  pathname?: string;
  texts?: FooterTexts;
}) {
  const otherLocale = locales.find((l) => l !== locale) ?? locale;
  return (
    <footer className="border-t border-border py-8">
      <div className={`${NARROW} flex flex-col items-center justify-between gap-3 text-sm text-hint sm:flex-row`}>
        <span>{`© ${new Date().getFullYear()} ${texts.brand}`}</span>
        <span>{texts.tagline}</span>
        <a
          href={swapLocale(pathname, otherLocale)}
          className="shrink-0 uppercase tracking-wide transition hover:text-text"
        >
          {otherLocale}
        </a>
      </div>
    </footer>
  );
}
