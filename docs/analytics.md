# Analytics (cookieless)

Port of iq-rest's `analytics-v2` pipeline, minus the ad-network half. Nothing is
stored on the visitor's device, so the site needs no cookie banner — that claim
is made in the privacy policy (`app/_landing/legal-content.ts`, sections 2, 5, 6
and 10), so any change here has to be reflected there.

## How a visit is identified

`sha256(dailySalt | ip-prefix | user-agent | accept-language + geo)`.

- The raw IP and raw user agent never leave the request's stack frame. The IP is
  coarsened first (IPv4 /24, IPv6 /64) so a mobile address rotating mid-visit
  does not split one visitor into three.
- The salt is a single row (`analytics_salt`), replaced once a day at 04:00
  Europe/Madrid and the old value destroyed — which is what makes yesterday's
  visits unlinkable. Rotation is lazy (first request after the boundary pays one
  upsert); there is no scheduler in this app.
- A visit ends after 30 idle minutes.
- The ingest response returns an HMAC visit token that the client echoes on the
  next batch. It lives in a module variable of the live page only — never a
  cookie, never storage — and exists because the hash flaps on mobile networks.
- Signing in promotes the anonymous visit in place, so the pageviews that led to
  the sign-in stay on the row. `sessions_new.email` is the identity (this app
  has no `User` table).

## Pieces

| Path | What it is |
| --- | --- |
| `lib/analytics.ts` | Client transport: batching, retries, `sendBeacon` on unload |
| `lib/analytics/*` | Server core: salt, hash, visit token, visit resolution, identity |
| `app/api/e/route.ts` | The one ingest endpoint (`POST /api/e`, `text/plain`) |
| `app/_landing/PageTracker.tsx` | Pageview + scroll-between-sections, mounted by `SessionProvider` |
| `app/api/admin/sessions*` | Admin read/delete endpoints, gated by `ANALYTICS_ADMIN_EMAILS` |
| `app/_landing/AdminTraffic.tsx` | The two admin modals, lazy-loaded from the account modal |

The endpoint is `/api/e` and not `/track` on purpose: the readable name is on
every ad-blocker filter list, and a blocked first batch loses the whole visit.
The body is `text/plain` so the POST stays CORS-simple and `sendBeacon` can
carry it while the page is being torn down.

## Event shape

`page` / `action` / `name` — short English labels, free-form, validated against
a tight character set server-side. **Names must not vary by language**, or one
funnel becomes thirty: locale-stable route keys and language codes, never a
translated label. The rendered locale and the open topic ride along per event
(`locale`, `topicId`).

Pages: `Home`, `Pair`, `Pricing`, `Legal`, `Auth` (server-side only).

## Sections

The scroll tracker names each scroll after the section the page settled on. A
section is any element with `data-section` — set it through `<Band section="…">`
(`app/_landing/shell.tsx`) and give the token a label in `lib/track-sections.ts`,
otherwise the timeline reads like a database dump.

## Geo

From nginx, not from the app: prod runs `ngx_http_geoip2` against
`/usr/share/GeoIP/GeoLite2-City.mmdb` and proxies the result in as
`cf-ipcountry` / `cf-region` / `cf-ipcity` (Cloudflare's header names, kept so
the code stays identical to iq-rest's). See `nginx/translator.conf`. Locally
there is no nginx, so geo is absent and `country` stays `XX`.

## Env

| Variable | Effect |
| --- | --- |
| `ANALYTICS_TOKEN_SECRET` | HMAC key for the visit token. Empty = tokens off, pipeline falls back to the hash |
| `ANALYTICS_ADMIN_EMAILS` | Who may open the traffic screens (default `support@iq-rest.com`) |
| `ANALYTICS_EXCLUDE_EMAILS` | Accounts whose traffic is never recorded (default `support@iq-rest.com`) |
| `NEXT_PUBLIC_ANALYTICS_DEV` | `1` makes the client send from `next dev` instead of logging to the console |

## Retention

12 months. The delete rides on the daily salt rotation (`lib/analytics/salt.ts`),
since that is the one thing that already happens once a day.
