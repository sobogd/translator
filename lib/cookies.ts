// Cookie names shared by server routes, the proxy and client components.
// Kept in their own module (no prisma/next-headers imports) so a "use client"
// file can read them without pulling the server half of lib/auth.ts in.

import { LANGUAGES } from "./languages";

/** Non-httpOnly yes/no twin of the session cookie — see app/_landing/session.tsx. */
export const SIGNED_IN_COOKIE = "iqt_signed_in";

/** Last locale actually used, honoured by the Accept-Language redirect in proxy.ts. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Pair last used on the /app workspace, "<from|auto>_<to>" (e.g. "de_es",
 *  "auto_fr"). A cookie, not localStorage: the app routes read it during
 *  render, so the pair row paints correct on the first frame instead of
 *  jumping to the remembered pair after hydration. */
export const PAIR_COOKIE = "iqt_pair";

export type StoredPair = { source: string | null; target: string };

export const formatPairCookie = (source: string | null, target: string): string =>
  `${source ?? "auto"}_${target}`;

/** Parses and validates the cookie — an unknown/garbage code is dropped so a
 *  hand-edited cookie can never render a language that doesn't exist. */
export function parsePairCookie(value: string | undefined | null): StoredPair | null {
  if (!value) return null;
  const [from, to] = value.split("_");
  if (!to || !isLanguageCode(to)) return null;
  const source = from === "auto" ? null : isLanguageCode(from) ? from : null;
  return { source, target: to };
}

const isLanguageCode = (code: string | undefined): boolean =>
  !!code && LANGUAGES.some((l) => l.code === code);

/** Client-side cookie read. Returns null on the server, where document does
 *  not exist — callers on prerendered pages read this from an effect. */
export function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}
