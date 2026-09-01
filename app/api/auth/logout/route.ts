import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, hashSessionToken, parseCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const token = parseCookie(cookieHeader, SESSION_COOKIE);

  if (token) {
    const tokenHash = hashSessionToken(token);
    // Let any DB error propagate (500) instead of swallowing it: if the
    // Session row isn't actually deleted, the cookie must not be cleared,
    // otherwise a captured raw token would remain valid indefinitely.
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
