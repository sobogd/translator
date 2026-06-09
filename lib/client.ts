"use client";

// Client identity + fetch wrapper. Inside Telegram we send the signed initData
// (server verifies it); elsewhere we fall back to an anonymous device id stored
// in localStorage (data isolation per browser/device, no registration).

type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
};

function tg(): TgWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export function isTelegram(): boolean {
  return !!tg()?.initData;
}

function deviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}

function authHeaders(): Record<string, string> {
  const initData = tg()?.initData;
  if (initData) return { "X-Telegram-Init-Data": initData };
  return { "X-Device-Id": deviceId() };
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v);
  return fetch(input, { ...init, headers });
}

// Call once on app load: signal readiness + expand the Mini App viewport.
export function initTelegram() {
  const w = tg();
  if (!w) return;
  w.ready?.();
  w.expand?.();
}
