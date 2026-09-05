import { DesktopShell } from "./desktop/DesktopShell";
import { mergeTaskbarTexts } from "./desktop/taskbar-texts";
import { Translator } from "./Translator";
import { Band } from "./shell";
import { SessionProvider } from "./session";
import type { LegalSection } from "./legal-content";
import { CHROME } from "@/content";

// A legal document (Privacy / Terms) as plain, semantic type — one column of
// <h1> / <section> / <h2> / <p> with no card, no border, no dividers,
// mirroring iq-mermaid's LegalPage. The page chrome is localized (English
// here — legal is English-only); the document itself is the binding text, so
// the whole block keeps lang="en" / dir="ltr".
export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
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
      <DesktopShell
        locale="en"
        homeHref="/"
        headerTexts={mergeTaskbarTexts(chrome.header)}
        accountTexts={chrome.account}
        pricingHref="/pricing"
        featureLinks={chrome.footer.featureLinks}
        product={<Translator texts={chrome} pricingHref="/pricing" />}
      >
        <Band section="legal" className="px-6 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10">
          <div lang="en" dir="ltr" className="flex w-full max-w-[760px] flex-col gap-y-10">
            <header className="flex flex-col items-start gap-3">
              <h1 className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-text sm:text-4xl">
                {title}
              </h1>
              {lastUpdated && <p className="text-sm text-hint">{lastUpdated}</p>}
            </header>

            {body.map((section, i) => (
              <section key={section.heading ?? `intro-${i}`} className="flex flex-col gap-3">
                {section.heading && (
                  <h2 className="text-xl font-semibold leading-snug tracking-tight">{section.heading}</h2>
                )}
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-[15px] leading-relaxed text-text/80">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Band>
      </DesktopShell>
    </SessionProvider>
  );
}
