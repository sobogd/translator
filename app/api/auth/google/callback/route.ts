import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  generateSessionToken,
  hashSessionToken,
  isAllowed,
  parseCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

const STATE_COOKIE = "translator_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieHeader = req.headers.get("cookie");
  const expectedState = parseCookie(cookieHeader, STATE_COOKIE);

  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Always clear the single-use state cookie regardless of outcome.
  const bounce = () => {
    const res = NextResponse.redirect(new URL("/", origin), 302);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return bounce();
  }

  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) return bounce();

    const verifier = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await verifier.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || payload.email_verified !== true) {
      return bounce();
    }

    const email = payload.email.trim().toLowerCase();
    if (!isAllowed(email)) {
      return bounce();
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    await prisma.session.create({ data: { email, tokenHash, expiresAt: null } });

    const res = NextResponse.redirect(new URL("/", origin), 302);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
    return res;
  } catch {
    return bounce();
  }
}
