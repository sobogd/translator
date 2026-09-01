import type { Metadata } from "next";
import { getServerSessionEmail } from "@/lib/auth";
import { Header } from "../_landing/Header";
import { Footer } from "../_landing/Footer";
import { Faq } from "../_landing/Faq";
import { FinalCta } from "../_landing/FinalCta";
import { PricingCards } from "../_landing/PricingCards";
import { Container, Band, PAGE } from "../_landing/shell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple credit-based pricing for real-time voice translation. Free plan included, upgrade anytime.",
};

const PRICING_FAQ = [
  {
    q: "What is a credit?",
    a: "1 credit covers roughly 100 characters of text or 10 seconds of spoken audio. Every plan includes a monthly (daily on Free) pool of credits.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "Translation pauses until your credits refill (daily on Free, monthly on paid plans) or you upgrade to a higher plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription anytime from the billing portal — no long-term commitment.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, upgrade or downgrade anytime from the billing portal; the new plan applies to your next billing cycle.",
  },
  {
    q: "Do you offer yearly billing?",
    a: "Not yet — all plans are billed monthly for now.",
  },
];

export default async function PricingPage() {
  const email = await getServerSessionEmail();
  return (
    <main className={PAGE}>
      <Header signedIn={!!email} />
      <Container className="py-6">
        <Band>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <h1 className="text-4xl font-medium leading-[1.1] tracking-tight sm:text-[2.5rem]">
              Simple, credit-based{" "}
              <span className="bg-gradient-to-br from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                pricing
              </span>
            </h1>
            <p className="max-w-xl text-sm text-hint sm:text-base">
              Start free. Upgrade whenever you need more voice or text translations. Cancel
              anytime.
            </p>
          </div>
          <PricingCards />
        </Band>
        <Band id="faq">
          <Faq
            heading="Pricing"
            headingAccent="questions"
            sub="What people ask before subscribing."
            items={PRICING_FAQ}
          />
        </Band>
        <Band>
          <FinalCta
            heading="Need more credits?"
            headingAccent="Try it free first."
            sub="No sign-up required to try it — go back to the homepage and translate right away."
            ctaLabel="Try it now"
            ctaHref="/#app"
          />
        </Band>
      </Container>
      <Footer />
    </main>
  );
}
