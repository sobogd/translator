import { NextResponse } from "next/server";
import { generateSessionToken, getOrigin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = generateSessionToken();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString(), 302);
  res.cookies.set("translator_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return res;
}
