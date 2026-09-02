export type PlanId = "STARTER" | "PRO" | "ULTIMATE";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD
  charsPerMonth: number; // text-translation quota, characters
  minutesPerMonth: number; // voice (speech-to-text) quota, minutes
  maxCharsPerRequest: number;
  popular?: boolean;
};

// Quotas sized off Gemini 2.5 Flash unit costs (text in $0.30/M tok, out
// $2.50/M tok, audio in $1.00/M tok @ 32 tok/s): ~$1.3 per 1M translated
// characters, ~$0.0025 per STT minute. Each plan's fully-drained quota costs
// ≤ 1/3 of its price — a 3x floor on margin; real utilization sits far lower.
// A dictated message is charged twice by design, both legs inside
// /api/translate-voice: its seconds for the STT, then its characters for the
// translation of the resulting transcript.
export const PLANS: Record<PlanId, Plan> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthly: 9.9,
    charsPerMonth: 1_500_000,
    minutesPerMonth: 250,
    maxCharsPerRequest: 30000,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthly: 19.9,
    charsPerMonth: 3_000_000,
    minutesPerMonth: 600,
    maxCharsPerRequest: 100000,
    popular: true,
  },
  ULTIMATE: {
    id: "ULTIMATE",
    name: "Ultimate",
    priceMonthly: 49.9,
    charsPerMonth: 8_000_000,
    minutesPerMonth: 1500,
    maxCharsPerRequest: 150000,
  },
};

export const PLAN_ORDER: PlanId[] = ["STARTER", "PRO", "ULTIMATE"];

// The free tier is the product without a subscription — anonymous fingerprint
// or signed-in account alike. Lifetime (not renewing) trial pool costing
// ~$0.01 in Gemini spend: 2 voice minutes (~$0.005) + 4k chars (~$0.005).
export const FREE_TRIAL = {
  chars: 4_000,
  seconds: 120,
  maxCharsPerRequest: 1000,
};
