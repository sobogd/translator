import { Prisma, type SessionNew } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { visitKey } from "./session-hash";
import type { VisitSeed } from "./request-facts";

// One visit = one row. A visit starts anonymous (keyed by the day-scoped device
// hash) and is promoted in place the moment a session cookie resolves, so the
// events fired before signing in stay on the same row.
//
// Visits of the same person on other days are separate rows sharing an email —
// the admin screen groups them. Anonymous rows from other salt-days stay
// unlinkable by construction: the salt that produced their hash is gone.
//
// Ported from iq-rest (apps/dashboard-api/src/analytics-v2/visit.service.ts).

/**
 * A visit ends after this much silence. Without it a "visit" is the whole
 * salt-day: a morning arrival and an unrelated evening sign-in from the same
 * NAT'd ip+ua land on one row.
 */
export const VISIT_IDLE_MS = 30 * 60_000;

export type { VisitSeed } from "./request-facts";

/** First-touch attribution — may arrive on a later event than the first. */
export interface VisitAttribution {
  from: string | null;
  ref: string | null;
  theme: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** updateMany, not update: a concurrent batch may have folded this row away
 *  between the read and the write, and `update` would throw P2025 and 500 a
 *  request whose only job was to bump a timestamp. */
async function touch(id: string, now: Date): Promise<void> {
  await prisma.sessionNew.updateMany({ where: { id }, data: { lastAt: now } });
}

/** Move an anonymous row's events onto the signed-in row and drop it. */
async function fold(anon: SessionNew, target: SessionNew, now: Date): Promise<SessionNew> {
  const [, merged] = await prisma.$transaction([
    prisma.eventNew.updateMany({ where: { sessionId: anon.id }, data: { sessionId: target.id } }),
    prisma.sessionNew.update({
      where: { id: target.id },
      data: {
        lastAt: now,
        mergeCount: { increment: 1 },
        firstAt: anon.firstAt < target.firstAt ? anon.firstAt : target.firstAt,
        // Attribution the anonymous half carried and the signed-in row lacks.
        ...(target.from === null && anon.from !== null ? { from: anon.from } : {}),
        ...(target.ref === null && anon.ref !== null ? { ref: anon.ref } : {}),
        ...(target.theme === null && anon.theme !== null ? { theme: anon.theme } : {}),
      },
    }),
    // deleteMany, not delete: two concurrent batches can both decide to fold,
    // and `delete` on an already-deleted row aborts the whole transaction
    // (P2025) — losing the second batch's events.
    prisma.sessionNew.deleteMany({ where: { id: anon.id } }),
  ]);
  return merged;
}

/** Find, promote or create the live visit row for this device hash + identity.
 *  `seed` is only used when a row has to be created. */
export async function resolveVisit(
  hash: string,
  email: string | null,
  seed: VisitSeed,
  now: Date,
): Promise<SessionNew> {
  // Only rows still inside the idle window can continue; anything older is a
  // finished visit and must not absorb new events.
  const liveSince = new Date(now.getTime() - VISIT_IDLE_MS);
  const rows = await prisma.sessionNew.findMany({
    where: { hash, lastAt: { gte: liveSince } },
    orderBy: { firstAt: "asc" },
  });
  const mine = rows.find((r) => r.email === email) ?? null;
  const anon = email ? (rows.find((r) => r.email === null) ?? null) : null;

  if (mine) {
    // Signed out mid-visit and back in: fold the stray anonymous row in.
    if (anon) return fold(anon, mine, now);
    await touch(mine.id, now);
    return { ...mine, lastAt: now };
  }

  if (anon && email) {
    // Promote in place — keeps firstAt and every pre-sign-in event on the row.
    // Keyed off the visit's own start so two racing promotions produce the same
    // key and one of them loses cleanly.
    const key = visitKey(hash, email, anon.firstAt);
    try {
      return await prisma.sessionNew.update({
        where: { id: anon.id },
        data: { email, visitKey: key, lastAt: now },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const won = await prisma.sessionNew.findUnique({ where: { visitKey: key } });
      if (won) return won;
    }
  }

  const key = visitKey(hash, email, now);
  try {
    return await prisma.sessionNew.create({
      data: { visitKey: key, hash, email, ...seed, firstAt: now, lastAt: now },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const won = await prisma.sessionNew.findUnique({ where: { visitKey: key } });
    if (won) return won;
    throw e;
  }
}

/**
 * Continue the exact visit a client-echoed token points at. Bypasses the device
 * hash entirely — this is the fix for mid-visit hash flaps (mobile network
 * prefix / geo changing between batches). Returns null when the row is gone,
 * idle-expired, or belongs to a DIFFERENT signed-in account than the caller
 * (signed out mid-visit, or a shared browser switched accounts) — the caller
 * then falls back to the hash path.
 */
export async function continueVisit(
  sessionId: string,
  email: string | null,
  now: Date,
): Promise<SessionNew | null> {
  const row = await prisma.sessionNew.findUnique({ where: { id: sessionId } });
  if (!row || row.lastAt.getTime() < now.getTime() - VISIT_IDLE_MS) return null;

  if (row.email === email) {
    await touch(row.id, now);
    return { ...row, lastAt: now };
  }

  if (row.email === null && email) {
    // Signed in mid-visit: promote in place, exactly like the hash path.
    const key = visitKey(row.hash, email, row.firstAt);
    try {
      return await prisma.sessionNew.update({
        where: { id: row.id },
        data: { email, visitKey: key, lastAt: now },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      return await prisma.sessionNew.findUnique({ where: { visitKey: key } });
    }
  }

  return null;
}

/** First-write-wins enrichment: a later event in the same visit may be the
 *  first to carry a `from` / `ref` / theme. Never overwrites a set value. */
export async function enrich(session: SessionNew, attr: VisitAttribution): Promise<void> {
  // Each field is written under a "still empty" condition instead of being
  // decided from the `session` object, which was read before any concurrent
  // batch got its write in. Otherwise two batches racing to be first both see
  // null and the loser overwrites the winner.
  if (attr.from && !session.from) {
    await prisma.sessionNew.updateMany({ where: { id: session.id, from: null }, data: { from: attr.from } });
  }
  if (attr.ref && !session.ref) {
    await prisma.sessionNew.updateMany({ where: { id: session.id, ref: null }, data: { ref: attr.ref } });
  }
  if (attr.theme && !session.theme) {
    await prisma.sessionNew.updateMany({ where: { id: session.id, theme: null }, data: { theme: attr.theme } });
  }
}
