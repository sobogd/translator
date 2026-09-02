import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getAccountUsage } from "@/lib/credits";
import { FREE_TRIAL } from "@/lib/plans";
import { isAnalyticsAdmin } from "@/lib/analytics/identity";
import { allowRequest } from "@/lib/rate-limit";
import { maybePrune } from "@/lib/maintenance";

export const runtime = "nodejs";

// Remaining quota for the header badge / account modal. Anonymous visitors
// resolve via the request-derived fingerprint (lifetime trial pool); signed-in
// users via their account balances (fingerprint deliberately unused).
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allowRequest("quota", identity.quotaKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // The most-called endpoint in the app, which makes it the cheapest place to
  // hang the hourly table prune off.
  maybePrune();

  if (identity.kind === "anonymous") {
    const fingerprint = identity.quotaKey.slice(3);
    const row = await prisma.anonymousCredit.findUnique({ where: { fingerprint } });
    return NextResponse.json({
      kind: "anonymous",
      plan: "FREE",
      chars: Math.max(0, FREE_TRIAL.chars - (row?.charsUsed ?? 0)),
      seconds: Math.max(0, FREE_TRIAL.seconds - (row?.secondsUsed ?? 0)),
    });
  }

  const { account, plan } = await getAccountUsage(identity.ownerKey);
  return NextResponse.json({
    kind: "account",
    email: account.email,
    // `plan` is the ENTITLED plan (lib/credits.ts): a subscription that is not
    // ACTIVE reads back as FREE here, which is exactly what the account modal
    // should be showing while a payment is failing.
    plan: plan?.id ?? "FREE",
    planName: plan?.name ?? null,
    subscriptionStatus: account.subscriptionStatus,
    chars: Math.max(0, account.charsBalance),
    seconds: Math.max(0, account.secondsBalance),
    // Rides along with the quota the account modal already polls, so the admin
    // button needs no request of its own.
    isAdmin: isAnalyticsAdmin(account.email),
  });
}
