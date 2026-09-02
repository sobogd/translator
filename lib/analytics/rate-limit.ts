import { allowRequest } from "@/lib/rate-limit";

// The analytics ingest limit now shares the app-wide limiter (lib/rate-limit.ts)
// — same fixed-window logic, one sweep, one map. Kept as a named wrapper
// because the route reads better with the intent spelled out.

/** 10 req/s burst, 200/min sustained, per client. */
export function allowIngest(client: string, now = Date.now()): boolean {
  return allowRequest("ingest", client, now);
}
