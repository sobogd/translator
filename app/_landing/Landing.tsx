import { Header } from "./Header";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { TranslatorApp } from "./TranslatorApp";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE, CARD } from "./shell";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "IQ Translate",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  description:
    "Real-time voice translation app: speak naturally and get an instant translation, spoken or written, in 186 languages.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <main className={PAGE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Header signedIn={signedIn} />
      <Container className="py-6">
        <Band>
          <Hero />
        </Band>
        <Band id="app">
          <div className={`${CARD} overflow-hidden bg-card`}>
            <TranslatorApp />
          </div>
        </Band>
        <Band>
          <StatCards />
        </Band>
        <Band id="features">
          <Spotlights />
        </Band>
        <Band id="comparison">
          <Comparison />
        </Band>
        <Band id="faq">
          <Faq />
        </Band>
        <Band>
          <FinalCta />
        </Band>
      </Container>
      <Footer />
    </main>
  );
}
