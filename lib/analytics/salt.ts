import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Rotating hash salt for the cookieless visit key. Ported from iq-rest
// (apps/dashboard-api/src/analytics-v2/salt.service.ts) with the nightly cron
// dropped: there is no scheduler in this app, and the cron was only ever a belt
// over the lazy rotation below.

const SALT_ROW_ID = "current";
// Rotation boundary: 04:00 Europe/Madrid — the dead hour for the EU audience,
// so a visit cut in half by the salt change is a rare statistical blip.
const ROTATION_HOUR = 4;
// In-memory cache TTL — the ingest path must not hit the DB for the salt on
// every batch. Single pm2 process, so one cache is the whole truth; a cluster
// deployment would need this moved.
const CACHE_TTL_MS = 60_000;
// How long a visit is kept before the daily rotation deletes it (events cascade).
// Stated in the privacy policy — see app/_landing/legal-content.ts, section 10.
const RETENTION_DAYS = 365;

interface SaltRow {
  value: string;
  rotatedAt: Date;
}

/** Salt-day key: the Madrid calendar date of (t − 4h). Two timestamps share a
 *  salt iff they fall between the same pair of 04:00-Madrid boundaries. */
function saltPeriodKey(t: Date): string {
  const shifted = new Date(t.getTime() - ROTATION_HOUR * 3600_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

let cache: { value: string; readAt: number } | null = null;
/** Single-flight guard. Two requests arriving together just after a boundary
 *  would otherwise both rotate, and the second overwrite would orphan every
 *  hash the first one produced. */
let rotating: Promise<SaltRow> | null = null;

/** Overwrite the singleton with a fresh random salt. The overwrite destroys the
 *  previous salt — that is what makes yesterday's hashes unlinkable. */
async function rotate(): Promise<SaltRow> {
  // Re-check under the guard: the caller may have queued behind a rotation that
  // already moved us into the current salt-day.
  const existing = await prisma.analyticsSalt.findUnique({ where: { id: SALT_ROW_ID } });
  if (existing && saltPeriodKey(existing.rotatedAt) === saltPeriodKey(new Date())) {
    cache = { value: existing.value, readAt: Date.now() };
    return existing;
  }
  const row = await prisma.analyticsSalt.upsert({
    where: { id: SALT_ROW_ID },
    create: { id: SALT_ROW_ID, value: crypto.randomBytes(32).toString("hex"), rotatedAt: new Date() },
    update: { value: crypto.randomBytes(32).toString("hex"), rotatedAt: new Date() },
  });
  cache = { value: row.value, readAt: Date.now() };
  // Retention sweep rides on the rotation because that is the one thing here
  // that already happens exactly once a day. Never allowed to fail the request
  // that triggered it — the salt is what the caller actually needed.
  void prisma.sessionNew
    .deleteMany({ where: { firstAt: { lt: new Date(Date.now() - RETENTION_DAYS * 864e5) } } })
    .catch(() => {});
  return row;
}

function rotateOnce(): Promise<SaltRow> {
  if (rotating) return rotating;
  rotating = rotate().finally(() => {
    rotating = null;
  });
  return rotating;
}

/** Current salt. Rotates lazily when the stored one is from a previous
 *  salt-day, so the first visit after 04:00 Madrid pays one upsert. */
export async function getSalt(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.readAt < CACHE_TTL_MS) return cache.value;

  let row: SaltRow | null = await prisma.analyticsSalt.findUnique({ where: { id: SALT_ROW_ID } });
  if (!row || saltPeriodKey(row.rotatedAt) !== saltPeriodKey(new Date())) row = await rotateOnce();
  cache = { value: row.value, readAt: now };
  return row.value;
}
