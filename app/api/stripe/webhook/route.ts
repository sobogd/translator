import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, mapStripeStatus } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

function planFromSubscription(sub: Stripe.Subscription): PlanId | "FREE" {
  const fromMeta = sub.metadata?.plan as PlanId | undefined;
  if (fromMeta) return fromMeta;
  const price = sub.items.data[0]?.price;
  return (price?.metadata?.plan as PlanId | undefined) ?? "FREE";
}

async function applySubscription(sub: Stripe.Subscription, email: string | null) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const account = email
    ? await prisma.account.findUnique({ where: { email } })
    : await prisma.account.findFirst({ where: { stripeCustomerId: customerId } });
  if (!account) return;

  const item = sub.items.data[0];
  const plan = planFromSubscription(sub);
  const planDef = plan === "FREE" ? null : PLANS[plan];
  // A plan change grants its monthly quota immediately (and restarts the
  // 30-day refill clock) instead of waiting out the old quotaResetAt.
  const quotaGrant =
    planDef && account.plan !== plan
      ? {
          charsBalance: planDef.charsPerMonth,
          secondsBalance: planDef.minutesPerMonth * 60,
          quotaResetAt: new Date(Date.now() + 30 * 86_400_000),
        }
      : {};
  await prisma.account.update({
    where: { email: account.email },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      plan,
      subscriptionStatus: mapStripeStatus(sub.status),
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...quotaGrant,
    },
  });
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

  const already = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (already) return NextResponse.json({ received: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
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
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: "FREE", subscriptionStatus: "CANCELED", stripeSubscriptionId: null, cancelAtPeriodEnd: false },
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as { subscription?: string | null }).subscription;
        if (typeof subId === "string") {
          await prisma.account.updateMany({
            where: { stripeSubscriptionId: subId },
            data: { subscriptionStatus: "ACTIVE" },
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as { subscription?: string | null }).subscription;
        if (typeof subId === "string") {
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
  } finally {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  }

  return NextResponse.json({ received: true });
}
