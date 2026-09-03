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
| `GET /m/<uuid>[?s=source]` | tracked link: logs the rich view, then redirects (302) to the media URL |
| `GET /api/track/<uuid>` | invisible pixel (1x1 GIF) for passive views on an HTML page |
| `POST /api/event/<uuid>` | video engagement beacon (play/pause/ended, 25-100 % quartiles) — sent by `om-track.js` from the WP plugin |
| `GET /api/media/<uuid>` | PUBLIC read: what is needed to build the embed (Stream iframe / file) + pixel + link |
| `POST /api/media` | registers/updates a media item (pipeline, auth `x-admin-secret`) |
| `GET /api/admin` | JSON dashboard (auth `x-admin-secret`): totals, by source/device/country/day, video engagement (play-rate, completion, watch-time); `?uuid=…` for one media item, `&bots=1` to include bots |
| `/dashboard.html` | visual dashboard (Chart.js) on top of `/api/admin` — the secret stays in the browser |

Every logged event: device, OS, browser, bot/human, geo (Vercel headers), referer,
language, source/UTM, and for video: `event_type`, position, duration, session.

## Environment variables

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Turso DB URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `ADMIN_SECRET` | secret for `/api/admin` and `POST /api/media` (= `TRACKER_ADMIN_SECRET` on the pipeline side) |
| `BUNNY_STREAM_EMBED_HOST` | Bunny Stream embed host for `GET /api/media` — missing = explicit error, never a broken iframe |

## Data (Turso)

- `media` — `uuid` (PK) → url, type, title, category, owner, collaborators, Stream refs.
- `tracking_events` — one record per view/click/beacon; soft migrations (columns added
  on the fly, `event_type='view'` by default for historical rows).
