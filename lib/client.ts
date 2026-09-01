"use client";

import { getFingerprint } from "./fingerprint";

// Every request carries the browser fingerprint as a fallback identity — the
// server only falls back to it when there is no valid session cookie (see
// resolveIdentity in lib/auth.ts), so this is a no-op for signed-in users.
export async function apiFetch(input: string, init: RequestInit = {}) {
  const fingerprint = await getFingerprint();
  const headers = new Headers(init.headers);
  if (!headers.has("x-fingerprint")) headers.set("x-fingerprint", fingerprint);
  return fetch(input, { ...init, headers });
}
