import crypto from "crypto";
import { computeFingerprint, parseCookie, type Identity } from "./auth";

// Cloudflare Turnstile gate for the endpoints that actually spend Gemini
// tokens (/api/translate, /api/translate-voice). Only anonymous identities
// are challenged: a signed-in account already has a verified Google identity
// and a paid/limited pool behind it, while the free anonymous pool is keyed
// on a fingerprint anyone can rotate by changing IP or User-Agent.
//
// A Turnstile token is single-use and only valid for ~5 minutes, so solving
// on every message would put a challenge round-trip in front of every turn
// of a conversation. Instead one solve is exchanged for a short-lived pass
// cookie (below), and only that cookie is checked per request.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_PASS_COOKIE = "iqt_ts_pass";

// 30 minutes: long enough that a normal conversation never re-challenges,
// short enough that a stolen cookie is worth little.
export const PASS_TTL_SECONDS = 30 * 60;

function secret(): string {
  return process.env.TS_SECRET || "";
}

// Both halves must be configured or the gate stays off entirely — a missing
// secret in some environment must not lock translation out.
export function turnstileEnabled(): boolean {
  return Boolean(process.env.TS_SECRET && process.env.TS_SITE);
}

export function requiresTurnstile(identity: Identity): boolean {
  return turnstileEnabled() && identity.kind === "anonymous";
}

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || null;
}

export async function verifyTurnstileToken(token: string, req: Request): Promise<boolean> {
  if (!token || !secret()) return false;
  const form = new URLSearchParams({ secret: secret(), response: token });
  const ip = clientIp(req);
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// Pass value: "<expiry-ms>.<hmac>", signed with TS_SECRET over the request's
// own fingerprint — the cookie is worthless from another IP/UA/language
// combination, so it can't be handed around to bypass the challenge.
function sign(fingerprint: string, expiresAt: number): string {
  return crypto.createHmac("sha256", secret()).update(`${fingerprint}.${expiresAt}`).digest("hex");
}

export function issuePass(req: Request): string {
  const expiresAt = Date.now() + PASS_TTL_SECONDS * 1000;
  const fingerprint = computeFingerprint(req.headers);
  return `${expiresAt}.${sign(fingerprint, expiresAt)}`;
}

export function hasValidPass(req: Request): boolean {
  const raw = parseCookie(req.headers.get("cookie"), TURNSTILE_PASS_COOKIE);
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot === -1) return false;
  const expiresAt = Number(raw.slice(0, dot));
  const mac = raw.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(computeFingerprint(req.headers), expiresAt);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
