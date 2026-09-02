"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client";
import { LOCALE_COOKIE, SIGNED_IN_COOKIE } from "@/lib/cookies";
import { PageTracker } from "./PageTracker";
import type { Quota } from "@/lib/types";

// Client-side session/quota state for the whole page.
//
// Every page here is prerendered at build time (no cookies() during render),
// so the personalized bits — is this visitor signed in, how much quota is
// left — are resolved after hydration instead of during SSR. That keeps all
// 200+ SEO pages static and cacheable; the cost is one /api/quota round trip,
// which the header badge used to make anyway on its 10s refresh.
//
// The signed-in flag paints correctly on first render (no "Sign in" flash)
// because the auth callback also drops a non-httpOnly hint cookie next to the
// httpOnly session cookie — see app/api/auth/google/callback/route.ts.

export const QUOTA_EVENT = "iqt:quota";
const YEAR_PLUS = 400 * 86400;

type SessionValue = {
  quota: Quota | null;
  signedIn: boolean;
  refreshQuota: () => void;
};

const SessionContext = createContext<SessionValue>({
  quota: null,
  signedIn: false,
  refreshQuota: () => {},
});

export const useSession = () => useContext(SessionContext);

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

export function SessionProvider({
  locale,
  page,
  children,
}: {
  /** Remembered so a later visit to "/" lands on the language actually used (proxy.ts). */
  locale: string;
  /** Locale-stable analytics page key ("Home", "Pair", "Pricing", "Legal").
   *  Every page component wraps itself in this provider, which makes it the one
   *  place the pageview/scroll tracker has to be mounted. */
  page: string;
  children: React.ReactNode;
}) {
  const [quota, setQuota] = useState<Quota | null>(null);
  // useState initializer, not an effect: the very first paint already knows.
  const [signedIn, setSignedIn] = useState(() => readCookie(SIGNED_IN_COOKIE) === "1");

  const refreshQuota = useCallback(async () => {
    try {
      const res = await apiFetch("/api/quota");
      if (!res.ok) return;
      const next = (await res.json()) as Quota;
      setQuota(next);
      setSignedIn(next.kind === "account");
    } catch {
      /* keep the last known value */
    }
  }, []);

  useEffect(() => {
    refreshQuota();
    const timer = setInterval(refreshQuota, 10_000);
    window.addEventListener(QUOTA_EVENT, refreshQuota);
    return () => {
      clearInterval(timer);
      window.removeEventListener(QUOTA_EVENT, refreshQuota);
    };
  }, [refreshQuota]);

  useEffect(() => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${YEAR_PLUS}; samesite=lax`;
  }, [locale]);

  const value = useMemo(() => ({ quota, signedIn, refreshQuota }), [quota, signedIn, refreshQuota]);
  return (
    <SessionContext.Provider value={value}>
      <PageTracker page={page} />
      {children}
    </SessionContext.Provider>
  );
}
