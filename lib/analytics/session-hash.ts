import crypto from "crypto";

// Ported from iq-rest (apps/dashboard-api/src/analytics-v2/session-hash.ts).

/** Bucket width used to make concurrent "create a visit" races converge on the
 *  same key instead of inserting two rows. */
const KEY_BUCKET_MS = 60_000;

/** Day-scoped device key: sha256(salt | ip | ua | extra). The salt rotates daily
 *  and the old one is destroyed, so the hash is unlinkable across salt-days.
 *  `extra` (see hashEntropy) separates people who share an ip+ua behind a NAT. */
export function sessionHash(salt: string, ip: string, ua: string, extra = ""): string {
  return crypto.createHash("sha256").update(`${salt}|${ip}|${ua}|${extra}`).digest("hex");
}

/**
 * Dedup key of one visit: sha256(hash | email | bucket).
 *
 * The device hash alone cannot be the key — the same device produces many
 * visits (a new one after 30 minutes of silence, and a separate one per person
 * who signs in on it). `bucket` is derived from the visit's start time, so a
 * later visit on the same device gets a different key while two racing requests
 * that start the same visit converge on one.
 */
export function visitKey(hash: string, email: string | null, startedAt: Date): string {
  const bucket = Math.floor(startedAt.getTime() / KEY_BUCKET_MS);
  return crypto.createHash("sha256").update(`${hash}|${email ?? ""}|${bucket}`).digest("hex");
}
