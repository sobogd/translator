"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Loader2, Mic, Type } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { PRIMARY_FILL } from "./shell";
import { useSession } from "./session";
import { analytics } from "@/lib/analytics";
import type { TranslatorTexts } from "./types";

const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Live remaining-quota chips (header): one chip for voice minutes and one
// for characters. Content-block background, no border, same height (h-7) as
// the mermaid header's "Open editor" button. The anonymous fingerprint pool
// or the signed-in account balance.
export function QuotaBadge({
  locale,
  accountTexts,
  compact = false,
}: {
  locale: string;
  accountTexts: TranslatorTexts["account"];
  /** Kept for compatibility — the chips are always compact (h-7). */
  compact?: boolean;
}) {
  // Fetched + polled once per page by SessionProvider (app/_landing/session.tsx).
  const { quota } = useSession();
  if (!quota) return null;
  const nf = new Intl.NumberFormat(locale);
  const chip =
    "inline-flex h-7 items-center gap-1 rounded bg-[var(--window-bg)] px-2 text-xs font-medium leading-none text-hint";
  return (
    <>
      <span className={chip} title={`${accountTexts.minutesLeft}: ${fmtSeconds(quota.seconds)}`}>
        <Mic className="h-3.5 w-3.5" aria-hidden="true" />
        {fmtSeconds(quota.seconds)}
      </span>
      <span className={chip} title={`${accountTexts.charsLeft}: ${nf.format(quota.chars)}`}>
        <Type className="h-3.5 w-3.5" aria-hidden="true" />
        {nf.format(quota.chars)}
      </span>
    </>
  );
}

// The one combined auth button: "Sign up / Sign in" for visitors, "Account"
// (opening the settings modal) once signed in.
export function AuthButton({
  locale,
  texts,
  accountTexts,
  pricingHref,
  fullWidth = false,
}: {
  locale: string;
  texts: TranslatorTexts["header"];
  accountTexts: TranslatorTexts["account"];
  pricingHref: string;
  fullWidth?: boolean;
}) {
  // Session state (signed-in flag + the polled quota) is shared with the
  // header badge — the modal only asks for a refresh when it opens.
  const { signedIn, quota, refreshQuota } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  function openModal() {
    analytics.track("Click", "Account modal");
    setModalOpen(true);
    refreshQuota();
  }

  async function openPortal() {
    analytics.track("Click", "Manage subscription");
    setPortalBusy(true);
    try {
      const res = await apiFetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        // Leaving for Stripe — the buffer would not survive the navigation.
        analytics.flush();
        window.location.href = data.url;
      }
    } finally {
      setPortalBusy(false);
    }
  }

  async function logout() {
    analytics.track("Click", "Log out");
    analytics.flush();
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
        <a
          href="/api/auth/google/start"
          onClick={() => {
            analytics.track("Click", "Sign in with Google");
            // Full navigation to Google — flush or the click is lost.
            analytics.flush();
          }}
          className={btnClass}
        >
          {texts.signIn}
        </a>
      )}

      {modalOpen && (
        <Modal
          title={accountTexts.title}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              {isPaid ? (
                <button
                  onClick={openPortal}
                  disabled={portalBusy}
                  className={`inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
                >
                  {portalBusy ? <Loader2 size={16} className="animate-spin" /> : accountTexts.manageSubscription}
                </button>
              ) : (
                <a
                  href={pricingHref}
                  onClick={() => {
                    analytics.track("Click", "Upgrade");
                    analytics.flush();
                  }}
                  className={`inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${PRIMARY_FILL}`}
                >
                  {accountTexts.upgrade}
                </a>
              )}
              <button
                onClick={logout}
                className="inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-border px-4 text-sm font-semibold transition-all hover:bg-bg active:scale-[0.99]"
              >
                {texts.logOut}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4 px-5 py-4">
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
          </div>
        </Modal>
      )}
    </>
  );
}
