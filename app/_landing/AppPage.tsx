import { Header } from "./Header";
import { Translator } from "./Translator";
import { localePath } from "@/lib/locale-paths";
import type { Locale } from "@/lib/locales";
import { SessionProvider } from "./session";
import type { StoredPair } from "@/lib/cookies";
import type { TranslatorTexts } from "./types";

// The bare workspace at /app (and /<locale>/app): the same header as every
// other page and nothing else — no footer, no card around the widget, no page
// padding or max-width. The widget owns everything under the header edge to
// edge; only its own islands keep a small inset off the viewport border.
// No SEO copy lives here (that is the locale home's job), so the pages are
// noindex — see the route files.
export function AppPage({
  locale,
  texts,
  homeHref,
  pair,
}: {
  locale: Locale;
  texts: TranslatorTexts;
  homeHref: string;
  /** Pair remembered from the visitor's last visit (PAIR_COOKIE), read by the
   *  route during render so the pair row never jumps after hydration. Absent
   *  on a first visit — the target then falls back to the page's own locale. */
  pair: StoredPair | null;
}) {
  return (
    <SessionProvider locale={locale} page="App">
      <main className="flex h-dvh flex-col overflow-hidden">
        <Header
          homeHref={homeHref}
          locale={locale}
          texts={texts.header}
          accountTexts={texts.account}
          featureLinks={texts.footer.featureLinks}
        />
        <div className="min-h-0 flex-1">
          <Translator
            variant="app"
            texts={texts}
            heroTexts={texts.hero}
            initialTarget={pair?.target ?? locale}
            initialSource={pair?.source ?? null}
            pricingHref={localePath(locale, "pricing")}
          />
        </div>
      </main>
    </SessionProvider>
  );
}
