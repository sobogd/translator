// Shared types + formatting for the admin Traffic screens.
//
// A row is one VISIT: it starts anonymous (day-scoped device hash) and is
// promoted in place to the signed-in identity the moment the session cookie
// resolves. Visits of the same person on other days are separate rows linked by
// email — anonymous rows across salt-days stay unlinkable by construction.
//
// Ported from iq-rest (apps/dashboard-web/src/dashboard/_pages/traffic-shared.ts).

export interface TrafficTopic {
  id: string;
  title: string | null;
}

export interface TrafficSession {
  id: string;
  firstAt: string;
  lastAt: string;
  device: string | null;
  os: string | null;
  country: string;
  region: string;
  city: string;
  lang: string | null;
  theme: string | null;
  from: string | null;
  ref: string | null;
  eventCount: number;
  pageCount: number;
  firstPage: string | null;
  hasTranslate: boolean;
  hasRegister: boolean;
  locales: string[];
  /** Anonymous rows folded into this one after a mid-visit sign-in. */
  mergeCount: number;
  email: string | null;
  /** All-time visits of this account, this one included (1 when signed out). */
  userVisits: number;
  topics: TrafficTopic[];
}

export interface TrafficSessionList {
  sessions: TrafficSession[];
  /** The endpoint has no pagination — it cuts the window at `limit` rows and
   *  flags it, so the UI can say "this is not everything". */
  truncated: boolean;
  limit: number;
}

export interface TrafficEvent {
  id: string;
  page: string;
  action: string;
  name: string;
  topicId: string | null;
  topicTitle: string | null;
  /** Locale the page was rendered in, per event — a visit can cross locales. */
  locale: string | null;
  at: string;
}

export interface TrafficOtherVisit {
  id: string;
  firstAt: string;
  country: string;
  city: string;
  device: string | null;
}

export interface TrafficSessionDetail {
  session: TrafficSession & { hash: string };
  events: TrafficEvent[];
  otherVisits: TrafficOtherVisit[];
}

/** "1m 20s" / "45s" / "1h 3m" — visit length from first to last event. */
export function duration(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Compact device label: "ios mobile" → "📱 iOS". */
export function deviceShort(device: string | null, os: string | null): string {
  const emoji = device === "mobile" ? "📱" : device === "tablet" ? "📋" : "🖥";
  const label = os === "macos" ? "macOS" : os === "ios" ? "iOS" : os || device || "—";
  return `${emoji} ${label}`;
}

/** Where the visit came from, as one short chip label. */
// Same host list as lib/analytics.ts, duplicated on purpose: that module is
// client-only and importing it here would pull the whole tracker into the
// admin bundle. Keep the two in sync when an assistant is added.
const AI_REFERRER_HOSTS =
  /(?:^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|anthropic\.com|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com|poe\.com)$/i;

export type RefChannel = "ai" | "search" | "campaign" | "direct";

/** Acquisition channel of a visit. "ai" is the one worth watching: assistants
 *  cite pages without sending a click, so any referred traffic at all from
 *  them means the citation is landing. */
export function refChannel(s: Pick<TrafficSession, "from" | "ref">): RefChannel {
  if (s.ref && AI_REFERRER_HOSTS.test(s.ref)) return "ai";
  if (s.from) return "campaign";
  if (s.ref) return "search";
  return "direct";
}

export function sourceLabel(s: Pick<TrafficSession, "from" | "ref">): string | null {
  // An AI referrer outranks a campaign tag: the tag says how the link was
  // built, the referrer says where the visitor actually came from.
  if (s.ref && AI_REFERRER_HOSTS.test(s.ref)) return `AI · ${s.ref.replace(/^www\./, "")}`;
  if (s.from) return s.from;
  if (s.ref) return s.ref.replace(/^www\./, "");
  return null;
}

export const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local "3 Sep 12:13:14", with the year whenever it is not the current one — a
 *  30-day window can straddle New Year, and "31 Dec" next to "1 Jan" is
 *  otherwise unreadable. */
export function hmsDate(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "12:13:14" — events are listed within one visit, so the date is redundant. */
export function hms(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** ISO-3166 alpha-2 → flag emoji. The code must be normalised first: a
 *  lowercase "es" would offset into a random codepoint pair instead of falling
 *  back to the globe. */
export function countryToFlag(code: string): string {
  const cc = (code ?? "").trim().toUpperCase();
  if (cc === "XX" || !/^[A-Z]{2}$/.test(cc)) return "🌐";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + cc.charCodeAt(0) - a, A + cc.charCodeAt(1) - a);
}
