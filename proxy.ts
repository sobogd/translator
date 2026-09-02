import { NextRequest, NextResponse } from "next/server";
import { ANON_COOKIE, SESSION_COOKIE } from "@/lib/auth";
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

// Anonymous ownership id, minted on the first request that arrives without
// one. Signed-out visitors own their topics through this cookie rather than
// through the request fingerprint, which collides for everyone behind one NAT
// running the same browser and language (see resolveIdentity in lib/auth.ts) —
// and a collision there used to mean shared access to each other's translated
// texts. 128 random bits; nothing is stored server-side, holding it is the
// claim. Web Crypto, because this file runs on the edge runtime.
function ensureAnonId(req: NextRequest, res: NextResponse): void {
  if (req.cookies.get(ANON_COOKIE)?.value) return;
  res.cookies.set(ANON_COOKIE, crypto.randomUUID().replace(/-/g, ""), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
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

// Cross-site write guard. The session cookie is SameSite=Lax, which already
// stops a cross-site form POST from carrying it, but Lax has a documented
// grace window for top-level POSTs in some browsers and the API surface is
// only going to grow. A browser sends `Origin` on every state-changing
// request; a non-browser caller (Stripe's webhook, curl) sends none, and
// those authenticate on their own terms.
function crossSiteWrite(req: NextRequest): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== (req.headers.get("host") ?? req.nextUrl.host);
  } catch {
    return true;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (crossSiteWrite(req)) {
    return NextResponse.json({ error: "cross_site" }, { status: 403 });
  }

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
    ensureAnonId(req, response);
    return response;
  }

  // The PWA's start_url. A manifest has exactly one, so it points at the
  // English workspace and the visitor's own language is resolved here — same
  // cookie-then-Accept-Language order as the root, so launching the installed
  // app lands on /<locale>/app.
  if (pathname === "/app") {
    const preferred = req.cookies.get(LOCALE_COOKIE)?.value as Locale | undefined;
    const target = preferred && locales.includes(preferred) ? preferred : detectLocale(req);
    if (target !== defaultLocale) {
      const redirectUrl = new URL(`/${target}/app`, req.url);
      redirectUrl.search = req.nextUrl.search;
      const response = NextResponse.redirect(redirectUrl, 302);
      response.headers.set("Vary", "Accept-Language, Cookie");
      refreshSession(req, response);
      return response;
    }
    const res = NextResponse.next();
    res.headers.set("Vary", "Accept-Language, Cookie");
    refreshSession(req, res);
    ensureAnonId(req, res);
    return res;
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
    ensureAnonId(req, res);
    return res;
  }

  const res = NextResponse.next();
  refreshSession(req, res);
  ensureAnonId(req, res);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
