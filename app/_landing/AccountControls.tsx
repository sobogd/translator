"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mic, Type, X } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { PRIMARY_FILL } from "./shell";
import type { TranslatorTexts } from "./types";

import type { Quota } from "@/lib/quota-server";

const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Fired by the translator widget right after a successful translate /
// transcribe so the badge refreshes immediately instead of waiting out the
// 10s poll.
export const QUOTA_EVENT = "iqt:quota";

// Starts from the SSR-computed value (no extra request on page load), then
// refreshes every 10s and instantly on QUOTA_EVENT. Only fetches upfront
// when SSR had nothing (first-ever anonymous visit — no fp cookie yet).
function useQuota(initial: Quota | null = null) {
  const [quota, setQuota] = useState<Quota | null>(initial);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await apiFetch("/api/quota");
        if (alive && res.ok) setQuota(await res.json());
      } catch {
        /* keep the last known value */
      }
    };
    if (!initial) refresh();
    const timer = setInterval(refresh, 10_000);
    window.addEventListener(QUOTA_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(QUOTA_EVENT, refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return quota;
}

// Live remaining-quota badge: voice seconds (m:ss) + characters — the
// anonymous fingerprint pool or the signed-in account balance.
export function QuotaBadge({
  locale,
  accountTexts,
  compact = false,
  initialQuota = null,
}: {
  locale: string;
  accountTexts: TranslatorTexts["account"];
  /** Tighter paddings/gaps so the badge fits a narrow mobile header row. */
  compact?: boolean;
  /** SSR-computed starting value (lib/quota-server.ts) — no load-time fetch. */
  initialQuota?: Quota | null;
}) {
  const quota = useQuota(initialQuota);
  if (!quota) return null;
  const nf = new Intl.NumberFormat(locale);
  return (
    <span
      className={`flex h-9 items-center rounded-lg bg-card font-medium text-hint ${
        compact ? "gap-2 px-2.5 text-[11px]" : "shrink-0 gap-2.5 px-3 text-xs"
      }`}
      title={`${accountTexts.minutesLeft}: ${fmtSeconds(quota.seconds)} · ${accountTexts.charsLeft}: ${nf.format(quota.chars)}`}
    >
      <span className="flex items-center gap-1">
        <Mic className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-label={accountTexts.minutesLeft} />
        {fmtSeconds(quota.seconds)}
      </span>
      <span className="flex items-center gap-1">
        <Type className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-label={accountTexts.charsLeft} />
        {nf.format(quota.chars)}
      </span>
    </span>
  );
}

// The one combined auth button: "Sign up / Sign in" for visitors, "Account"
// (opening the settings modal) once signed in.
export function AuthButton({
  signedIn,
  locale,
  texts,
  accountTexts,
  pricingHref,
  fullWidth = false,
}: {
  signedIn: boolean;
  locale: string;
  texts: TranslatorTexts["header"];
  accountTexts: TranslatorTexts["account"];
  pricingHref: string;
  fullWidth?: boolean;
}) {
  // The modal fetches fresh numbers when it opens — no polling of its own.
  const [quota, setQuota] = useState<Quota | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  async function openModal() {
    setModalOpen(true);
    try {
      const res = await apiFetch("/api/quota");
      if (res.ok) setQuota(await res.json());
    } catch {
      /* rows show placeholders */
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const nf = new Intl.NumberFormat(locale);
  const isPaid = quota?.kind === "account" && quota.plan !== "FREE";
  const btnClass = `h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL} ${fullWidth ? "flex w-full" : "inline-flex"}`;

  return (
    <>
      {signedIn ? (
        <button onClick={openModal} className={btnClass}>
          {texts.account}
        </button>
      ) : (
        <a href="/api/auth/google/start" className={btnClass}>
          {texts.signIn}
        </a>
      )}

      {modalOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border p-5 shadow-xl sm:rounded-2xl"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{accountTexts.title}</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 transition active:scale-90"
                style={{ color: "var(--hint)" }}
              >
                <X size={18} />
              </button>
            </div>
            {quota?.email && <p className="break-all text-sm text-hint">{quota.email}</p>}
            <div className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-hint">{accountTexts.planLabel}</span>
                <span className="font-semibold">
                  {isPaid ? (quota?.planName ?? quota?.plan) : accountTexts.freePlan}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-hint">{accountTexts.minutesLeft}</span>
                <span className="font-semibold">{quota ? fmtSeconds(quota.seconds) : "…"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-hint">{accountTexts.charsLeft}</span>
                <span className="font-semibold">{quota ? nf.format(quota.chars) : "…"}</span>
              </div>
            </div>
            {isPaid ? (
              <button
                onClick={openPortal}
                disabled={portalBusy}
                className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
              >
                {portalBusy ? <Loader2 size={16} className="animate-spin" /> : accountTexts.manageSubscription}
              </button>
            ) : (
              <a
                href={pricingHref}
                className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
              >
                {accountTexts.upgrade}
              </a>
            )}
            <button
              onClick={logout}
              className="text-sm font-semibold text-hint transition-opacity hover:opacity-70"
            >
              {texts.logOut}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
