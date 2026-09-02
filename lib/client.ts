"use client";

// Thin fetch wrapper — kept as the one call site every component already
// uses. Anonymous identity no longer rides along on the client at all: the
// server derives it straight from the request's own IP/User-Agent/
// Accept-Language (see computeFingerprint in lib/auth.ts).
export async function apiFetch(input: string, init: RequestInit = {}) {
  return fetch(input, init);
}
