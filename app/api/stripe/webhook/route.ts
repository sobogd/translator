import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Account, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe, mapStripeStatus, APP_TAG } from "@/lib/stripe";
import { FALLBACK_PERIOD_MS, PLANS, planRank, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

// The plan a subscription actually entitles its owner to.
//
// The PRICE's metadata comes first on purpose. A subscription's own metadata is
// written once, when we create the Checkout Session, and Stripe never updates
// it afterwards — so a customer who switches plan in the billing portal keeps
// the metadata of the plan they bought originally while paying for a different
// price. Reading the subscription first meant billing STARTER and serving PRO.
function planFromSubscription(sub: Stripe.Subscription): PlanId | "FREE" {
  const price = sub.items.data[0]?.price;
  const fromPrice = price?.metadata?.plan as PlanId | undefined;
  if (fromPrice && PLANS[fromPrice]) return fromPrice;
  const fromSub = sub.metadata?.plan as PlanId | undefined;
  if (fromSub && PLANS[fromSub]) return fromSub;
  return "FREE";
}

function periodEndOf(sub: Stripe.Subscription): Date | null {
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

// Invoices carry the subscription in different places depending on the API
// version the account is pinned to (top-level `subscription` on the old shape,
// `parent.subscription_details` on the current one). Reading only one of them
// silently turned payment_succeeded / payment_failed into no-ops.
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
    }
  ).parent;
  const fromParent = parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object") return fromParent.id;
  return null;
}

// The Stripe account is shared with iq-rest, and Stripe fans every event out to
// every endpoint of the account, so foreign subscriptions land here too. Match
// by email only for subscriptions tagged as ours (APP_TAG) — the same person
// can be a customer in both products. Anything else must already be linked to a
// local row (subscriptions created before the tag existed); if it is not, the
// event belongs to another app and we ignore it.
async function resolveAccount(sub: Stripe.Subscription, email: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const linked = await prisma.account.findFirst({
    where: { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: customerId }] },
  });
  if (linked) return linked;
  if (sub.metadata?.app !== APP_TAG) return null;
  return email ? prisma.account.findUnique({ where: { email } }) : null;
}

// How much quota this subscription state is allowed to hand out, given what
// the account has already been handed out during the same paid period.
//
// The rule is "one grant per (plan, period), and only upwards". Granting on
// every plan change made PRO -> STARTER -> PRO in the billing portal a
// repeatable free refill: the downgrade costs nothing (Stripe credits it back)
// and the upgrade used to re-grant the full monthly allowance. grantedPlan /
// grantedPeriodEnd remember what was already given so the second upgrade
// inside one period is a no-op, while a genuine upgrade or the next billing
// period still grants in full.
function quotaFor(account: Account, plan: PlanId | "FREE", status: string, periodEnd: Date | null): Prisma.AccountUpdateInput {
  const planDef = plan === "FREE" ? null : PLANS[plan];
  if (!planDef || status !== "ACTIVE") return {};

  const samePeriod = (account.grantedPeriodEnd?.getTime() ?? null) === (periodEnd?.getTime() ?? null);
  const grantedRank = samePeriod ? planRank(account.grantedPlan ?? "FREE") : 0;

  if (planRank(plan) > grantedRank) {
    return {
      charsBalance: planDef.charsPerMonth,
      secondsBalance: planDef.minutesPerMonth * 60,
      quotaResetAt: periodEnd ?? new Date(Date.now() + FALLBACK_PERIOD_MS),
      grantedPlan: plan,
      grantedPeriodEnd: periodEnd,
    };
  }
  if (planRank(plan) < planRank(account.plan)) {
    // Downgrade: clamp to the smaller allowance, never grant, and leave the
    // grant marker where it is — lowering it would re-open the loop above.
    return {
      charsBalance: Math.min(account.charsBalance, planDef.charsPerMonth),
      secondsBalance: Math.min(account.secondsBalance, planDef.minutesPerMonth * 60),
      ...(periodEnd ? { quotaResetAt: periodEnd } : {}),
    };
  }
  // Same plan, same period: nothing to grant, just keep the refill clock
  // aligned with the paid period.
  return periodEnd ? { quotaResetAt: periodEnd } : {};
}

async function applySubscription(sub: Stripe.Subscription, email: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const account = await resolveAccount(sub, email);
  if (!account) return;

  const plan = planFromSubscription(sub);
  const status = mapStripeStatus(sub.status);
  if (plan === "FREE" && status === "ACTIVE") {
    // Paid for, but neither the price nor the subscription says which plan —
    // the customer would be charged and served nothing. Loud, because only a
    // mis-tagged Price in Stripe can cause it.
    console.error(`[stripe] active subscription ${sub.id} has no plan metadata`);
  }
  const periodEnd = periodEndOf(sub);

  await prisma.account.update({
    where: { email: account.email },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      plan,
      subscriptionStatus: status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...quotaFor(account, plan, status, periodEnd),
    },
  });
}

async function handleEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Skip the subscription fetch for checkouts that are plainly not ours.
      if (session.metadata?.app && session.metadata.app !== APP_TAG) break;
      if (typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await applySubscription(sub, (session.metadata?.email as string) || null);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await applySubscription(sub, (sub.metadata?.email as string) || null);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Matched on the subscription id, not the customer: a customer can end up
      // with more than one subscription row in Stripe's history, and wiping the
      // plan on whichever one happens to end would cut off a paying customer.
      //
      // The balances go with it. Leaving them meant one paid month of ULTIMATE
      // bought 8M characters that stayed spendable forever, because the free
      // tier never refills and therefore never overwrites them either.
      await prisma.account.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan: "FREE",
          subscriptionStatus: "CANCELED",
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          charsBalance: 0,
          secondsBalance: 0,
          grantedPlan: null,
          grantedPeriodEnd: null,
        },
      });
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);
      if (!subId) break;
      await prisma.account.updateMany({
        where: { stripeSubscriptionId: subId },
        data: { subscriptionStatus: "ACTIVE" },
      });
      // A renewal is the moment the next month is actually paid for, so it is
      // the moment the next month's quota is due — the 30-day timer in
      // lib/credits.ts is only a fallback and drifts against the real cycle.
      // Restricted to subscription_cycle: the create/update invoices are
      // already handled by applySubscription, and refilling on those would
      // re-open the plan-switch loop from the other side.
      if (invoice.billing_reason !== "subscription_cycle") break;
      const account = await prisma.account.findFirst({ where: { stripeSubscriptionId: subId } });
      const planDef = account ? PLANS[account.plan as PlanId] : undefined;
      if (!account || !planDef) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      const periodEnd = periodEndOf(sub);
      await prisma.account.update({
        where: { email: account.email },
        data: {
          charsBalance: planDef.charsPerMonth,
          secondsBalance: planDef.minutesPerMonth * 60,
          quotaResetAt: periodEnd ?? new Date(Date.now() + FALLBACK_PERIOD_MS),
          currentPeriodEnd: periodEnd,
          grantedPlan: account.plan,
          grantedPeriodEnd: periodEnd,
        },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(invoice);
      if (subId) {
        await prisma.account.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { subscriptionStatus: "PAST_DUE" },
        });
      }
      break;
    }
    default:
      break;
  }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // A test-mode event must never grant a real plan. The key we hold decides
  // which mode this deployment is in.
  const expectLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
  if (event.livemode !== expectLive) return NextResponse.json({ received: true, ignored: "livemode" });

  // The StripeEvent row is the lock, taken BEFORE the work and released if the
  // work fails. Writing it afterwards (in a `finally`, as it was) marked a
  // crashed event as processed, so Stripe's retry short-circuited on the
  // duplicate check and the customer's paid plan was lost for good.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event, stripe);
  } catch (err) {
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error(`[stripe] ${event.type} ${event.id} failed`, err);
    // 500 so Stripe retries — the lock above is gone, so the retry does the work.
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
