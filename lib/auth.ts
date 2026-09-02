import crypto from "crypto";
import { prisma } from "./prisma";

// Resolve the owner of a request into the verified, lowercased Google email
// address for the signed-in session. Identity is established via Google OAuth
// (see app/api/auth/google/**); sessions are opaque tokens stored (hashed) in
// the database. Returns null when no valid session is present.

export const SESSION_COOKIE = "translator_session";

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

// Reconstruct the externally-visible origin behind the nginx TLS-terminating
// reverse proxy. req.url reflects the plain-HTTP connection Node actually
// sees (127.0.0.1:8200), not the public https:// origin, so building a
// Google OAuth redirect_uri from it produces the wrong scheme and Google
// rejects it with redirect_uri_mismatch. nginx forwards the real
// scheme/host via X-Forwarded-Proto/X-Forwarded-Host; fall back to req.url
// for local dev (no proxy in front there).
export function getOrigin(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
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

export type Identity = { ownerKey: string; kind: "account" | "anonymous" };

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

// Unified identity for chat/translate endpoints: a verified Google session
// ("account", ownerKey = email) or, absent one, the request's own computed
// fingerprint ("anonymous", ownerKey = "fp:<fingerprint>") so the landing's
// embedded translator works without signing in. Chat.ownerKey is a plain
// string either way, so both kinds share the exact same chat/translation
// rows and code paths — only credit consumption (lib/credits.ts) branches.
export async function resolveIdentity(req: Request): Promise<Identity | null> {
  const owner = await resolveOwner(req);
  if (owner) {
    return isAllowed(owner) ? { ownerKey: owner, kind: "account" } : null;
  }
  return { ownerKey: `fp:${computeFingerprint(req.headers)}`, kind: "anonymous" };
}

// Server-Component-friendly variant using next/headers cookies().
export async function getServerSessionEmail(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  return verifySessionToken(token);
}
