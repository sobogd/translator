import { prisma } from "@/lib/prisma";
import { getSalt } from "./salt";
import { sessionHash } from "./session-hash";
import { resolveVisit } from "./visit";
import { clientNetwork, clientUa, hashEntropy, visitSeed, type HeaderReader } from "./request-facts";

// Events the client cannot fire truthfully — a sign-in only becomes real on the
// server, after Google's token exchange. Derives the visit from exactly the
// same request facts the ingest route uses, so the event lands on the visit
// that produced it instead of starting a new one.
//
// Ported from iq-rest's conversion service (handleRegistration), minus the ad
// networks: here it only writes the event and stitches the identity.

export interface ServerEvent {
  page: string;
  action: string;
  name: string;
}

/** Fire-and-forget: analytics must never fail an auth request. */
export function trackServerEvent(h: HeaderReader, email: string | null, event: ServerEvent): Promise<void> {
  return record(h, email, event).catch(() => {});
}

async function record(h: HeaderReader, email: string | null, event: ServerEvent): Promise<void> {
  const now = new Date();
  const hash = sessionHash(await getSalt(), clientNetwork(h), clientUa(h), hashEntropy(h));
  // Promotes the anonymous visit in place, so the pageviews that led here keep
  // their row. With no live visit (tracking blocked, or the visitor arrived
  // somewhere we never saw) a row is created from this request's own facts.
  const session = await resolveVisit(hash, email, visitSeed(h), now);
  await prisma.eventNew.create({
    data: { sessionId: session.id, page: event.page, action: event.action, name: event.name, at: now },
  });
}
