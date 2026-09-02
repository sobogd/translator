import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIdentity } from "@/lib/auth";
import { getAccountUsage } from "@/lib/credits";
import { FREE_TRIAL } from "@/lib/plans";
import { isAnalyticsAdmin } from "@/lib/analytics/identity";

export const runtime = "nodejs";

// Remaining quota for the header badge / account modal. Anonymous visitors
// resolve via the request-derived fingerprint (lifetime trial pool); signed-in users
// via their account balances (fingerprint deliberately unused).
export async function GET(req: NextRequest) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (identity.kind === "anonymous") {
    const fingerprint = identity.ownerKey.slice(3);
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
    plan: plan?.id ?? "FREE",
    planName: plan?.name ?? null,
    chars: Math.max(0, account.charsBalance),
    seconds: Math.max(0, account.secondsBalance),
    // Rides along with the quota the account modal already polls, so the admin
    // button needs no request of its own.
    isAdmin: isAnalyticsAdmin(account.email),
  });
}
