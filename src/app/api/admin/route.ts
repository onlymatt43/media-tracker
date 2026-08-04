import { NextRequest, NextResponse } from 'next/server';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function getDb() {
  const { createClient } = await import('@libsql/client');
  return createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
}

// GET /api/admin?secret=...            → tableau de bord global (humains, par source/appareil/pays…)
// GET /api/admin?secret=...&uuid=...   → derniers événements d'un média
// &bots=1 pour inclure les bots (exclus par défaut)
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret');
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const includeBots = req.nextUrl.searchParams.get('bots') === '1';
  const notBot = includeBots ? '1=1' : "COALESCE(is_bot,0)=0";
  const uuid = req.nextUrl.searchParams.get('uuid');

  if (uuid) {
    const events = await db.execute({
      sql: `SELECT viewed_at, source, device, os, browser, country, city, referer, is_bot
            FROM tracking_events WHERE media_uuid = ? ORDER BY viewed_at DESC LIMIT 200`,
      args: [uuid],
    });
    const media = await db.execute({ sql: `SELECT * FROM media WHERE uuid = ?`, args: [uuid] });
    return NextResponse.json({ uuid, media: media.rows[0] || null, events: events.rows });
  }

  const topN = `SELECT %COL% AS k, COUNT(*) AS n FROM tracking_events
                WHERE ${notBot} AND %COL% IS NOT NULL AND %COL% != ''
                GROUP BY %COL% ORDER BY n DESC LIMIT 20`;

  const [totals, perMedia, bySource, byDevice, byCountry, byDay] = await Promise.all([
    db.execute(`SELECT COUNT(*) total, SUM(COALESCE(is_bot,0)) bots,
                       COUNT(DISTINCT media_uuid) medias, COUNT(DISTINCT ip) ips
                FROM tracking_events`),
    db.execute(`SELECT t.media_uuid, m.title, m.category,
                       COUNT(*) views, COUNT(DISTINCT t.ip) unique_ips, MAX(t.viewed_at) last
                FROM tracking_events t LEFT JOIN media m ON m.uuid = t.media_uuid
                WHERE ${notBot} GROUP BY t.media_uuid ORDER BY views DESC LIMIT 100`),
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
    medias: perMedia.rows,
  });
}
