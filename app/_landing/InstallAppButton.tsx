"use client";

import { useEffect, useState } from "react";

// Chrome/Edge/Android fire `beforeinstallprompt` when the page qualifies as
// installable; the event must be captured (and its default prevented) so it
// can be replayed later from our own "Mobile app" button instead of the
// browser's own mini-infobar. No such event exists on iOS Safari or desktop
// Safari/Firefox, so the button only renders once the event has actually
// fired — there is no custom install flow to fall back to on those browsers.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return { canInstall: !!deferred, promptInstall };
}

export function InstallAppButton({
  label,
  className,
  onClick,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        promptInstall();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
