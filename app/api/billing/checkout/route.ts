import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner, getOrigin } from "@/lib/auth";
import { getStripe, getOrCreatePriceId, findLiveSubscription, APP_TAG } from "@/lib/stripe";
import { PLAN_ORDER, type PlanId } from "@/lib/plans";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Every call here hits the Stripe API several times; without a limit one
  // account can drive that loop as fast as the network allows.
  if (!allowRequest("checkout", owner)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan as PlanId;
  if (!PLAN_ORDER.includes(plan)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }

  const stripe = getStripe();
  const account = await prisma.account.upsert({
    where: { email: owner },
    create: { email: owner },
    update: {},
  });

  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: owner, metadata: { app: APP_TAG } });
    customerId = customer.id;
    await prisma.account.update({ where: { email: owner }, data: { stripeCustomerId: customerId } });
  }

  // A second checkout on top of a live subscription creates a SECOND
  // subscription on the same customer: both bill, but only the newest one is
  // ever written back to the account, so the first becomes invisible and
  // uncancellable from inside the product. Two tabs or an impatient double
  // click was enough. Send them to the portal instead — that is also where a
  // plan change belongs.
  const live = await findLiveSubscription(customerId);
  if (live) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getOrigin(req)}/#app`,
    });
    return NextResponse.json({ redirectUrl: portal.url, reason: "already_subscribed" });
  }

  const priceId = await getOrCreatePriceId(plan);
  const origin = getOrigin(req);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?billing=success#app`,
    cancel_url: `${origin}/pricing?billing=canceled`,
    metadata: { email: owner, plan, app: APP_TAG },
    subscription_data: { metadata: { email: owner, plan, app: APP_TAG } },
  });

  return NextResponse.json({ redirectUrl: session.url });
}
