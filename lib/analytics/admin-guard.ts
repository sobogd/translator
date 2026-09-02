import { NextResponse } from "next/server";
import { resolveOwner } from "@/lib/auth";
import { isAnalyticsAdmin } from "./identity";

// Gate in front of the traffic endpoints. The account modal paints its button
// from the `isAdmin` flag on /api/quota, but that is only paint — every read
// and the delete re-check the session here.

export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const email = await resolveOwner(req);
  if (!isAnalyticsAdmin(email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
