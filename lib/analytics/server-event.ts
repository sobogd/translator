import { type HeaderReader, rawClientIp, rawClientUa, rawIngestHeaders, sendToIngest } from "./ingest";

// Events the client cannot fire truthfully — a sign-in only becomes real on
// the server, after Google's token exchange. Relayed through the same
// forward-to-iq-metrix path as app/api/e/route.ts, built from the raw signals
// on this request.
//
// Ported from iq-rest's conversion service (handleRegistration), minus the ad
// networks: here it only forwards the event and lets iq-metrix stitch the
// identity onto whatever visit produced it.

export interface ServerEvent {
  page: string;
  action: string;
  name: string;
}

/** Fire-and-forget: analytics must never fail an auth request. */
export function trackServerEvent(h: HeaderReader, email: string | null, event: ServerEvent): Promise<void> {
  return record(h, email, event).catch(() => {});
}

async function record(h: HeaderReader, email: string | null, event: ServerEvent): Promise<void> {
  await sendToIngest({
    site: "iq-translate",
    ip: rawClientIp(h),
    ua: rawClientUa(h),
    headers: rawIngestHeaders(h),
    email,
    events: [{ page: event.page, action: event.action, name: event.name, locale: null, at: new Date().toISOString() }],
  });
}
