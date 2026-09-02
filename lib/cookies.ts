// Cookie names shared by server routes, the proxy and client components.
// Kept in their own module (no prisma/next-headers imports) so a "use client"
// file can read them without pulling the server half of lib/auth.ts in.

/** Non-httpOnly yes/no twin of the session cookie — see app/_landing/session.tsx. */
export const SIGNED_IN_COOKIE = "iqt_signed_in";

/** Last locale actually used, honoured by the Accept-Language redirect in proxy.ts. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
