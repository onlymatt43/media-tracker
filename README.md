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
| `POST /api/media` | registers/updates a media item (pipeline, auth `x-admin-secret`) |
| `GET /api/admin` | JSON dashboard (auth: `x-admin-secret` header only, never a query string): `totals`, `by_source`, `by_device`, `by_country`, `by_day`, `medias` with video engagement (play-rate, completion, watch-time); `?uuid=…` for one media item, `&bots=1` to include bots |
| `/dashboard.html` | visual dashboard (Chart.js) on top of `/api/admin` — the secret stays in the browser |
| `/om-track.js` | the video engagement beacon, a copy of `../wp-plugin/om-media/assets/om-track.js` (the editable source) — keep both identical |

Every logged event: device, OS, browser, bot/human, geo (Vercel headers), referer,
language, source/UTM, and for video: `event_type`, position, duration, session.

## Environment variables

| Variable | Description |
|---|---|
Local template: `.env.example` (kept out of git by `.gitignore`, like `.env`). Production values live
in the Vercel project settings.

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | Turso DB URL — missing: every database route fails naming it (`/m/<uuid>` answers 503) |
| `TURSO_AUTH_TOKEN` | yes | Turso auth token — same check as the URL (`src/lib/db.ts`) |
| `ADMIN_SECRET` | yes | secret for `/api/admin` and `POST /api/media` (= `TRACKER_ADMIN_SECRET` on the pipeline side); unset → both answer 401 |
| `BUNNY_STREAM_EMBED_HOST` | for Stream media | Bunny Stream embed host for `GET /api/media` — missing = explicit error, never a broken iframe |
| `SITE_BRAND_NAME` | no | display name for `<title>`, `og:site_name` and the root page; unset → the package name |
| `SITE_DESCRIPTION` | no | meta description shared with Open Graph and Twitter cards; unset → omitted |
| `SITE_LOCALE` | no | BCP-47 tag (language-region) for `<html lang>` and `og:locale`; unset → `en`, no `og:locale` |
| `SITE_URL` | no | canonical public origin (scheme + host), used as `metadataBase`; unset → Next's own host detection |
| `SITE_OG_IMAGE_URL` | no | absolute URL of the Open Graph / Twitter share image; unset → omitted |
| `SITE_FAVICON_BASE_URL` | no | base URL of the shared favicon set (`/favicon-32.png`, `/favicon.ico`… appended); unset → no icons |
| `SITE_OPERATOR_NAME` | no | legal name of the operator shown on `/privacy`; unset → omitted |
| `SITE_CONTACT_EMAIL` | no | contact address for access/correction/deletion requests on `/privacy`; unset → omitted |

## Data (Turso)

- `media` — `uuid` (PK) → url, type, title, category, owner, collaborators, Stream refs.
- `tracking_events` — one record per view/click/beacon; soft migrations (columns added
  on the fly, `event_type='view'` by default for historical rows).
