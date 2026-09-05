import { NextResponse } from "next/server";
import { getOrigin, generateSessionToken } from "@/lib/auth";
import { appleConfig, appleConfigured } from "@/lib/apple";

export const runtime = "nodejs";

const STATE_COOKIE = "translator_oauth_state";

export async function GET(req: Request) {
  const origin = getOrigin(req);
  const fail = () => NextResponse.redirect(new URL("/?apple_error=1", origin), 302);
  if (!appleConfigured()) return fail();

  const state = generateSessionToken();
  const cfg = appleConfig();
  const redirectUri = `${origin}/api/auth/apple/callback`;
  const params = new URLSearchParams({
    client_id: cfg.servicesId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  const res = NextResponse.redirect(
    new URL(`https://appleid.apple.com/auth/authorize?${params.toString()}`),
    302,
  );
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
