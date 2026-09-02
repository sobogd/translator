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

// Quotas sized off Gemini 3.5 Flash-Lite unit costs — same price point as
// 2.5 Flash, which it replaces (retires 2026-10-16): text in $0.30/M tok, out
// $2.50/M tok, audio in $1.00/M tok @ 32 tok/s. ~$1.3 per 1M translated
// characters, ~$0.0025 per STT minute. Each plan's fully-drained quota costs
// <= 1/3 of its price — a 3x floor on margin; real utilization sits far lower.
// A dictated message is charged twice by design, both legs inside
// /api/translate-voice: its seconds for the STT, then its characters for the
// translation of the resulting transcript.
//
// Two things the naive $/char estimate misses, both now bounded in
// lib/gemini-translate.ts rather than left open-ended:
//   - the reply is not charged at all, so an input that makes the model emit
//     as much as it can is pure loss (MAX_OUTPUT_TOKENS caps it);
//   - the recent-turns context is resent with every request and is not
//     charged either (CONTEXT_MAX_CHARS caps it).
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

/** Size ranking used to tell an upgrade from a downgrade (0 = no plan).
 *  A change of plan grants the new allowance outright only when it is an
 *  upgrade; granting it on every change turned PRO -> STARTER -> PRO in the
 *  billing portal into a repeatable free quota refill. */
export function planRank(plan: PlanId | "FREE" | string): number {
  const index = PLAN_ORDER.indexOf(plan as PlanId);
  return index === -1 ? 0 : index + 1;
}

// The free tier is the product without a subscription — anonymous fingerprint
// or signed-in account alike. Lifetime (not renewing) trial pool, sized to
// stay under $0.01 in Gemini spend even in the worst realistic case: lots of
// short messages, each paying the ~100-token fixed prompt overhead
// (lib/gemini-translate.ts's instruction text) on top of its own content —
// that overhead is invisible in a naive $/char estimate but dominates when
// messages are short. 500 chars + 30s voice ~ $0.008 worst case, leaving
// margin for CJK languages (fewer chars per token than Latin scripts).
export const FREE_TRIAL = {
  chars: 500,
  seconds: 30,
  maxCharsPerRequest: 500,
};

// The same lifetime pool for a signed-in account that has never subscribed.
// Deliberately larger than the anonymous one: signing in with Google is the
// conversion step worth rewarding, and a Google account is a far higher bar
// to farm than a rotated User-Agent (which is all it takes to mint a fresh
// anonymous fingerprint — see computeFingerprint in lib/auth.ts).
// These MUST match the column defaults of the Account model in
// prisma/schema.prisma, which is where a new account actually gets them.
export const FREE_ACCOUNT = {
  chars: 4000,
  seconds: 120,
};

// Refill period for an active subscription when Stripe has not told us when
// the paid period actually ends. The real value comes from the subscription
// item's current_period_end, so this is only the fallback; a flat 30 days
// drifts against a calendar month and hands out ~12.2 refills per 12
// payments a year.
export const FALLBACK_PERIOD_MS = 30 * 86_400_000;
