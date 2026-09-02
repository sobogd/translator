"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { CARD, PRIMARY_BTN, OUTLINE_BTN } from "./shell";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import type { TranslatorTexts } from "./types";

type PricingTexts = TranslatorTexts["pricing"];

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

// Copy (plan names, feature lines with the quota numbers, CTA labels) comes
// from the locale's pricing texts; only the price itself renders from
// lib/plans.ts so a price change can never go stale in 34 translations.
export function PricingCards({ texts }: { texts: PricingTexts }) {
  const [loading, setLoading] = useState<PlanId | null>(null);

  async function onSelect(plan: PlanId) {
    setLoading(plan);
    try {
      await startCheckout(plan);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const copy = texts.plans.find((p) => p.id === id);
        return (
          <div
            key={id}
            className={`${CARD} flex flex-col gap-5 p-6 ${plan.popular ? "ring-2 ring-button" : ""}`}
          >
            {plan.popular && (
              <span className="w-fit rounded-full bg-button/15 px-2.5 py-1 text-base font-semibold text-button">
                {texts.mostPopular}
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold">{copy?.name ?? plan.name}</h3>
              <p className="mt-1 text-3xl font-medium">
                ${plan.priceMonthly.toFixed(2).replace(/\.00$/, "")}
                <span className="text-base font-normal text-hint">{texts.perMonth}</span>
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5">
              {(copy?.features ?? []).map((f) => (
                <li key={f} className="flex items-start gap-2 text-base text-hint">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-button" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onSelect(id)}
              disabled={loading === id}
              className={plan.popular ? PRIMARY_BTN : OUTLINE_BTN}
            >
              {loading === id ? "…" : texts.cta}
            </button>
          </div>
        );
      })}
    </div>
  );
}
