import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/analytics/admin-guard";

// Delete visits (events cascade). Used to drop our own visits from the numbers.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Postgres caps bind parameters at 65535 — refuse oversized batches loudly
 *  instead of letting the driver fail somewhere deep inside deleteMany. */
const MAX_DELETE_IDS = 5000;

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (ids.length === 0) return NextResponse.json({ deleted: 0 });
  if (ids.length > MAX_DELETE_IDS) {
    return NextResponse.json({ error: `too many ids (max ${MAX_DELETE_IDS})` }, { status: 400 });
  }

  const res = await prisma.sessionNew.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: res.count });
}
