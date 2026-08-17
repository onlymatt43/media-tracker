# media-tracker

Tracking et analytics des médias ONLYMATT / OM43, par UUID. App Next.js (App Router) + Turso
(libSQL), déployée sur Vercel. L'URL de base vit dans `../pipeline/targets.json > tracker.base_url`
— jamais recopiée ici.

> README réécrit le 2026-08-17 : l'ancien décrivait le flux `tracker.command` (sidecars XMP),
> retiré en quarantaine — l'enregistrement passe par le pipeline depuis.

## Comment un média entre ici

Le pipeline (`../pipeline/tracker.py`, appelé automatiquement après `deliver`) fait un
`POST /api/media` (auth `x-admin-secret`) : `uuid → url` + contexte (type, titre, catégorie,
crédits, refs Stream). `python3 ../pipeline/tracker.py backfill` rattrape les médias déjà livrés.

## Endpoints

| Endpoint | Rôle |
|---|---|
| `GET /m/<uuid>[?s=source]` | lien tracké : logue la vue riche puis redirige (302) vers l'URL du média |
| `GET /api/track/<uuid>` | pixel invisible (GIF 1x1) pour les vues passives sur une page HTML |
| `POST /api/event/<uuid>` | beacon d'engagement vidéo (play/pause/ended, quartiles 25-100 %) — envoyé par `om-track.js` du plugin WP |
| `GET /api/media/<uuid>` | lecture PUBLIQUE : de quoi construire l'embed (iframe Stream / fichier) + pixel + lien |
| `POST /api/media` | enregistre/met à jour un média (pipeline, auth `x-admin-secret`) |
| `GET /api/admin` | tableau de bord JSON (auth `x-admin-secret`) : totaux, par source/appareil/pays/jour, engagement vidéo (play-rate, complétion, watch-time) ; `?uuid=…` pour un média, `&bots=1` pour inclure les bots |
| `/dashboard.html` | tableau de bord visuel (Chart.js) au-dessus de `/api/admin` — le secret reste dans le navigateur |

Chaque événement logué : appareil, OS, navigateur, bot/humain, géo (headers Vercel), referer,
langue, source/UTM, et pour la vidéo : `event_type`, position, durée, session.

## Variables d'environnement

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | URL de la DB Turso |
| `TURSO_AUTH_TOKEN` | token d'auth Turso |
| `ADMIN_SECRET` | secret pour `/api/admin` et `POST /api/media` (= `TRACKER_ADMIN_SECRET` côté pipeline) |
| `BUNNY_STREAM_EMBED_HOST` | host d'embed Bunny Stream pour `GET /api/media` — absent = erreur explicite, jamais d'iframe cassé |

## Données (Turso)

- `media` — `uuid` (PK) → url, type, titre, catégorie, owner, collaborators, refs Stream.
- `tracking_events` — un enregistrement par vue/clic/beacon ; migrations douces (colonnes ajoutées
  au vol, `event_type='view'` par défaut pour l'historique).
