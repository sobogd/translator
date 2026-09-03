import { NextResponse } from "next/server";
import { isbot } from "isbot";
import { resolveIdentity, resolveTopicId } from "@/lib/analytics/identity";
import { allowIngest } from "@/lib/analytics/rate-limit";
import { rawClientIp, rawClientUa, rawIngestHeaders, sendToIngest, type IngestEvent } from "@/lib/analytics/ingest";

// The one ingest path. Deliberately not named "track": that word is a literal
// entry in the common ad-blocker filter lists, and a blocked first batch loses
// the whole visit. The client posts `text/plain` so the request stays
// CORS-simple and `navigator.sendBeacon` can carry it during page teardown.
//
// This used to hash the request into a visit and store it in this app's own
// sessions_new/events_new tables (see git history). That pipeline moved to
// iq-metrix, a standalone service — this route now only validates, resolves
// who is asking (identity.ts, unchanged) and relays the batch over the
// network (lib/analytics/ingest.ts).

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
  /** Raw, not-yet-ownership-checked — only used to work out the batch's active
   *  conversation for `meta.topicId` below, never forwarded per-event. */
  topicId: string | null;
}

/** Buffered events arrive together; spacing the fallbacks 1ms apart keeps them
 *  in the order the visitor produced them. There is no local visit to clamp
 *  against anymore — iq-metrix resolves sessions from these timestamps itself. */
function eventAt(at: Date | null, now: Date, index: number): Date {
  return at ?? new Date(now.getTime() + index);
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

  const ua = rawClientUa(h);
  if (!ua || HARD_BOT_UA_REGEX.test(ua) || isbot(ua) || CRAWLER_UA_REGEX.test(ua)) {
    return NextResponse.json({});
  }
  const ip = rawClientIp(h);
  if (!allowIngest(ip || ua, now.getTime())) {
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

  // The batch's active conversation, for meta.topicId: the last event carrying
  // a topic id is the most recent state, i.e. whatever is open right now. Only
  // stamped when the caller actually owns it (resolveTopicId re-checks against
  // the DB — the id arrives from the client, so an unowned one is dropped).
  const lastTopicIdRaw = [...events].reverse().find((e) => e.topicId)?.topicId ?? null;
  const topicId = await resolveTopicId(who.email, lastTopicIdRaw);

  const ctx: TrackCtx = body.ctx && typeof body.ctx === "object" ? body.ctx : {};
  const from = typeof ctx.from === "string" && FROM_REGEX.test(ctx.from) ? ctx.from : undefined;
  const ref = typeof ctx.ref === "string" && HOST_REGEX.test(ctx.ref) ? ctx.ref.toLowerCase() : undefined;
  const theme = typeof ctx.theme === "string" && THEME_REGEX.test(ctx.theme) ? ctx.theme : undefined;
  const meta =
    topicId || from || ref || theme
      ? { ...(topicId ? { topicId } : {}), ...(from ? { from } : {}), ...(ref ? { ref } : {}), ...(theme ? { theme } : {}) }
      : undefined;

  const outEvents: IngestEvent[] = events.map((e, i) => ({
    page: e.page,
    action: e.action,
    name: e.name,
    locale: e.locale,
    at: eventAt(e.at, now, i).toISOString(),
  }));

  const result = await sendToIngest({
    site: "iq-translate",
    ip,
    ua,
    headers: rawIngestHeaders(h),
    email: who.email,
    ...(meta ? { meta } : {}),
    ...(typeof body.tok === "string" ? { tok: body.tok } : {}),
    events: outEvents,
  });

  return NextResponse.json(result.tok ? { v: result.tok } : {});
}
