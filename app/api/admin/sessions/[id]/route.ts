import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/analytics/admin-guard";

// One visit: every stored field plus its full event timeline and the other
// visits of the same account. Ported from iq-rest's admin detail endpoint.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const session = await prisma.sessionNew.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const events = await prisma.eventNew.findMany({
    where: { sessionId: id },
    orderBy: { at: "asc" },
    select: { id: true, page: true, action: true, name: true, at: true, topicId: true, locale: true },
  });

  // Other visits of the same person — the only cross-day link we have, and only
  // because they signed in. Anonymous visits from other salt-days are
  // unlinkable by construction. The list is capped for the UI, but the count is
  // queried separately: it is the same all-time number the list shows, and
  // `take + 1` would silently top out at 51.
  const otherVisits = session.email
    ? await prisma.sessionNew.findMany({
        where: { email: session.email, id: { not: id } },
        orderBy: { firstAt: "desc" },
        select: { id: true, firstAt: true, country: true, city: true, device: true },
        take: 50,
      })
    : [];
  const userVisits = session.email
    ? await prisma.sessionNew.count({ where: { email: session.email } })
    : 1;

  const topicIds = [...new Set(events.map((e) => e.topicId).filter((v): v is string => !!v))];
  const topics = topicIds.length
    ? await prisma.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, title: true } })
    : [];
  const title = new Map(topics.map((t) => [t.id, t.title]));

  // The detail must carry the SAME shape the list does — the UI types both as
  // one TrafficSession, so a field present only in the list reads back as
  // undefined here. The aggregates come from the events already loaded.
  const { visitKey: _visitKey, ...rest } = session;
  return NextResponse.json({
    session: {
      ...rest,
      firstAt: session.firstAt.toISOString(),
      lastAt: session.lastAt.toISOString(),
      // The hash is the raw visit key — of no use in the UI and better not
      // echoed around; expose only a short prefix for eyeballing duplicates.
      hash: session.hash.slice(0, 12),
      userVisits,
      eventCount: events.length,
      pageCount: new Set(events.map((e) => e.page)).size,
      firstPage: events[0]?.page ?? null,
      hasTranslate: events.some((e) => e.action === "Translate"),
      hasRegister: events.some((e) => e.action === "Register"),
      locales: [...new Set(events.map((e) => e.locale).filter((v): v is string => !!v))],
      // topicIds keeps the order of `events` (ascending `at`), i.e. first topic
      // touched first — the same rule the list applies.
      topics: topicIds.map((tid) => ({ id: tid, title: title.get(tid) ?? null })),
    },
    events: events.map((e) => ({
      ...e,
      at: e.at.toISOString(),
      topicTitle: e.topicId ? (title.get(e.topicId) ?? null) : null,
    })),
    otherVisits: otherVisits.map((v) => ({ ...v, firstAt: v.firstAt.toISOString() })),
  });
}
