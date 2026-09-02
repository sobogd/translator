import crypto from "crypto";

// Visit continuation token: `<sessionId>.<issuedAtMs>.<hmac>`. The ingest
// response hands it to the client, which keeps it ONLY in a module variable of
// the live page (never in a cookie or any storage — the pipeline stays
// consentless) and echoes it on subsequent batches. It exists because the
// device hash is built from the network prefix + geo, and on mobile networks
// those flap mid-visit: the same person, same tab, produces a second hash and
// therefore a second visit row seconds after the first. The token pins the
// batch to the visit row directly, so a hash change no longer splits it.
//
// The HMAC only proves WE minted the id — without it anyone could append events
// to an arbitrary visit by guessing cuids. `iat` bounds replay; the real
// liveness gate is the row's own lastAt (30-min idle window), checked by the
// visit service.
//
// Ported from iq-rest (apps/dashboard-api/src/analytics-v2/visit-token.ts).

const TOKEN_TTL_MS = 30 * 60_000;
const TOKEN_MAX_CHARS = 200;
const SCOPE = "visit-v1";

/** HMAC key. Empty disables tokens entirely — the pipeline degrades to pure
 *  hash matching and nothing breaks. */
export function tokenSecret(): string {
  return process.env.ANALYTICS_TOKEN_SECRET || "";
}

function mac(sessionId: string, iat: number, secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update(`${SCOPE}|${sessionId}|${iat}`).digest();
}

export function signVisitToken(sessionId: string, secret: string, now: Date): string {
  const iat = now.getTime();
  return `${sessionId}.${iat}.${mac(sessionId, iat, secret).toString("base64url")}`;
}

/** Returns the sessionId a valid, unexpired token points at, else null. */
export function verifyVisitToken(token: string, secret: string, now: Date): string | null {
  if (token.length > TOKEN_MAX_CHARS) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, iatRaw, sig] = parts;
  const iat = Number(iatRaw);
  if (!sessionId || !Number.isFinite(iat)) return null;
  const age = now.getTime() - iat;
  if (age > TOKEN_TTL_MS || age < -60_000) return null;
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  const expected = mac(sessionId, iat, secret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return sessionId;
}
