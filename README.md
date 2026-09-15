# media-tracker

Tracking and analytics for ONLYMATT / OM43 media, keyed by UUID. Next.js app (App Router) + Turso
(libSQL), deployed on Vercel. The base URL lives in `../pipeline/targets.json > tracker.base_url`
— never copied here.

> README rewritten on 2026-08-17: the previous one described the `tracker.command` flow (XMP sidecars),
> since moved to quarantine — registration has gone through the pipeline since then.

## How a media item gets here

The pipeline (`../pipeline/tracker.py`, called automatically after `deliver`) performs a
`POST /api/media` (auth `x-admin-secret`): `uuid → url` + context (type, title, category,
credits, Stream refs). `python3 ../pipeline/tracker.py backfill` catches up media already delivered.

## Endpoints

| Endpoint | Role |
|---|---|
| `GET /m/<uuid>[?s=source]` | tracked link: logs the rich view, then redirects (302) to the media URL; 404 only for an unknown uuid, 503 when the database cannot be read |
| `GET /api/track/<uuid>` | invisible pixel (1x1 GIF) for passive views on an HTML page |
| `POST /api/event/<uuid>` | video engagement beacon (play/pause/ended, completion milestones `q<N>`) — sent by `/om-track.js`, loaded by the WP plugin, which passes the milestones in `OM_TRACK_CFG.quartiles` (plugin option `om_track_quartiles`) |
| `GET /api/media/<uuid>` | PUBLIC read: what is needed to build the embed (Stream iframe / file) + pixel + link |
| `POST /api/media` | registers/updates a media item (pipeline, auth `x-admin-secret` header only — the dashboard session is not accepted) |
| `GET /api/admin` | JSON dashboard (auth: `x-admin-secret` header or the admin session cookie, never a query string): `totals`, `by_source`, `by_device`, `by_country`, `by_day`, `medias` with video engagement (play-rate, completion, watch-time); `?uuid=…` for one media item, `&bots=1` to include bots |
| `/dashboard.html` | visual dashboard (Chart.js) on top of `/api/admin`; without an admin session the visitor is sent to `/sign-in` (`src/proxy.ts`) |
| `/sign-in` | dashboard sign-in: `ADMIN_SECRET` typed once, traded for the session cookie (form → `POST /api/admin/sign-in`) |
| `POST /api/admin/sign-out` | expires the session cookie, back to `/sign-in` |
| `POST /api/admin/portal-pass` | entry from the owner's portal: form field `pass`, see below |
| `/om-track.js` | the video engagement beacon, a copy of `../wp-plugin/om-media/assets/om-track.js` (the editable source) — keep both identical |

Every logged event: device, OS, browser, bot/human, geo (Vercel headers), referer,
language, source/UTM, and for video: `event_type`, position, duration, session.

## Admin authentication

Two ways in, checked in `src/lib/admin-auth.ts`:

- **`x-admin-secret` header** = `ADMIN_SECRET` — machine to machine (the pipeline, `TRACKER_ADMIN_SECRET`
  on its side). Compared in constant time (both sides hashed, `timingSafeEqual`). Checked first and on its
  own: the pipeline does not depend on any session variable.
- **Admin session cookie** `tracker_admin_session` — the dashboard in a browser. Signed (HMAC-SHA256)
  with a key derived from `TRACKER_SESSION_SECRET`, never from `ADMIN_SECRET`; expires after
  `TRACKER_SESSION_TTL_SECONDS`; httpOnly, SameSite=Lax, Secure in production, host-only. Stateless:
  signing out clears the cookie but a copied token stays valid until it expires — rotating
  `TRACKER_SESSION_SECRET` signs everyone out. Accepted by `GET /api/admin` and the dashboard gate only.

The session is opened by either:

- **the sign-in** (`/sign-in`) — the fallback, always available;
- **a portal pass** from the owner's portal (admin.onlymatt.ca): the portal posts a form with field `pass`
  to `/api/admin/portal-pass`. Format `v1.<base64url payload>.<base64url Ed25519 signature of "v1.<payload>">`,
  payload `{aud, iat, exp, jti, to?}` (ms since epoch), same verifier as release-onlymatt
  (`src/lib/portal-pass.ts`). Refused: bad signature, `aud` ≠ `PORTAL_PASS_AUDIENCE`, expired, or a lifetime
  longer than `PORTAL_PASS_MAX_TTL_SECONDS`. `to` is honoured only as a local path (default
  `/dashboard.html`). Valid → session cookie + a small page that moves on to `to`; invalid → 401 page linking
  to `/sign-in`; configuration error → 500 page, logged with the variable name. Not single-use (no store):
  a pass lives seconds and travels only in a POST body.

The dashboard no longer keeps anything secret in the browser: it erases the `om_secret` (and `om_base`)
localStorage keys of earlier versions on load.

## Environment variables

Local template: `.env.example` (kept out of git by `.gitignore`, like `.env`). Production values live
in the Vercel project settings.

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | Turso DB URL — missing: every database route fails naming it (`/m/<uuid>` answers 503) |
| `TURSO_AUTH_TOKEN` | yes | Turso auth token — same check as the URL (`src/lib/db.ts`) |
| `ADMIN_SECRET` | yes | secret for the `x-admin-secret` header of `/api/admin` and `POST /api/media` (= `TRACKER_ADMIN_SECRET` on the pipeline side) and for `/sign-in`; unset → the header is refused with 401 and sign-in answers 500, both logged naming it |
| `TRACKER_SESSION_SECRET` | for the dashboard | key signing the admin session cookie, separate from `ADMIN_SECRET`: at least 32 random bytes, hex or base64 encoded (`openssl rand -base64 48`). Missing/weak → sign-in, portal pass and any request carrying a session cookie answer 500, logged naming it (the header path is unaffected). Changing it signs every session out |
| `TRACKER_SESSION_TTL_SECONDS` | for the dashboard | lifetime of an admin session, in seconds (positive integer) |
| `PORTAL_PASS_PUBLIC_KEY` | for the portal pass | the portal's Ed25519 public key, base64 SPKI DER (shown on the portal's `/pass-key` page); verifies passes, cannot make one. Missing/invalid → `/api/admin/portal-pass` answers 500, logged naming it |
| `PORTAL_PASS_AUDIENCE` | for the portal pass | this app's name in the pass (`aud`); must equal the `pass.audience` of this system in the portal's `config/systems.json` |
| `PORTAL_PASS_MAX_TTL_SECONDS` | for the portal pass | longest pass lifetime accepted, in seconds (positive integer); a pass claiming more is refused even with a valid signature |
| `BUNNY_STREAM_EMBED_HOST` | for Stream media | Bunny Stream embed host for `GET /api/media` — missing = explicit error, never a broken iframe |
| `SITE_BRAND_NAME` | no | display name for `<title>`, `og:site_name` and the root page; unset → the package name |
| `SITE_DESCRIPTION` | no | meta description shared with Open Graph and Twitter cards; unset → omitted |
| `SITE_LOCALE` | no | BCP-47 tag (language-region) for `<html lang>` and `og:locale`; unset → `en`, no `og:locale` |
| `SITE_URL` | no | canonical public origin (scheme + host), used as `metadataBase`; unset → Next's own host detection |
| `SITE_OG_IMAGE_URL` | no | absolute URL of the Open Graph / Twitter share image; unset → omitted |
| `SITE_FAVICON_BASE_URL` | no | base URL of the shared favicon set (`/favicon-32.png`, `/favicon.ico`… appended); unset → no icons |
| `SITE_OPERATOR_NAME` | no | legal name of the operator shown on `/privacy`; unset → omitted |
| `SITE_CONTACT_EMAIL` | no | contact address for access/correction/deletion requests on `/privacy`; unset → omitted |

## Checks

```sh
npm ci
npm run lint
npm test        # tsx --test tests/*.test.ts (session, portal pass, admin API auth on a throwaway local libSQL file)
npm run build
```

## Data (Turso)

- `media` — `uuid` (PK) → url, type, title, category, owner, collaborators, Stream refs.
- `tracking_events` — one record per view/click/beacon; soft migrations (columns added
  on the fly, `event_type='view'` by default for historical rows).
