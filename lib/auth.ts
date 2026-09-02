import crypto from "crypto";
import { prisma } from "./prisma";
import { SITE_URL } from "./site";

// Resolve the owner of a request into the verified, lowercased Google email
// address for the signed-in session. Identity is established via Google OAuth
// (see app/api/auth/google/**); sessions are opaque tokens stored (hashed) in
// the database. Returns null when no valid session is present.

export const SESSION_COOKIE = "translator_session";

/** Hard ceiling on a session's life. It used to be `expiresAt: null` — never —
 *  which made a leaked cookie valid forever with no way to age it out. */
export const SESSION_TTL_MS = 400 * 86_400_000;

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Allowlist gate. If ALLOWED_GOOGLE_EMAILS is set (comma-separated emails),
// only those emails pass. Empty/unset => open.
export function isAllowed(email: string): boolean {
  const list = (process.env.ALLOWED_GOOGLE_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(email.trim().toLowerCase());
}

const SITE_HOST = new URL(SITE_URL).host;

function isLocalHost(host: string): boolean {
  const name = host.split(":")[0];
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "[::1]" ||
    name.endsWith(".local") ||
    name.startsWith("192.168.")
  );
}

// Reconstruct the externally-visible origin behind the nginx TLS-terminating
// reverse proxy. req.url reflects the plain-HTTP connection Node actually
// sees (127.0.0.1:8200), not the public https:// origin, so building a
// Google OAuth redirect_uri from it produces the wrong scheme and Google
// rejects it with redirect_uri_mismatch. nginx forwards the real
// scheme/host via X-Forwarded-Proto/X-Forwarded-Host; fall back to req.url
// for local dev (no proxy in front there).
//
// nginx does NOT overwrite X-Forwarded-Host, so that header is whatever the
// caller decided to send. It feeds the OAuth redirect_uri, Stripe's
// success/cancel/return URLs and the auth callback's bounce redirect — all of
// which must point at us. Anything that is not this site (or a dev host) falls
// back to the canonical origin instead of being trusted.
export function getOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  if (isLocalHost(host)) return `${proto}://${host}`;
  return host === SITE_HOST ? `${proto}://${host}` : SITE_URL;
}

// Parse a raw `cookie` header value by hand and return the named cookie's
// value, or null if absent. Kept dependency-free to match the rest of this
// file's style.
export function parseCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

// Shared verification: given a raw session token, look it up and return the
// email if it's a valid, unexpired session.
async function verifySessionToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return null;
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;
  return session.email;
}

export async function resolveOwner(req: Request): Promise<string | null> {
  const token = parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return verifySessionToken(token);
}

export type Identity = {
  /** Who owns the topics and their stored translations. */
  ownerKey: string;
  /** Which free/plan pool the request spends from (lib/credits.ts). */
  quotaKey: string;
  kind: "account" | "anonymous";
};

// Server-computed anonymous id — no client library, no localStorage, no
// cookie round-trip. Hashes signals the browser sends on every request
// regardless of privacy mode (IP, User-Agent, Accept-Language): unlike
// canvas/audio/WebGL entropy, incognito doesn't randomize these, so this id
// stays stable across incognito windows being closed and reopened, which a
// client-side fingerprinting library (FingerprintJS) doesn't reliably do —
// browsers deliberately add noise to that kind of signal in private mode.
// Trade-off: an IP shared by many people (office NAT, mobile carrier CGNAT)
// on the same browser/OS/language combo collides into one pool — acceptable
// for a free-trial abuse guard, not meant to be a hard identity.
//
// Which is exactly why it is no longer what OWNS anything: it used to be the
// topic's ownerKey too, so a collision handed two strangers behind one NAT
// read and delete access to each other's translated texts. Ownership now
// rides on the anonymous id cookie below; the fingerprint keeps only the job
// it was designed for, rationing the free pool.
// Accepts both a plain Headers (Route Handlers) and Next's ReadonlyHeaders
// (Server Components via next/headers) — same `.get()` shape, different type.
type HeaderReader = { get(name: string): string | null };

function clientIp(headers: HeaderReader): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function computeFingerprint(headers: HeaderReader): string {
  const material = [clientIp(headers), headers.get("user-agent") || "", headers.get("accept-language") || ""].join("|");
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 32);
}

/** Opaque per-browser id for signed-out visitors, minted by proxy.ts on the
 *  first page view. 128 random bits, stored nowhere: holding it IS the claim,
 *  the same way the session token is for accounts. */
export const ANON_COOKIE = "iqt_anon";
const ANON_ID_REGEX = /^[a-f0-9]{32}$/;

export function anonIdFrom(headers: HeaderReader): string | null {
  const raw = parseCookie(headers.get("cookie"), ANON_COOKIE);
  return raw && ANON_ID_REGEX.test(raw) ? raw : null;
}

// Unified identity for topic/translate endpoints: a verified Google session
// ("account", ownerKey = email) or, absent one, the browser's anonymous id
// ("anonymous", ownerKey = "an:<id>") so the landing's embedded translator
// works without signing in. Topic.ownerKey is a plain string either way, so
// both kinds share the exact same topic/translation rows and code paths.
//
// A visitor who blocks cookies outright still gets an identity — the old
// fingerprint one ("fp:<hash>") — rather than a broken widget; that path keeps
// the collision caveat above, which is why it is the fallback and not the rule.
export async function resolveIdentity(req: Request): Promise<Identity | null> {
  const owner = await resolveOwner(req);
  if (owner) {
    if (!isAllowed(owner)) return null;
    return { ownerKey: owner, quotaKey: owner, kind: "account" };
  }
  const quotaKey = `fp:${computeFingerprint(req.headers)}`;
  const anonId = anonIdFrom(req.headers);
  return { ownerKey: anonId ? `an:${anonId}` : quotaKey, quotaKey, kind: "anonymous" };
}

// Server-Component-friendly variant using next/headers cookies().
export async function getServerSessionEmail(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  return verifySessionToken(token);
}
