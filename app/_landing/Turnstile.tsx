"use client";

import { useCallback, useRef } from "react";

// Client half of the Turnstile gate (server half: lib/turnstile.ts). The
// widget is rendered explicitly and in "execute" mode with the
// interaction-only appearance: nothing is visible until Cloudflare actually
// decides this visitor needs to interact, so the normal case stays a silent
// background check right before the first message.
//
// One solve buys a pass cookie good for PASS_TTL_SECONDS, so `ensurePass`
// is a no-op for the rest of the conversation.

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// The script is shared by every widget on the page; resolve once and reuse.
let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const done = () => resolve(window.turnstile ?? null);
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const el = document.createElement("script");
    el.id = SCRIPT_ID;
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.onload = done;
    el.onerror = () => resolve(null);
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export type TurnstileGate = {
  /** Render target for the challenge — mount it near the composer. */
  containerRef: (el: HTMLDivElement | null) => void;
  /** True once the request may go out. Solves a challenge if needed. */
  ensurePass: () => Promise<boolean>;
  /** Forget the local pass after the server reported it expired. */
  invalidatePass: () => void;
};

export function useTurnstileGate(siteKey: string | null, enabled: boolean): TurnstileGate {
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Resolver of the solve currently in flight — Turnstile hands the token
  // back through a callback, not a promise.
  const pendingRef = useRef<((token: string | null) => void) | null>(null);
  // Local mirror of the httpOnly pass cookie's expiry, kept a little shorter
  // than the server's TTL so a request is never sent against a pass that
  // expires in flight.
  const passUntilRef = useRef(0);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerElRef.current = el;
  }, []);

  const invalidatePass = useCallback(() => {
    passUntilRef.current = 0;
  }, []);

  const solve = useCallback(async (): Promise<string | null> => {
    const api = await loadScript();
    const container = containerElRef.current;
    if (!api || !container || !siteKey) return null;

    const settle = (token: string | null) => {
      const resolve = pendingRef.current;
      pendingRef.current = null;
      resolve?.(token);
    };

    return new Promise<string | null>((resolve) => {
      pendingRef.current = resolve;
      try {
        if (widgetIdRef.current === null) {
          widgetIdRef.current = api.render(container, {
            sitekey: siteKey,
            execution: "execute",
            appearance: "interaction-only",
            callback: (token: string) => settle(token),
            "error-callback": () => settle(null),
            "timeout-callback": () => settle(null),
            "expired-callback": () => settle(null),
          });
        } else {
          // A token is single-use: reset before asking for the next one.
          api.reset(widgetIdRef.current);
        }
        api.execute(widgetIdRef.current);
      } catch {
        settle(null);
      }
    });
  }, [siteKey]);

  const ensurePass = useCallback(async (): Promise<boolean> => {
    if (!enabled || !siteKey) return true;
    if (Date.now() < passUntilRef.current) return true;
    const token = await solve();
    if (!token) return false;
    try {
      const res = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ttl?: number };
      const ttl = typeof data.ttl === "number" ? data.ttl : 0;
      // Expire the local pass a minute early — see passUntilRef.
      passUntilRef.current = Date.now() + Math.max(0, ttl - 60) * 1000;
      return true;
    } catch {
      return false;
    }
  }, [enabled, siteKey, solve]);

  return { containerRef, ensurePass, invalidatePass };
}
