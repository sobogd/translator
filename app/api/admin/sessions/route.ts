import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/analytics/admin-guard";

// Admin read surface for the cookieless analytics pipeline (sessions_new /
// events_new). One visit per row, with its event aggregates resolved in the
// same query. Ported from iq-rest (apps/dashboard-api/src/admin/analytics-v2.controller.ts).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;
const DEFAULT_DAYS = 30;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface SessionListRow {
  id: string;
  firstAt: Date;
  lastAt: Date;
  device: string | null;
  os: string | null;
  country: string;
  region: string;
  city: string;
  lang: string | null;
  theme: string | null;
  from: string | null;
  ref: string | null;
  email: string | null;
  mergeCount: number;
  event_count: number;
  page_count: number;
  first_page: string | null;
  has_translate: boolean;
  has_register: boolean;
  locales: (string | null)[] | null;
  topic_ids: (string | null)[] | null;
  /** All-time visit count of the account, this visit included (1 if signed out). */
  user_visits: number;
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  // Window: `from` inclusive, `to` exclusive, both matched on s."firstAt". A
  // date-only `to` ("2026-09-02") parses as UTC midnight, so an exclusive bound
  // would swallow the whole named day — push it to the next UTC midnight so
  // that day is fully covered. Full ISO stamps (what the UI sends) are used
  // verbatim.
  const toDate = to ? new Date(to) : new Date();
  if (Number.isNaN(toDate.getTime())) return NextResponse.json({ error: "from/to invalid" }, { status: 400 });
  if (to && DATE_ONLY.test(to)) toDate.setUTCHours(24, 0, 0, 0);
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - DEFAULT_DAYS * 864e5);
  // A typo in a date must not read as "no traffic at all".
  if (Number.isNaN(fromDate.getTime())) return NextResponse.json({ error: "from/to invalid" }, { status: 400 });

  const rows = await prisma.$queryRaw<SessionListRow[]>(Prisma.sql`
    SELECT
      s.id, s."firstAt", s."lastAt", s.device, s.os, s.country, s.region, s.city,
      s.lang, s.theme, s."from", s.ref, s.email, s."mergeCount",
      ev.event_count,
      ev.page_count,
      ev.first_page,
      ev.has_translate,
      ev.has_register,
      ev.locales,
      (
        SELECT array_agg(v."topicId" ORDER BY v.first_at ASC)
        FROM (
          SELECT e2."topicId", MIN(e2.at) AS first_at
          FROM events_new e2
          WHERE e2."sessionId" = s.id AND e2."topicId" IS NOT NULL
          GROUP BY e2."topicId"
        ) v
      ) AS topic_ids,
      -- All-time, matching the detail endpoint: a visit is cut after 30 idle
      -- minutes, so the number worth showing is "how often has this account
      -- been here", not "how many rows survived the current window".
      CASE WHEN s.email IS NULL THEN 1
           ELSE (SELECT COUNT(*)::int FROM sessions_new uv WHERE uv.email = s.email)
      END AS user_visits
    FROM sessions_new s
    LEFT JOIN LATERAL (
      SELECT
        -- The ::int casts are load-bearing: a bare bigint arrives as a BigInt
        -- and JSON.stringify throws on it, 500-ing the whole endpoint.
        COUNT(*)::int AS event_count,
        COUNT(DISTINCT e.page)::int AS page_count,
        (array_agg(e.page ORDER BY e.at ASC))[1] AS first_page,
        -- COUNT over an empty set is 0, so those need no default — but bool_or
        -- over an empty set is NULL, and the UI types these boolean.
        COALESCE(bool_or(e.action = 'Translate'), false) AS has_translate,
        COALESCE(bool_or(e.action = 'Register'), false) AS has_register,
        array_remove(array_agg(DISTINCT e.locale), NULL) AS locales
      FROM events_new e
      WHERE e."sessionId" = s.id
    ) ev ON TRUE
    WHERE s."firstAt" >= ${fromDate} AND s."firstAt" < ${toDate}
    ORDER BY s."lastAt" DESC
    LIMIT ${MAX_ROWS}
  `);

  // Titles for every conversation the listed visits touched.
  const topicIds = [...new Set(rows.flatMap((r) => r.topic_ids ?? []).filter((v): v is string => !!v))];
  const topics = topicIds.length
    ? await prisma.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, title: true } })
    : [];
  const title = new Map(topics.map((t) => [t.id, t.title]));

  return NextResponse.json({
    // There is no pagination here on purpose, but the cut must be visible: a
    // silently trimmed list reads as "that was all the traffic".
    limit: MAX_ROWS,
    truncated: rows.length >= MAX_ROWS,
    sessions: rows.map((r) => ({
      id: r.id,
      firstAt: r.firstAt.toISOString(),
      lastAt: r.lastAt.toISOString(),
      device: r.device,
      os: r.os,
      country: r.country,
      region: r.region,
      city: r.city,
      lang: r.lang,
      theme: r.theme,
      from: r.from,
      ref: r.ref,
      eventCount: r.event_count,
      pageCount: r.page_count,
      firstPage: r.first_page,
      hasTranslate: r.has_translate,
      hasRegister: r.has_register,
      locales: (r.locales ?? []).filter((v): v is string => !!v),
      mergeCount: r.mergeCount,
      email: r.email,
      userVisits: r.user_visits,
      topics: (r.topic_ids ?? [])
        .filter((v): v is string => !!v)
        .map((id) => ({ id, title: title.get(id) ?? null })),
    })),
  });
}
