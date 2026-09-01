import { NextRequest, NextResponse } from "next/server";
import { resolveIdentity } from "@/lib/auth";
import { getAccountUsage, getAnonymousUsage } from "@/lib/credits";
import { ANONYMOUS_CREDIT_LIMIT } from "@/lib/plans";

export const runtime = "nodejs";

// Identity-aware usage summary — works for both a signed-in Account and an
// anonymous fingerprint, so the embedded translator can show one consistent
// "plan · credits" badge regardless of how the visitor is identified.
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (identity.kind === "account") {
    const { account, plan } = await getAccountUsage(identity.ownerKey);
    return NextResponse.json({
      kind: "account",
      planName: plan.name,
      creditsBalance: account.creditsBalance,
      creditsLimit: plan.creditsPerPeriod,
      hasSubscription: !!account.stripeCustomerId,
    });
  }

  const fingerprint = identity.ownerKey.slice(3);
  const { creditsUsed } = await getAnonymousUsage(fingerprint);
  return NextResponse.json({
    kind: "anonymous",
    planName: "Anonymous",
    creditsBalance: Math.max(0, ANONYMOUS_CREDIT_LIMIT - creditsUsed),
    creditsLimit: ANONYMOUS_CREDIT_LIMIT,
    hasSubscription: false,
  });
}
