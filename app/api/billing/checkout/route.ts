import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner, getOrigin } from "@/lib/auth";
import { getStripe, getOrCreatePriceId } from "@/lib/stripe";
import { PLAN_ORDER, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const plan = body.plan as PlanId;
  if (!PLAN_ORDER.includes(plan) || plan === "FREE") {
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
    const customer = await stripe.customers.create({ email: owner });
    customerId = customer.id;
    await prisma.account.update({ where: { email: owner }, data: { stripeCustomerId: customerId } });
  }

  const priceId = await getOrCreatePriceId(plan);
  const origin = getOrigin(req);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?billing=success#app`,
    cancel_url: `${origin}/pricing?billing=canceled`,
    metadata: { email: owner, plan },
    subscription_data: { metadata: { email: owner, plan } },
  });

  return NextResponse.json({ redirectUrl: session.url });
}
