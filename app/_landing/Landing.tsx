import { Header } from "./Header";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Translator } from "./Translator";
import { StatCards } from "./StatCards";
import { Spotlights } from "./Spotlights";
import { Comparison } from "./Comparison";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Container, Band, PAGE } from "./shell";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "IQ Translate",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  description:
    "Instant voice translation app: speak naturally and get an instant translation, spoken or written, in 186 languages.",
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
        <Band id="app">
          <Translator />
        </Band>
        <Band>
          <Hero />
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
