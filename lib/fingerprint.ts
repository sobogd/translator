"use client";

// A stable per-browser id for the unauthenticated translator: it's how the
// server tells one anonymous visitor's chats apart from another's (see
// resolveIdentity in lib/auth.ts). Cached in localStorage so repeat visits
// reuse the same id instead of recomputing (and, more importantly, so the
// visitor's chat history is found again). Ignored server-side whenever a
// real session cookie is present.

const STORAGE_KEY = "iqt_fingerprint";
const COOKIE_NAME = "iqt_fp";
let cached: Promise<string> | null = null;

// Mirrored into a cookie so the SERVER can compute the anonymous visitor's
// remaining quota during SSR (header badge renders with data on first paint
// for repeat visitors — see lib/quota-server.ts).
function syncCookie(id: string) {
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${400 * 86400}; samesite=lax`;
}

export function getFingerprint(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        syncCookie(stored);
        return stored;
      }
      const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      localStorage.setItem(STORAGE_KEY, result.visitorId);
      syncCookie(result.visitorId);
      return result.visitorId;
    })();
  }
  return cached;
}
