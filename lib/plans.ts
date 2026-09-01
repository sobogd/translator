export type PlanId = "FREE" | "STARTER" | "PRO" | "ULTIMATE";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD
  creditsPerPeriod: number;
  periodDays: number; // credits reset cadence
  maxCharsPerRequest: number;
  popular?: boolean;
};

// 1 credit = 100 characters (text) or 10 seconds (audio), rounded up, min 1.
// Prices and per-request character caps mirror openl.io's public pricing page.
export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthly: 0,
    creditsPerPeriod: 40,
    periodDays: 1,
    maxCharsPerRequest: 1500,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthly: 9.9,
    creditsPerPeriod: 1000,
    periodDays: 30,
    maxCharsPerRequest: 30000,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthly: 19.9,
    creditsPerPeriod: 3000,
    periodDays: 30,
    maxCharsPerRequest: 100000,
    popular: true,
  },
  ULTIMATE: {
    id: "ULTIMATE",
    name: "Ultimate",
    priceMonthly: 49.9,
    creditsPerPeriod: 10000,
    periodDays: 30,
    maxCharsPerRequest: 150000,
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "STARTER", "PRO", "ULTIMATE"];

export const ANONYMOUS_CREDIT_LIMIT = 50; // lifetime, per browser fingerprint

export function creditsForText(chars: number): number {
  return Math.max(1, Math.ceil(chars / 100));
}

export function creditsForAudio(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 10));
}
