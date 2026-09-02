import { Header } from "./Header";
import { Footer } from "./Footer";
import { Container, Band, PAGE } from "./shell";
import { SessionProvider } from "./session";
import type { LegalSection } from "./legal-content";
import { CHROME } from "@/content";

// Single legal document (Privacy / Terms) in the standard chrome. Same big
// card as the FAQ block and as iq-rest's LegalDocument: tinted sticky 40%
// column on the left (title + revision date), plain 60% column on the right.
//
// English-only on purpose — the body is the binding version, and translating
// legal text needs lawyer review — hence the explicit lang/dir on the card,
// since the surrounding <html> is English here anyway but the footer's
// language switcher can take a visitor to a localized page next.
export function LegalPage({
  title,
  sections,
  pathname,
}: {
  title: string;
  sections: LegalSection[];
  pathname: string;
}) {
  const chrome = CHROME.en;
  const lastUpdated = sections
    .flatMap((s) => s.paragraphs)
    .find((p) => p.startsWith("Last updated:"));
  const body = sections
    .map((s) => ({ ...s, paragraphs: s.paragraphs.filter((p) => !p.startsWith("Last updated:")) }))
    .filter((s) => s.heading || s.paragraphs.length > 0);

  return (
    <SessionProvider locale="en" page="Legal">
      <main className={PAGE}>
        <Header
          homeHref="/"
          locale="en"
          texts={chrome.header}
          accountTexts={chrome.account}
          featureLinks={chrome.footer.featureLinks}
        />
        <Container>
          <Band section="legal">
            <article
              lang="en"
              dir="ltr"
              className="grid grid-cols-1 rounded-2xl border border-border lg:grid-cols-[2fr_3fr]"
            >
              <div className="rounded-t-2xl bg-[hsl(28_48%_93%)] dark:bg-[hsl(28_15%_13%)] lg:rounded-t-none lg:rounded-l-2xl">
                <div className="flex flex-col items-start gap-3 p-5 text-start sm:p-6 lg:sticky lg:top-16">
                  <h1 className="text-3xl font-medium leading-[1.15] tracking-tight sm:text-4xl">{title}</h1>
                  {lastUpdated && <p className="text-sm text-hint/80">{lastUpdated}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-8 p-5 sm:p-6">
                {body.map((section, i) => (
                  <section key={section.heading ?? `intro-${i}`} className="flex flex-col gap-2">
                    {section.heading && (
                      <h2 className="text-base font-medium tracking-tight sm:text-lg">{section.heading}</h2>
                    )}
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-relaxed text-hint">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            </article>
          </Band>
        </Container>
        <Footer locale="en" pathname={pathname} texts={chrome.footer} />
      </main>
    </SessionProvider>
  );
}
