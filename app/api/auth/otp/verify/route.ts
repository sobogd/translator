import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_OTP_ATTEMPTS, hashOTP, otpRateLimit, safeCompare } from "@/lib/otp";
import { isAllowed } from "@/lib/auth";
import { establishSession, applyAuthCookies } from "@/lib/auth-session";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_HEADERS = ["x-real-ip", "x-forwarded-for"];

function clientIp(req: Request): string {
  for (const name of IP_HEADERS) {
    const v = req.headers.get(name);
    if (v) return v.split(",")[0].trim() || "unknown";
  }
  return "unknown";
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  let body: { email?: unknown; code?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown; code?: unknown };
  } catch {
    // fall through
  }
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_RE.test(rawEmail) || !code) {
    return bad("INVALID_CODE");
  }
  const ip = clientIp(req);
  if (!otpRateLimit(`verify:${rawEmail}`, 10, 15 * 60_000) || !otpRateLimit(`verify:ip:${ip}`, 60, 15 * 60_000)) {
    return bad("TOO_MANY_ATTEMPTS", 429);
  }

  const row = await prisma.otpCode.findUnique({ where: { email: rawEmail } });
  if (!row) return bad("INVALID_CODE");

  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.deleteMany({ where: { email: rawEmail } });
    return bad("CODE_EXPIRED");
  }
  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.deleteMany({ where: { email: rawEmail } });
    return bad("TOO_MANY_ATTEMPTS", 429);
  }
  if (!safeCompare(row.otpHash, hashOTP(code))) {
    await prisma.otpCode.update({
      where: { email: rawEmail },
      data: { attempts: row.attempts + 1 },
    });
    return bad("INVALID_CODE");
  }

  // Burn the challenge, then gate + establish the session (same as Google).
  await prisma.otpCode.deleteMany({ where: { email: rawEmail } });
  if (!isAllowed(rawEmail)) {
    return bad("NOT_ALLOWED", 403);
  }

  const token = await establishSession(req, rawEmail, "Email");
  const res = NextResponse.json({ ok: true, email: rawEmail });
  applyAuthCookies(res, token);
  return res;
}
