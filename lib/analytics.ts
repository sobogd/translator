// Cookieless analytics client. Every event is a page/action/name triple
// ("Home" / "Click" / "Header sign in") POSTed to /api/e, which derives the
// visit from a salted hash of the request itself — nothing is stored on the
// visitor's device, so the site needs no cookie banner.
//
// Ported from iq-rest (apps/landing/lib/analytics.ts). Two wire details are
// load-bearing:
//   • `/api/e` — a readable "track"-style path is on every ad-blocker list.
//   • `text/plain` body — keeps the POST a CORS-*simple* request and is the
//     only content type `navigator.sendBeacon` can carry, which is what we
//     rely on during page unload.
const ENDPOINT = "/api/e";
const CONTENT_TYPE = "text/plain;charset=UTF-8";

const SEARCH_HOST_REGEX =
  /(?:^|\.)(google|bing|yandex|duckduckgo|yahoo|baidu|ecosia|qwant|startpage|mojeek|brave)\.[a-z.]+$/i;

// Assistants that send real referred traffic. Kept apart from the search list
// because they are a different acquisition channel, and because this regex has
// to be tested FIRST: gemini.google.com and copilot.microsoft.com would
// otherwise be swallowed by the search pattern and counted as Google/Bing.
//
// Most assistants strip or shorten the referrer, so what lands here is a floor
// on the channel, never the whole of it — the rest shows up as direct.
const AI_HOST_REGEX =
  /(?:^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|anthropic\.com|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com|poe\.com)$/i;

// Mirrors the server-side validation. An event that fails it rejects the WHOLE
// batch, so a bad page label would silently kill unrelated events — clamp at
// the source instead.
const PAGE_REGEX = /^[A-Za-z0-9][A-Za-z0-9 _\-./+]{0,63}$/;

/** True when `label` is accepted by the server as a page/action value. */
export function isValidPageLabel(label: string): boolean {
  return PAGE_REGEX.test(label);
}

export interface TrackCtx {
  from?: string;
  ref?: string;
  theme?: string;
}

// Current page label, set by PageTracker on mount so deep components (header,
// footer, account modal) don't need the page threaded through props.
let currentPage = "Home";
// Rendered locale of the page the visitor is on. Stamped per event rather than
// per visit: one visit can cross locales (a /es visitor opening an English pair
// page), and a per-visit value would describe only the first page.
let currentLocale: string | undefined;
// Conversation open in the widget. Per event for the same reason.
let currentTopic: string | undefined;

export function setTrackPage(page: string): void {
  currentPage = isValidPageLabel(page) ? page : "Home";
}

export function setTrackLocale(locale: string): void {
  currentLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : undefined;
}

export function setTrackTopic(topicId: string | null | undefined): void {
  currentTopic = topicId && /^[a-z0-9]{20,40}$/.test(topicId) ? topicId : undefined;
}

/** Referrer host, kept only when it is a search engine or an AI assistant.
 *  Anything else (social, our own domain, random sites) stays out of the DB —
 *  the column is an acquisition-channel signal, not a full referrer log. */
export function searchReferrerHost(): string | null {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const host = new URL(ref).hostname;
    // AI first: gemini.google.com matches the search pattern too.
    if (AI_HOST_REGEX.test(host)) return host;
    return SEARCH_HOST_REGEX.test(host) ? host : null;
  } catch {
    return null;
  }
}

// In dev we do not want clicks from `next dev` polluting the numbers. Skip
// entirely unless the build is production, or the developer opted in with
// NEXT_PUBLIC_ANALYTICS_DEV=1.
const TRACKING_ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ANALYTICS_DEV === "1";

// Events are buffered and posted in batches: one request instead of ten when a
// visitor clicks through quickly, one identity resolution per batch on the
// server, and enough headroom under the endpoint's 10 req/s burst limit.
const FLUSH_MS = 2000;
// Server hard-caps a batch at 50; stay well under so a burst still fits.
const MAX_BATCH = 20;
// Upper bound on the buffer while retries are pending. On overflow the OLDEST
// events go — the newest ones describe what the visitor is doing right now.
const MAX_QUEUE = 100;
// Only transient failures are retried, and only a few times: a visitor on a
// flaky connection should not accumulate an unbounded retry tail.
const RETRY_DELAYS_MS = [2000, 5000, 15000];
// After the ladder is exhausted, keep a slow heartbeat rather than parking the
// buffer with nothing scheduled to send it.
const RETRY_PARK_MS = 60_000;

interface QueuedEvent {
  page: string;
  action: string;
  name: string;
  /** Epoch ms of when the event happened, not when it is sent — a retried or
   *  beaconed batch must not collapse onto its delivery time. The server
   *  accepts [now-6h, now+60s]. */
  ts: number;
  /** Rendered locale at the moment of the event. */
  loc?: string;
  /** Conversation open at the moment of the event. */
  tid?: string;
}

interface Batch {
  events: QueuedEvent[];
  ctx?: TrackCtx;
}

let queue: QueuedEvent[] = [];
let pendingCtx: TrackCtx | undefined;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let retryAttempt = 0;
// Visit continuation token from the last ingest response. Lives ONLY in this
// module variable — never in a cookie or any storage, so nothing is persisted
// on the visitor's device and the pipeline stays consentless. Echoing it on the
// next batch pins the batch to the same visit even when the device hash flaps
// mid-visit (a mobile IP prefix changing between requests). Dies with the page;
// a fresh load simply starts token-less and the server falls back to the hash.
let visitToken: string | null = null;

function serialize(events: QueuedEvent[], ctx?: TrackCtx): string {
  return JSON.stringify({
    events,
    ...(ctx ? { ctx } : {}),
    ...(visitToken ? { tok: visitToken } : {}),
  });
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer) clearTimeout(timer);
  return null;
}

function takeBatch(): Batch | null {
  if (queue.length === 0) return null;
  const events = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  const ctx = pendingCtx;
  pendingCtx = undefined;
  return { events, ctx };
}

/** Put a failed batch back at the FRONT of the queue so ordering survives a
 *  retry, and restore its ctx. */
function requeue(batch: Batch): void {
  queue = batch.events.concat(queue);
  // Merge *under* whatever arrived meanwhile: context collected after the
  // failed send is fresher and must win.
  if (batch.ctx) pendingCtx = { ...batch.ctx, ...pendingCtx };
  trimQueue();
}

function trimQueue(): void {
  if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE);
}

function scheduleFlush(): void {
  if (flushTimer || inFlight || retryTimer) return;
  flushTimer = setTimeout(send, FLUSH_MS);
}

function onFailure(batch: Batch): void {
  requeue(batch);
  const exhausted = retryAttempt >= RETRY_DELAYS_MS.length;
  const delay = exhausted ? RETRY_PARK_MS : RETRY_DELAYS_MS[retryAttempt];
  retryAttempt = exhausted ? 0 : retryAttempt + 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    send();
  }, delay);
}

function send(): void {
  flushTimer = clearTimer(flushTimer);
  if (inFlight || retryTimer) return;
  const batch = takeBatch();
  if (!batch) return;
  inFlight = true;
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": CONTENT_TYPE },
    body: serialize(batch.events, batch.ctx),
    credentials: "same-origin",
    // Survives the tab closing mid-flight.
    keepalive: true,
  })
    .then((res) => {
      inFlight = false;
      // 400 means the payload itself is invalid — a retry replays the exact
      // same bytes, so drop it instead of looping. Everything else (5xx, 429,
      // proxy hiccup) is transient and worth another attempt.
      if (res.ok || res.status === 400) {
        if (res.ok) {
          // The server answers with a fresh visit continuation token.
          void res
            .json()
            .then((d: unknown) => {
              const v = (d as { v?: unknown } | null)?.v;
              if (typeof v === "string") visitToken = v;
            })
            .catch(() => {});
        }
        retryAttempt = 0;
        if (queue.length > 0) scheduleFlush();
        return;
      }
      onFailure(batch);
    })
    .catch(() => {
      inFlight = false;
      onFailure(batch);
    });
}

function beacon(body: string): boolean {
  try {
    return navigator.sendBeacon(ENDPOINT, new Blob([body], { type: CONTENT_TYPE }));
  } catch {
    return false;
  }
}

/** Unload path: the document is going away, so there is nobody left to retry.
 *  Drain everything buffered in beacon-sized chunks and forget it. Also used
 *  for the explicit pre-navigation flush() — a beacon is the only send the
 *  browser guarantees to complete after the document is discarded. */
function flushOnUnload(): void {
  flushTimer = clearTimer(flushTimer);
  retryTimer = clearTimer(retryTimer);
  // The ladder belongs to the failure it was climbing; leaving it part-way
  // means the next transient error starts near the top and gives up early.
  retryAttempt = 0;
  let ctx = pendingCtx;
  pendingCtx = undefined;
  while (queue.length > 0) {
    const events = queue.slice(0, MAX_BATCH);
    queue = queue.slice(MAX_BATCH);
    const body = serialize(events, ctx);
    // Only the first chunk carries ctx — the server applies it first-write-wins.
    ctx = undefined;
    if (!beacon(body)) {
      // Beacon refused (unsupported, or over the UA's queue limit) — a
      // keepalive fetch is the next best fire-and-forget option.
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": CONTENT_TYPE },
        body,
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {});
    }
  }
}

export interface TrackOptions {
  /** Skip the 2s buffer and post right now. For page-entry events (Pageview):
   *  a visitor who bounces inside the buffer window would otherwise leave no
   *  trace, and everything after the pageview waits on its visit token. Later
   *  interaction events still batch as usual. */
  instant?: boolean;
}

function track(action: string, name: string, ctx?: TrackCtx, opts?: TrackOptions): void {
  if (typeof window === "undefined") return;
  if (!TRACKING_ENABLED) {
    if (typeof console !== "undefined") {
      console.debug(`[analytics:disabled] ${currentPage}/${action}/${name}`, ctx ?? "");
    }
    return;
  }
  queue.push({
    page: currentPage,
    action,
    name,
    ts: Date.now(),
    ...(currentLocale ? { loc: currentLocale } : {}),
    ...(currentTopic ? { tid: currentTopic } : {}),
  });
  if (ctx) pendingCtx = { ...pendingCtx, ...ctx };
  trimQueue();

  if (queue.length >= MAX_BATCH || opts?.instant) {
    send();
    return;
  }
  scheduleFlush();
}

// Registered once at module load rather than lazily inside track(): a visitor
// who leaves right after the pageview would otherwise never have had a hook
// installed, losing the whole visit.
if (typeof window !== "undefined" && TRACKING_ENABLED) {
  // pagehide fires on iOS Safari where unload does not.
  window.addEventListener("pagehide", flushOnUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnUnload();
  });
}

export const analytics = {
  track,
  setPage: setTrackPage,
  setLocale: setTrackLocale,
  setTopic: setTrackTopic,
  /** Force-send the buffer — call right before a full-page navigation. */
  flush: flushOnUnload,
};
