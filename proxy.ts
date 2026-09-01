import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Sliding session refresh: a session that's actively used should never
// actually hit the 400-day cookie ceiling. This is a blind refresh (no DB
// call here) — actual validity is re-checked by resolveOwner /
// getServerSessionEmail on every real request anyway, so a revoked/expired
// session just gets its browser-side timer reset harmlessly.
//
// Note: Next.js 16 renamed the `middleware` file convention to `proxy`
// (see next.js upgrade guide) — this file is the `proxy.ts` equivalent of
// the classic `middleware.ts`.

export function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const res = NextResponse.next();
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
