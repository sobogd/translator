import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOTP, generateOTP, OTP_EXPIRY_MS, otpRateLimit } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

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

function normalize(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

export async function POST(req: Request) {
  let body: { email?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    // fall through with empty body
  }
  const email = typeof body.email === "string" ? normalize(body.email) : null;
  if (!email) {
    return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
  }
  const ip = clientIp(req);
  if (!otpRateLimit(`send:${email}`, 5, 15 * 60_000) || !otpRateLimit(`send:ip:${ip}`, 20, 15 * 60_000)) {
    return NextResponse.json({ ok: false, error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  const code = generateOTP();
  await prisma.otpCode.upsert({
    where: { email },
    create: {
      email,
      otpHash: hashOTP(code),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
    },
    update: {
      otpHash: hashOTP(code),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
    },
  });

  // Always 200, even if the mailer is missing/disabled — no address probing.
  void sendOtpEmail(email, code).catch(() => {});
  return NextResponse.json({ ok: true });
}
