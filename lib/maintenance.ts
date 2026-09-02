import { prisma } from "./prisma";

// Two tables only ever grew: `sessions` (rows were never deleted, not even on
// logout) and `anonymous_credits` (one row per fingerprint, forever). Neither
// is big enough to deserve a cron on this box, so the prune rides along with a
// request the app already makes constantly — at most once an hour per process.

const EVERY_MS = 3600_000;
/** A fingerprint that has not been seen in this long is a different visitor in
 *  practice: IP, browser build and language have all had time to change. */
const ANON_KEEP_DAYS = 180;

let nextRunAt = 0;

export function maybePrune(): void {
  const now = Date.now();
  if (now < nextRunAt) return;
  nextRunAt = now + EVERY_MS;
  void (async () => {
    try {
      await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await prisma.anonymousCredit.deleteMany({
        where: { createdAt: { lt: new Date(now - ANON_KEEP_DAYS * 86_400_000) } },
      });
    } catch (err) {
      console.error("[maintenance] prune failed", err);
    }
  })();
}
