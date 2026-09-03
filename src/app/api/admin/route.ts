import { NextRequest, NextResponse } from 'next/server';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function getDb() {
  const { createClient } = await import('@libsql/client');
  return createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
}

// v2 analytics (PASSATION-wp-analytics-v2.md, block B3): plays/completion/watch-time
// computed from the same tracking_events as views/clicks — `event_type` tells them apart.
// `views` = view pixel (event_type='view', the default for older rows); `plays` =
// distinct sessions that started the video; completion = distinct sessions that
// crossed each quartile; watch-time = per-session average of the max position reached.
const MEDIA_STATS_CTE = `
  WITH media_stats AS (
    SELECT t.media_uuid,
      SUM(CASE WHEN t.event_type = 'view' THEN 1 ELSE 0 END) AS views,
      COUNT(DISTINCT CASE WHEN t.event_type = 'play' THEN t.session_id END) AS plays,
      COUNT(DISTINCT CASE WHEN t.event_type = 'q25' THEN t.session_id END) AS q25,
      COUNT(DISTINCT CASE WHEN t.event_type = 'q50' THEN t.session_id END) AS q50,
      COUNT(DISTINCT CASE WHEN t.event_type = 'q75' THEN t.session_id END) AS q75,
      COUNT(DISTINCT CASE WHEN t.event_type = 'q100' THEN t.session_id END) AS q100,
      COUNT(DISTINCT t.ip) AS unique_ips, MAX(t.viewed_at) AS last
    FROM tracking_events t WHERE %NOTBOT% GROUP BY t.media_uuid
  ),
  watch_time AS (
    SELECT media_uuid, AVG(max_pos) AS avg_watch_time FROM (
      SELECT media_uuid, session_id, MAX(position) AS max_pos
      FROM tracking_events WHERE session_id IS NOT NULL AND position IS NOT NULL
      GROUP BY media_uuid, session_id
    ) GROUP BY media_uuid
  )
`;

// Ratios are computed in JS (keeping division by zero as null is simpler here than in SQL).
function withEngagement(row: any) {
  const plays = Number(row.plays) || 0;
  const views = Number(row.views) || 0;
  const q = (n: any) => (plays > 0 ? Number(n) / plays : null);
  return {
    ...row,
    play_rate: views > 0 ? plays / views : null,
    completion_rate: { q25: q(row.q25), q50: q(row.q50), q75: q(row.q75), q100: q(row.q100) },
    watch_time_avg: row.avg_watch_time == null ? null : Number(row.avg_watch_time),
  };
}

// GET /api/admin             → global dashboard (humans, by source/device/country…)
// GET /api/admin?uuid=...    → latest events + engagement for one media item
// &bots=1 to include bots (excluded by default)
// Auth: `x-admin-secret` header only (query strings end up in logs and browser history).
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const includeBots = req.nextUrl.searchParams.get('bots') === '1';
  const notBot = includeBots ? '1=1' : "COALESCE(is_bot,0)=0";
  const uuid = req.nextUrl.searchParams.get('uuid');

  if (uuid) {
    const [events, media, statsRow] = await Promise.all([
      db.execute({
        sql: `SELECT viewed_at, source, device, os, browser, country, city, referer, is_bot,
                     event_type, position, duration, session_id
              FROM tracking_events WHERE media_uuid = ? ORDER BY viewed_at DESC LIMIT 200`,
        args: [uuid],
      }),
      db.execute({ sql: `SELECT * FROM media WHERE uuid = ?`, args: [uuid] }),
      db.execute({
        sql: `${MEDIA_STATS_CTE.replace('%NOTBOT%', `${notBot} AND t.media_uuid = ?`)}
              SELECT ms.*, w.avg_watch_time FROM media_stats ms
              LEFT JOIN watch_time w ON w.media_uuid = ms.media_uuid`,
        args: [uuid],
      }),
    ]);
    const engagement = statsRow.rows[0] ? withEngagement(statsRow.rows[0]) : withEngagement({ plays: 0, views: 0 });
    return NextResponse.json({ uuid, media: media.rows[0] || null, engagement, events: events.rows });
  }

  const topN = `SELECT %COL% AS k, COUNT(*) AS n FROM tracking_events
                WHERE ${notBot} AND %COL% IS NOT NULL AND %COL% != ''
                GROUP BY %COL% ORDER BY n DESC LIMIT 20`;

  const [totals, perMedia, bySource, byDevice, byCountry, byDay] = await Promise.all([
    db.execute(`SELECT COUNT(*) total, SUM(COALESCE(is_bot,0)) bots,
                       COUNT(DISTINCT media_uuid) medias, COUNT(DISTINCT ip) ips
                FROM tracking_events`),
    db.execute(`${MEDIA_STATS_CTE.replace('%NOTBOT%', notBot)}
                SELECT ms.*, m.title, m.category, w.avg_watch_time
                FROM media_stats ms
                LEFT JOIN media m ON m.uuid = ms.media_uuid
                LEFT JOIN watch_time w ON w.media_uuid = ms.media_uuid
                ORDER BY views DESC LIMIT 100`),
    db.execute(topN.replaceAll('%COL%', 'source')),
    db.execute(topN.replaceAll('%COL%', 'device')),
    db.execute(topN.replaceAll('%COL%', 'country')),
    db.execute(`SELECT substr(viewed_at,1,10) d, COUNT(*) n FROM tracking_events
                WHERE ${notBot} GROUP BY d ORDER BY d DESC LIMIT 30`),
  ]);

  return NextResponse.json({
    totaux: totals.rows[0] || {},
    par_source: bySource.rows,
    par_appareil: byDevice.rows,
    par_pays: byCountry.rows,
    par_jour: byDay.rows,
    medias: perMedia.rows.map(withEngagement),
  });
}
