import { NextRequest, NextResponse } from "next/server";
import { resolveOwner } from "@/lib/auth";
import { getAccountUsage } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const owner = await resolveOwner(req);
  if (!owner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { account, plan } = await getAccountUsage(owner);
  return NextResponse.json({
    plan: plan.id,
    planName: plan.name,
    creditsBalance: account.creditsBalance,
    creditsPerPeriod: plan.creditsPerPeriod,
    subscriptionStatus: account.subscriptionStatus,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    hasSubscription: !!account.stripeCustomerId,
  });
}
