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

// Server-Component-friendly variant using next/headers cookies().
export async function getServerSessionEmail(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  return verifySessionToken(token);
}
