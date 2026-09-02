import { NextResponse } from "next/server";
import { isbot } from "isbot";
import type { SessionNew } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSalt } from "@/lib/analytics/salt";
import { sessionHash } from "@/lib/analytics/session-hash";
import { continueVisit, enrich, resolveVisit } from "@/lib/analytics/visit";
import { resolveIdentity, resolveTopicId } from "@/lib/analytics/identity";
import { allowIngest } from "@/lib/analytics/rate-limit";
import { signVisitToken, tokenSecret, verifyVisitToken } from "@/lib/analytics/visit-token";
import {
  clientIp,
  clientNetwork,
  clientUa,
  hashEntropy,
  visitSeed,
} from "@/lib/analytics/request-facts";

// The one ingest path. Deliberately not named "track": that word is a literal
// entry in the common ad-blocker filter lists, and a blocked first batch loses
// the whole visit. The client posts `text/plain` so the request stays
// CORS-simple and `navigator.sendBeacon` can carry it during page teardown.
//
// Ported from iq-rest (apps/dashboard-api/src/analytics-v2/track-v2.controller.ts).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// page / action / name: short human-readable English labels ("Home", "Click",
// "Header sign in"). Free-form by design — no enums.
const LABEL_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _\-./+]{0,63}$/;
// Names carry the detail (error slugs especially), so they get more room.
const NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _\-./+()#:,'%]{0,119}$/;
const FROM_REGEX = /^[A-Za-z0-9_.-]{1,64}$/;
const HOST_REGEX = /^[a-z0-9.-]{1,253}$/i;
const THEME_REGEX = /^(dark|light)$/;
const LOCALE_REGEX = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const CUID_REGEX = /^[a-z0-9]{20,40}$/;
const MAX_EVENTS_PER_BATCH = 50;
const MAX_BODY_CHARS = 64_000;

// How far a client-supplied event timestamp may sit from server time before we
// stop believing it. Batches are retried with backoff, so a few minutes of lag
// is normal; anything beyond this is a broken clock.
const TS_MAX_PAST_MS = 6 * 3600_000;
const TS_MAX_FUTURE_MS = 60_000;

// Server-side clients (curl/axios/headless) and crawlers that `isbot` misses.
const HARD_BOT_UA_REGEX =
  /axios\/|node-fetch|got\/|http_request|httpclient|java\/|okhttp|libwww|lwp-trivial|HttpClient|Apache-HttpClient|python-requests|curl\/|wget|HeadlessChrome|PhantomJS|Screaming Frog|Sitebulb/i;
const CRAWLER_UA_REGEX =
  /AdsBot|Google-InspectionTool|GoogleOther|APIs-Google|FeedFetcher-Google|Storebot-Google|GoogleProducer|ChromeOS-Default-Bot/i;

interface TrackCtx {
  from?: unknown;
  ref?: unknown;
  theme?: unknown;
}

interface RawEvent {
  page?: unknown;
  action?: unknown;
  name?: unknown;
  /** Epoch ms the event actually happened, stamped by the client. Batching
   *  means the request time says nothing about when the events occurred. */
  ts?: unknown;
  /** Locale the page was rendered in. Per-event, not per-batch: a batch can
   *  survive a locale switch. */
  loc?: unknown;
  /** Conversation open at the moment of the event (validated server-side). */
  tid?: unknown;
}

interface TrackBody extends RawEvent {
  /** Batch form. Single-event form (page/action/name at the top level) is also
   *  accepted so a page can fire one event without buffering. */
  events?: unknown;
  ctx?: TrackCtx;
  /** Visit continuation token echoed from a previous response. */
  tok?: unknown;
}

interface ParsedEvent {
  page: string;
  action: string;
  name: string;
  at: Date | null;
  locale: string | null;
  topicId: string | null;
}

/** Buffered events arrive together; spacing the fallbacks 1ms apart keeps them
 *  in the order the visitor produced them. */
function clampToVisit(at: Date | null, firstAt: Date, now: Date, index: number): Date {
  const fallback = new Date(now.getTime() + index);
  if (!at) return fallback;
  return at < firstAt ? firstAt : at;
}

function parseTs(raw: unknown, now: Date): Date | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const delta = now.getTime() - raw;
  if (delta > TS_MAX_PAST_MS || delta < -TS_MAX_FUTURE_MS) return null;
  return new Date(raw);
}

function parseEvent(raw: RawEvent, now: Date): ParsedEvent | null {
  const page = typeof raw.page === "string" && LABEL_REGEX.test(raw.page) ? raw.page : null;
  const action = typeof raw.action === "string" && LABEL_REGEX.test(raw.action) ? raw.action : null;
  const name = typeof raw.name === "string" && NAME_REGEX.test(raw.name) ? raw.name : null;
  if (!page || !action || !name) return null;
  return {
    page,
    action,
    name,
    at: parseTs(raw.ts, now),
    locale: typeof raw.loc === "string" && LOCALE_REGEX.test(raw.loc) ? raw.loc.toLowerCase() : null,
    topicId: typeof raw.tid === "string" && CUID_REGEX.test(raw.tid) ? raw.tid : null,
  };
}

function parseBody(raw: string): TrackBody | null {
  if (raw.length > MAX_BODY_CHARS) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as TrackBody) : {};
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const now = new Date();
  const h = req.headers;

  const ua = clientUa(h);
  if (!ua || HARD_BOT_UA_REGEX.test(ua) || isbot(ua) || CRAWLER_UA_REGEX.test(ua)) {
    return NextResponse.json({});
  }
  if (!allowIngest(clientIp(h) || ua, now.getTime())) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const body = parseBody(await req.text());
  if (!body) return NextResponse.json({ error: "body invalid" }, { status: 400 });

  const rawEvents: RawEvent[] = Array.isArray(body.events)
    ? (body.events as RawEvent[]).slice(0, MAX_EVENTS_PER_BATCH)
    : [body];
  const events = rawEvents
    .map((e) => (e && typeof e === "object" ? parseEvent(e, now) : null))
    .filter((e): e is ParsedEvent => e !== null);
  if (events.length === 0) return NextResponse.json({ error: "event invalid" }, { status: 400 });

  // One identity resolution per batch, not per event.
  const who = await resolveIdentity(h);
  if (who.skip) return NextResponse.json({});

  const secret = tokenSecret();

  // A batch carrying a valid continuation token lands on its own visit row
  // directly — immune to the hash flapping mid-visit (mobile network prefix or
  // geo changing between requests).
  let session: SessionNew | null = null;
  if (secret && typeof body.tok === "string") {
    const sid = verifyVisitToken(body.tok, secret, now);
    if (sid) session = await continueVisit(sid, who.email, now);
  }

  if (!session) {
    // Raw IP and raw UA live only on this stack frame — hashed and derived,
    // never stored.
    const hash = sessionHash(await getSalt(), clientNetwork(h), ua, hashEntropy(h));
    session = await resolveVisit(hash, who.email, visitSeed(h), now);
  }

  // Pin the resolved row: `session` is a `let`, so its narrowing does not
  // survive into the createMany callback below.
  const visit: SessionNew = session;

  const ctx: TrackCtx = body.ctx && typeof body.ctx === "object" ? body.ctx : {};
  await enrich(visit, {
    from: typeof ctx.from === "string" && FROM_REGEX.test(ctx.from) ? ctx.from : null,
    ref: typeof ctx.ref === "string" && HOST_REGEX.test(ctx.ref) ? ctx.ref.toLowerCase() : null,
    theme: typeof ctx.theme === "string" && THEME_REGEX.test(ctx.theme) ? ctx.theme : null,
  });

  // Topic ids repeat across a batch; resolve each distinct one once.
  const owned = new Map<string, string | null>();
  for (const id of new Set(events.map((e) => e.topicId).filter((v): v is string => !!v))) {
    owned.set(id, await resolveTopicId(who.email, id));
  }

  await prisma.eventNew.createMany({
    data: events.map((e, i) => ({
      sessionId: visit.id,
      page: e.page,
      action: e.action,
      name: e.name,
      topicId: e.topicId ? (owned.get(e.topicId) ?? null) : null,
      locale: e.locale,
      // Client time, but never before the visit it lands on. A buffer that
      // survived a long offline stretch arrives with timestamps from a visit
      // that has since been closed by the 30-minute cut, and an event dated
      // before its own visit's firstAt corrupts every "first page" aggregate
      // the admin computes by ordering on `at`.
      at: clampToVisit(e.at, visit.firstAt, now, i),
    })),
  });

  // Fresh token every response: its liveness window slides with the visit's
  // lastAt, and the beacon/keepalive callers that cannot read a body simply
  // keep their previous one.
  return NextResponse.json(secret ? { v: signVisitToken(visit.id, secret, now) } : {});
}
