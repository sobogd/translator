import { Header } from "./Header";
import { Footer } from "./Footer";
import { Container, Band, PAGE } from "./shell";
import { SessionProvider } from "./session";
import { CHROME } from "@/content";

export type LegalSection = { heading: string; body: string[] };

// Plain document template for /privacy and /terms. English-only on purpose:
// these are the operator's legal texts, and a machine-translated legal page is
// worth less than an accurate one — the rest of the chrome stays localized.
export function LegalPage({
  title,
  updated,
  intro,
  sections,
  pathname,
}: {
  title: string;
  /** ISO date shown under the title, e.g. "2026-09-02". */
  updated: string;
  intro: string;
  sections: LegalSection[];
  pathname: string;
}) {
  const chrome = CHROME.en;
  return (
    <SessionProvider locale="en">
      <main className={PAGE}>
        <Header
          homeHref="/"
          locale="en"
          texts={chrome.header}
          accountTexts={chrome.account}
          featureLinks={chrome.footer.featureLinks}
        />
        <Container>
          <Band>
            <article className="mx-auto flex w-full max-w-3xl flex-col gap-8">
              <header className="flex flex-col gap-3">
                <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">{title}</h1>
                <p className="text-sm text-hint">Last updated: {updated}</p>
                <p className="text-sm leading-relaxed text-hint sm:text-base">{intro}</p>
              </header>
              {sections.map((s) => (
                <section key={s.heading} className="flex flex-col gap-3">
                  <h2 className="text-xl font-medium tracking-tight sm:text-2xl">{s.heading}</h2>
                  {s.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-hint sm:text-base">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </article>
          </Band>
        </Container>
        <Footer locale="en" pathname={pathname} texts={chrome.footer} />
      </main>
    </SessionProvider>
  );
}
