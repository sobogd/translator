// Email OTP challenges (ported from iq-mermaid's lib/otp.ts). Identity is the
// lowercased verified email; codes are 6 digits, hashed with sha256, valid for
// 5 minutes, max 5 failed attempts. Rate limiting is in-memory fixed window
// (single pm2 process — same assumption as lib/rate-limit.ts).
import crypto from "crypto";

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

/** 6-digit code in 100000–999999 (no leading zero by construction). */
export function generateOTP(): string {
  return String((crypto.randomBytes(4).readUInt32BE(0) % 900000) + 100000);
}

export function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Constant-time compare of two strings given as hex buffers. */
export function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---- fixed-window limiter (send/verify) ----
interface Window {
  count: number;
  resetAt: number;
}
const windows = new Map<string, Window>();

function hit(key: string, limit: number, windowMs: number, now: number): boolean {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

/** True when within the limit; the window refreshes on its own. */
export function otpRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  return hit(`otp:${key}`, limit, windowMs, now);
}
