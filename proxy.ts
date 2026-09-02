import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { LOCALE_COOKIE } from "@/lib/cookies";
import { locales, defaultLocale, type Locale } from "@/lib/locales";

// Note: Next.js 16 renamed the `middleware` file convention to `proxy`
// (see next.js upgrade guide) — this file is the `proxy.ts` equivalent of
// the classic `middleware.ts`, and only one is supported per project, so the
// locale redirect below lives in the same function as the session refresh.

function isAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

// Accept-Language only — this domain sits directly behind nginx (no
// Cloudflare in front), so there's no geo header to fall back to like
// iq-rest's landing does.
function detectLocale(req: NextRequest): Locale {
  const header = req.headers.get("accept-language") ?? "";
  const preferred = header.split(",")[0]?.split("-")[0]?.toLowerCase();
  return (locales as readonly string[]).includes(preferred ?? "") ? (preferred as Locale) : defaultLocale;
}

// Sliding session refresh: a session that's actively used should never
// actually hit the 400-day cookie ceiling. This is a blind refresh (no DB
// call here) — actual validity is re-checked by resolveOwner /
// getServerSessionEmail on every real request anyway, so a revoked/expired
// session just gets its browser-side timer reset harmlessly.
function refreshSession(req: NextRequest, res: NextResponse): void {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // English lives unprefixed at the root, but /en/<slug> used to render the
  // same page too (the [seg]/[pair] and [seg]/pricing routes happily match
  // seg="en"), which is a duplicate URL for every English page. Send it to the
  // canonical root form permanently.
  if (!isAssetPath(pathname) && (pathname === "/en" || pathname.startsWith("/en/"))) {
    const stripped = pathname.slice(3) || "/";
    const redirectUrl = new URL(stripped, req.url);
    redirectUrl.search = req.nextUrl.search;
    const response = NextResponse.redirect(redirectUrl, 301);
    refreshSession(req, response);
    return response;
  }

  // Only the bare root is language-routed. Anything else unprefixed is either
  // an English-only path (handled above) or simply not a page: redirecting
  // those to /<locale><path> only turned one 404 into a 302 + 404 chain.
  if (pathname === "/") {
    const preferred = req.cookies.get(LOCALE_COOKIE)?.value as Locale | undefined;
    const target = preferred && locales.includes(preferred) ? preferred : detectLocale(req);
    if (target !== defaultLocale) {
      const redirectUrl = new URL(`/${target}`, req.url);
      redirectUrl.search = req.nextUrl.search;
      const response = NextResponse.redirect(redirectUrl, 302);
      // The response varies by the request headers/cookie the choice is made
      // from — without this any shared cache (CDN, reverse proxy) would serve
      // one visitor's language to the next.
      response.headers.set("Vary", "Accept-Language, Cookie");
      refreshSession(req, response);
      return response;
    }
    const res = NextResponse.next();
    res.headers.set("Vary", "Accept-Language, Cookie");
    refreshSession(req, res);
    return res;
  }

  const res = NextResponse.next();
  refreshSession(req, res);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
