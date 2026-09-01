"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { CARD, PRIMARY_BTN, OUTLINE_BTN } from "./shell";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";

const FEATURES: Record<PlanId, string[]> = {
  FREE: ["40 credits/day", "1,500 characters per request", "Voice + text translation", "186 languages"],
  STARTER: ["1,000 credits/month", "30,000 characters per request", "Voice + text translation", "186 languages"],
  PRO: [
    "3,000 credits/month",
    "100,000 characters per request",
    "Voice + text translation",
    "186 languages",
    "Priority processing",
  ],
  ULTIMATE: [
    "10,000 credits/month",
    "150,000 characters per request",
    "Voice + text translation",
    "186 languages",
    "Priority processing",
  ],
};

async function startCheckout(plan: PlanId) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (res.status === 401) {
    window.location.href = "/api/auth/google/start";
    return;
  }
  const data = await res.json();
  if (data.redirectUrl) window.location.href = data.redirectUrl;
}

export function PricingCards() {
  const [loading, setLoading] = useState<PlanId | null>(null);

  async function onSelect(plan: PlanId) {
    if (plan === "FREE") {
      window.location.assign("/api/auth/google/start");
      return;
    }
    setLoading(plan);
    try {
      await startCheckout(plan);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        return (
          <div
            key={id}
            className={`${CARD} flex flex-col gap-5 p-6 ${plan.popular ? "ring-2 ring-emerald-500" : ""}`}
          >
            {plan.popular && (
              <span className="w-fit rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Most popular
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-3xl font-medium">
                ${plan.priceMonthly.toFixed(2).replace(/\.00$/, "")}
                <span className="text-sm font-normal text-hint">/mo</span>
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5">
              {FEATURES[id].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-hint">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onSelect(id)}
              disabled={loading === id}
              className={plan.popular ? PRIMARY_BTN : OUTLINE_BTN}
            >
              {loading === id ? "…" : id === "FREE" ? "Sign in with Google" : "Get started"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
