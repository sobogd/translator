"use client";

// A stable per-browser id for the unauthenticated translator: it's how the
// server tells one anonymous visitor's chats apart from another's (see
// resolveIdentity in lib/auth.ts). Cached in localStorage so repeat visits
// reuse the same id instead of recomputing (and, more importantly, so the
// visitor's chat history is found again). Ignored server-side whenever a
// real session cookie is present.

const STORAGE_KEY = "iqt_fingerprint";
let cached: Promise<string> | null = null;

export function getFingerprint(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      localStorage.setItem(STORAGE_KEY, result.visitorId);
      return result.visitorId;
    })();
  }
  return cached;
}
