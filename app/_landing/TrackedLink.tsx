"use client";

import Link from "next/link";
import { analytics } from "@/lib/analytics";

// Plain <a> that reports its click. Exists so server components (the footer)
// can carry tracked links without becoming client components themselves — the
// only thing that ships to the browser is this handler.
export function TrackedLink({
  href,
  track,
  className,
  children,
}: {
  href: string;
  /** Event name, locale-stable (route key / slug, never a translated label). */
  track: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        analytics.track("Click", track);
        // A footer link is a full document navigation: the 2s buffer would
        // never get to send it.
        analytics.flush();
      }}
    >
      {children}
    </a>
  );
}

/** Same idea for in-app navigation: keeps Next's client-side routing (so no
 *  flush — the document survives the click) and only adds the event. */
export function TrackedNavLink({
  href,
  track,
  className,
  children,
}: {
  href: string;
  track: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => analytics.track("Click", track)}>
      {children}
    </Link>
  );
}
