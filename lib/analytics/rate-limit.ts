// Fixed-window limiter for the ingest endpoint. iq-rest gets this from
// @nestjs/throttler; here it is a few lines of memory, which is enough because
// the app runs as a single pm2 process (a cluster deployment would need a
// shared store).

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
/** Sweep threshold — the map only ever holds live windows plus whatever expired
 *  since the last write, and the sweep is O(size) at most once per 1000 hits. */
const SWEEP_EVERY = 1000;
let writes = 0;

function hit(key: string, limit: number, windowMs: number, now: number): boolean {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

function sweep(now: number): void {
  if (++writes < SWEEP_EVERY) return;
  writes = 0;
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

/** Same shape as the iq-rest throttle on this route: 10 req/s burst, 200/min
 *  sustained, per client. Returns false when the caller is over either. */
export function allowIngest(client: string, now = Date.now()): boolean {
  sweep(now);
  const burst = hit(`b|${client}`, 10, 1_000, now);
  const sustained = hit(`s|${client}`, 200, 60_000, now);
  return burst && sustained;
}
