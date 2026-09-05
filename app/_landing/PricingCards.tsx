"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PRIMARY_BTN, OUTLINE_BTN } from "./shell";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { analytics } from "@/lib/analytics";
import type { TranslatorTexts } from "./types";

type PricingTexts = TranslatorTexts["pricing"];

async function startCheckout(plan: PlanId) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  // Every branch below leaves the document, so the buffer has to go out with
  // the event still in it.
  if (res.status === 401) {
    analytics.track("Show", `Checkout needs sign in ${plan}`);
    analytics.flush();
    window.location.href = "/api/auth/google/start";
    return;
  }
  const data = await res.json();
  if (data.redirectUrl) {
    analytics.track("Click", `Checkout redirect ${plan}`);
    analytics.flush();
    window.location.href = data.redirectUrl;
  } else {
    analytics.track("Show", `Checkout failed ${plan}`);
  }
}

function price(id: PlanId): string {
  return `$${PLANS[id].priceMonthly.toFixed(2).replace(/\.00$/, "")}`;
}

// Copy (plan names, feature lines with the quota numbers, CTA labels) comes
// from the locale's pricing texts; only the price itself renders from
// lib/plans.ts so a price change can never go stale in 34 translations.
export function PricingCards({
  texts,
  variant = "cards",
}: {
  texts: PricingTexts;
  /** "cards" = three bordered cards side by side. "flat" = a single
   *  divider-separated column for the pricing hero, whose right half is
   *  already a panel — no card inside a card. */
  variant?: "cards" | "flat";
}) {
  const [loading, setLoading] = useState<PlanId | null>(null);

  async function onSelect(plan: PlanId) {
    analytics.track("Click", `Plan ${plan}`);
    setLoading(plan);
    try {
      await startCheckout(plan);
    } finally {
      setLoading(null);
    }
  }

  if (variant === "flat") {
    return (
      <div className="flex flex-col divide-y divide-border">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const copy = texts.plans.find((p) => p.id === id);
          return (
            <div key={id} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{copy?.name ?? plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded-full bg-button/15 px-2 py-0.5 text-[11px] font-semibold text-button">
                      {texts.mostPopular}
                    </span>
                  )}
                </div>
                <p className="text-xl font-medium">
                  {price(id)}
                  <span className="text-sm font-normal text-hint">{texts.perMonth}</span>
                </p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {(copy?.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-hint">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-button" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onSelect(id)}
                disabled={loading === id}
                className={`w-full ${plan.popular ? PRIMARY_BTN : OUTLINE_BTN}`}
              >
                {loading === id ? "…" : texts.cta}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const copy = texts.plans.find((p) => p.id === id);
        return (
          <div
            key={id}
            className={`flex flex-col gap-5 rounded-2xl border border-border p-6 ${plan.popular ? "ring-2 ring-button" : ""}`}
          >
            {plan.popular && (
              <span className="w-fit rounded-full bg-button/15 px-2.5 py-1 text-xs font-semibold text-button">
                {texts.mostPopular}
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold">{copy?.name ?? plan.name}</h3>
              <p className="mt-1 text-3xl font-medium">
                {price(id)}
                <span className="text-sm font-normal text-hint">{texts.perMonth}</span>
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5">
              {(copy?.features ?? []).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-hint">
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
