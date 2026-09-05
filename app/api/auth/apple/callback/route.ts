import { NextResponse } from "next/server";
import { getOrigin, isAllowed, parseCookie } from "@/lib/auth";
import { appleConfigured, exchangeAuthCode, verifyAppleIdToken } from "@/lib/apple";
import { establishSession, applyAuthCookies } from "@/lib/auth-session";

export const runtime = "nodejs";

const STATE_COOKIE = "translator_oauth_state";

export async function POST(req: Request) {
  const origin = getOrigin(req);
  const home = new URL("/", origin);
  const failUrl = new URL("/?apple_error=1", origin);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(failUrl, 302);
  }
  const code = form.get("code");
  const state = form.get("state");
  const error = form.get("error");
  const expectedState = parseCookie(req.headers.get("cookie"), STATE_COOKIE);

  if (
    error ||
    typeof code !== "string" ||
    !code ||
    typeof state !== "string" ||
    !expectedState ||
    state !== expectedState
  ) {
    return NextResponse.redirect(failUrl, 302);
  }

  try {
    if (!appleConfigured()) {
      return NextResponse.redirect(failUrl, 302);
    }
    const redirectUri = `${origin}/api/auth/apple/callback`;
    const idToken = await exchangeAuthCode(code, redirectUri);
    const identity = await verifyAppleIdToken(idToken);
    const email = identity.email?.trim().toLowerCase();
    if (!email || !identity.emailVerified || !isAllowed(email)) {
      return NextResponse.redirect(failUrl, 302);
    }

    const token = await establishSession(req, email, "Apple");
    const res = NextResponse.redirect(home, 302);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    applyAuthCookies(res, token);
    return res;
  } catch {
    return NextResponse.redirect(failUrl, 302);
  }
}
