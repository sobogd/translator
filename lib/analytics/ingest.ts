import { promises as fs } from "fs";
import path from "path";

// Forwarding layer to iq-metrix — the standalone analytics ingest service
// that now owns hashing, visit resolution and storage (a sibling repo, not
// part of this app). This app's job is reduced to: apply the hard bot/UA
// filter, resolve identity (identity.ts, unchanged — iq-metrix has no access
// to sessions/emails), and forward the raw request signals + event batch over
// the network.
//
// Two call sites share this module: the client ingest route
// (app/api/e/route.ts) and the server-fired sign-in/register event
// (lib/analytics/server-event.ts). Both go through the same
// forward-with-timeout + on-disk spool, so a transient iq-metrix outage never
// loses an event and never fails the caller.

const INGEST_URL = "http://127.0.0.1:8205/ingest";
const INGEST_TIMEOUT_MS = 250;

/** Accepts both a plain Headers (route handlers) and Next's ReadonlyHeaders.
 *  Ported from the old request-facts.ts, which owned this type before it was
 *  deleted — iq-metrix now does the hashing/coarsening that module used to. */
export type HeaderReader = { get(name: string): string | null };

/** Raw client IP — the first hop of whatever proxy header this stack trusts.
 *  No longer coarsened or hashed locally; iq-metrix owns that now. */
export function rawClientIp(h: HeaderReader): string {
  const raw = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  return raw.split(",")[0]?.trim() || "";
}

export function rawClientUa(h: HeaderReader): string {
  return h.get("user-agent") || "";
}

// The other raw signals request-facts.ts used to read besides ip/ua: the full
// Accept-Language header (hash entropy) and the geo headers nginx's
// ngx_http_geoip2 injects in prod (see docs/analytics.md). Forwarded verbatim
// — nothing is parsed, decoded or coarsened here anymore, iq-metrix does it.
const FORWARD_HEADER_NAMES = ["accept-language", "cf-ipcountry", "cf-region", "cf-ipcity"];

export function rawIngestHeaders(h: HeaderReader): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const name of FORWARD_HEADER_NAMES) {
    const v = h.get(name);
    if (v) out[name] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface IngestEvent {
  page: string;
  action: string;
  name: string;
  locale: string | null;
  at: string;
}

export interface IngestMeta {
  topicId?: string;
  from?: string;
  ref?: string;
  theme?: string;
}

export interface IngestPayload {
  site: "iq-translate";
  ip: string;
  ua: string;
  headers?: Record<string, string>;
  email: string | null;
  meta?: IngestMeta;
  tok?: string;
  events: IngestEvent[];
}

interface IngestResponse {
  tok?: string;
}

function ingestKey(): string | undefined {
  return process.env.INGEST_SHARED_SECRET || undefined;
}

/** One POST, bounded by `timeoutMs`. Never throws — every failure mode
 *  (network error, non-2xx, timeout, bad JSON) collapses to null so the
 *  caller has one branch to handle. */
async function postIngest(payload: IngestPayload, timeoutMs: number): Promise<IngestResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const key = ingestKey();
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "X-Ingest-Key": key } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => ({}))) as IngestResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Disk spool --------------------------------------------------------
//
// Safety net for when iq-metrix is unreachable or too slow: the batch that
// would otherwise be lost is appended as one NDJSON line and picked back up
// by the drain loop below. Deliberately a flat file, not a queue library —
// this app only ever has one process (see lib/rate-limit.ts's own note about
// the single pm2 upstream), so there is no multi-writer problem to solve.

const SPOOL_DIR = path.join(process.cwd(), "var", "spool");
const SPOOL_FILE = path.join(SPOOL_DIR, "analytics-events.ndjson");
const DRAIN_INTERVAL_MS = 10_000;
// Belt-and-braces cap on total spool size: if iq-metrix is down long enough
// for the file to cross this, retrying is no longer the right answer — warn
// instead of growing the file without bound.
const SPOOL_MAX_BYTES = 20 * 1024 * 1024;
// Per-tick cap so one drain pass cannot run for minutes straight (each failed
// line still pays the 250ms timeout) and block the next tick behind it.
const SPOOL_MAX_LINES_PER_DRAIN = 500;

async function spoolWrite(payload: IngestPayload): Promise<void> {
  try {
    await fs.mkdir(SPOOL_DIR, { recursive: true });
    const stat = await fs.stat(SPOOL_FILE).catch(() => null);
    if (stat && stat.size > SPOOL_MAX_BYTES) {
      console.warn(
        `[analytics] ingest spool ${SPOOL_FILE} is over ${SPOOL_MAX_BYTES} bytes and not draining — dropping event`,
      );
      return;
    }
    await fs.appendFile(SPOOL_FILE, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (e) {
    console.error("[analytics] failed to write ingest spool", e);
  }
}

/** Forward one payload to iq-metrix. Never throws and never leaves the caller
 *  waiting past the timeout — on failure the payload is handed off to the
 *  spool and this resolves to `{}`, which the route treats as a clean, tokenless
 *  success (the client just re-resolves fresh next batch). */
export async function sendToIngest(payload: IngestPayload): Promise<IngestResponse> {
  const res = await postIngest(payload, INGEST_TIMEOUT_MS);
  if (res) return res;
  await spoolWrite(payload);
  return {};
}

let draining = false;

async function drainSpool(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const raw = await fs.readFile(SPOOL_FILE, "utf8").catch(() => "");
    const lines = raw.split("\n").filter(Boolean);
    if (lines.length === 0) return;

    const batch = lines.slice(0, SPOOL_MAX_LINES_PER_DRAIN);
    const untouched = lines.slice(SPOOL_MAX_LINES_PER_DRAIN);
    const stillPending: string[] = [];

    for (const line of batch) {
      let payload: IngestPayload;
      try {
        payload = JSON.parse(line) as IngestPayload;
      } catch {
        continue; // corrupt line — drop it rather than wedge the spool forever
      }
      const res = await postIngest(payload, INGEST_TIMEOUT_MS);
      if (!res) stillPending.push(line);
    }
    stillPending.push(...untouched);

    if (stillPending.length === 0) {
      await fs.rm(SPOOL_FILE, { force: true });
    } else {
      await fs.writeFile(SPOOL_FILE, `${stillPending.join("\n")}\n`, "utf8");
      if (stillPending.length >= SPOOL_MAX_LINES_PER_DRAIN) {
        console.warn(`[analytics] ingest spool still has ${stillPending.length}+ lines pending after a drain pass`);
      }
    }
  } catch (e) {
    console.error("[analytics] ingest spool drain failed", e);
  } finally {
    draining = false;
  }
}

let drainTimer: ReturnType<typeof setInterval> | null = null;

/** Registered once at module load — this is a long-running Next.js server
 *  process (pm2), not serverless, so a module-scope interval is safe and
 *  outlives any single request. Guarded so a dev-mode module re-evaluation
 *  cannot stack a second interval on top of the first. */
function startDrainLoop(): void {
  if (drainTimer) return;
  drainTimer = setInterval(() => {
    void drainSpool();
  }, DRAIN_INTERVAL_MS);
}

startDrainLoop();
