# media-tracker

Système de traçage et analytics pour les médias ONLYMATT / OM43.

Chaque fichier media reçoit un UUID unique + une URL de tracking injectée dans les métadonnées XMP via le script `tracker.command`. Quand quelqu'un consulte l'image/vidéo, le endpoint `/api/track/{UUID}` log l'événement (IP, user-agent, pays, date).

## Usage

### 1. Injecter les métadonnées (tracker.command)

Copie `tracker.command` dans le dossier contenant tes médias, puis lance-le. Chaque fichier reçoit un sidecar XMP avec :
- UUID unique
- URL de tracking : `https://media-tracker-nu-ten.vercel.app/api/track/{UUID}`
- Artist, Copyright, réseaux sociaux, contact

### 2. Consulter les analytics

```
GET https://media-tracker-nu-ten.vercel.app/api/admin
Header: x-admin-secret: {ADMIN_SECRET}
```

Réponse :
```json
{
  "total_events": 42,
  "media": [
    {
      "media_uuid": "abc-123",
      "view_count": 15,
      "first_view": "2026-07-24 10:00:00",
      "last_view": "2026-07-24 23:59:59",
      "unique_ips": 8
    }
  ]
}
```

Pour les détails d'un UUID spécifique :
```
GET /api/admin?uuid={UUID}
Header: x-admin-secret: {ADMIN_SECRET}
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | URL de la DB Turso (`media-tracker-onlymatt43`) |
| `TURSO_AUTH_TOKEN` | Token d'auth Turso |
| `ADMIN_SECRET` | Secret pour accéder aux analytics (`/api/admin`) |

## Stack

- Next.js 16 (App Router)
- Turso (libSQL)
- Déployé sur Vercel
