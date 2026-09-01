import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOwner, getOrigin } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const account = await prisma.account.findUnique({ where: { email: owner } });
  if (!account?.stripeCustomerId) {
    return NextResponse.json({ error: "no subscription" }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = getOrigin(req);
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${origin}/#app`,
  });

  return NextResponse.json({ url: session.url });
}
