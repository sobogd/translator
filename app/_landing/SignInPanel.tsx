"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- full-page OAuth navigation to /api/auth/* start routes */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/client";
import { analytics } from "@/lib/analytics";
import { Loader2, X, AtSign } from "lucide-react";
import type { TaskbarTexts } from "./desktop/taskbar-texts";

// Sign-in panel shown in the header dropdown (and the Account menu while
// signed out). Rows are styled exactly like the other header context menus —
// no dividers. Choosing "Email" opens a dedicated blurred modal that explains
// what we need; Google / Apple are full-page navigations.
type Providers = { google: boolean; apple: boolean; email: boolean };

type AuthTexts = Pick<
  TaskbarTexts,
  | "signInEmail"
  | "signInGoogle"
  | "signInApple"
  | "emailTitle"
  | "emailHint"
  | "codeHint"
  | "emailPlaceholder"
  | "codePlaceholder"
  | "sendCode"
  | "verifyCode"
  | "errEmailInvalid"
  | "errCodeInvalid"
  | "errCodeExpired"
  | "errTooMany"
  | "errNotAllowed"
  | "errGeneric"
>;

const ROW =
  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium leading-normal transition-colors hover:bg-accent";
const ICON_BOX = "flex h-5 w-5 shrink-0 items-center justify-center rounded text-hint";

function EmailModal({ texts, onClose }: { texts: AuthTexts; onClose: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors: Record<string, string> = {
    INVALID_EMAIL: texts.errEmailInvalid,
    INVALID_CODE: texts.errCodeInvalid,
    CODE_EXPIRED: texts.errCodeExpired,
    TOO_MANY_REQUESTS: texts.errTooMany,
    TOO_MANY_ATTEMPTS: texts.errTooMany,
    NOT_ALLOWED: texts.errNotAllowed,
  };

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!e) {
      setError(texts.errEmailInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errors[data?.error as string] ?? texts.errGeneric);
        return;
      }
      setStep("code");
    } catch {
      setError(texts.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    const e = email.trim().toLowerCase();
    const c = code.trim();
    if (!e || !c) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, code: c }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errors[data?.error as string] ?? texts.errCodeInvalid);
        return;
      }
      analytics.track("Sign in", "Email");
      analytics.flush();
      window.location.reload();
    } catch {
      setError(texts.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-12 w-full rounded-lg bg-[var(--taskbar-bg)] px-3 text-base outline-none placeholder:text-hint";
  // Accent CTA — full width, h-10, compact text-sm label.
  const primaryClass =
    "flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-button px-4 text-sm font-semibold leading-normal text-button-text transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50";

  return createPortal(
    <div
      data-auth-modal=""
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-4 backdrop-blur-[8px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={texts.emailTitle}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[24rem] flex-col gap-4 rounded-2xl bg-[var(--window-bg)] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold leading-normal text-text">{texts.emailTitle}</h2>
            <p className="text-sm leading-relaxed text-hint">
              {step === "email" ? texts.emailHint : texts.codeHint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={texts.emailTitle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-hint transition hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        {step === "email" ? (
          <>
            <input
              type="email"
              name="auth-email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && sendCode()}
              placeholder={texts.emailPlaceholder}
              className={inputClass}
            />
            <button type="button" disabled={busy} onClick={sendCode} className={primaryClass}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {texts.sendCode}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && !busy && verifyCode()}
              placeholder={texts.codePlaceholder}
              className={`${inputClass} text-center tracking-[0.5em]`}
            />
            <button type="button" disabled={busy} onClick={verifyCode} className={primaryClass}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {texts.verifyCode}
            </button>
          </>
        )}
        {error && <p className="text-sm text-hint">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

export function SignInPanel({ texts }: { texts: AuthTexts }) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch("/api/auth/providers")
      .then((r) => r.json() as Promise<Providers>)
      .then((p) => alive && setProviders(p))
      .catch(() => alive && setProviders({ google: true, apple: false, email: false }));
    return () => {
      alive = false;
    };
  }, []);

  const goSocial = (provider: "Google" | "Apple") => {
    analytics.track("Click", `Sign in with ${provider}`);
    analytics.flush();
  };

  // While /api/auth/providers has not answered yet the menu must paint its
  // final shape on the very first frame — otherwise the Apple row "jumps" in
  // a moment later and the dropdown shifts under the cursor. So Apple defaults
  // to visible like Email does (?? true) and is only removed if the server
  // explicitly reports it is not configured.
  const hasEmail = providers?.email ?? true;
  const hasApple = providers?.apple ?? true;

  return (
    <div className="flex w-full flex-col gap-0.5 p-0">
      {hasEmail && (
        <button type="button" onClick={() => setEmailOpen(true)} className={ROW} title={texts.emailTitle}>
          <span className={ICON_BOX}>
            <AtSign size={15} />
          </span>
          {texts.signInEmail}
        </button>
      )}
      <a href="/api/auth/google/start" onClick={() => goSocial("Google")} className={ROW}>
        <span className={ICON_BOX}>
          <GoogleIcon />
        </span>
        {texts.signInGoogle}
      </a>
      {hasApple && (
        <a href="/api/auth/apple/start" onClick={() => goSocial("Apple")} className={ROW}>
          <span className={ICON_BOX}>
            <AppleIcon />
          </span>
          {texts.signInApple}
        </a>
      )}
      {emailOpen && <EmailModal texts={texts} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="fill-current">
      <path d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.47 7.84 1.31 10.41.87 1.26 1.9 2.67 3.25 2.62 1.31-.05 1.8-.84 3.38-.84 1.58 0 2.02.84 3.4.82 1.41-.03 2.3-1.28 3.16-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.15z" />
      <path d="M14.46 4.84c.72-.87 1.21-2.08 1.07-3.29-1.04.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.09 3.18 1.16.09 2.34-.59 3.05-1.45z" />
    </svg>
  );
}
