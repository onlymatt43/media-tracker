// Capture d'événement riche, partagée par le pixel (/api/track) et le lien tracké (/m).
// Enregistre tout ce qui est possible au moment du clic : appareil, OS, navigateur,
// géo, source/UTM, referer, langue, bot/humain.

export function parseUA(ua: string) {
  const u = (ua || '').toLowerCase();
  const is_bot = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegrambot|discordbot|bingpreview|curl|wget|python-requests|headless/.test(u);
  const os =
    /iphone|ipad|ipod/.test(u) ? 'iOS' :
    /android/.test(u) ? 'Android' :
    /windows/.test(u) ? 'Windows' :
    /mac os|macintosh/.test(u) ? 'macOS' :
    /linux/.test(u) ? 'Linux' : '';
  const device =
    /ipad|tablet/.test(u) ? 'tablet' :
    /mobile|iphone|android|ipod/.test(u) ? 'mobile' : 'desktop';
  const browser =
    /edg\//.test(u) ? 'Edge' :
    /opr\/|opera/.test(u) ? 'Opera' :
    /chrome|crios/.test(u) ? 'Chrome' :
    /firefox|fxios/.test(u) ? 'Firefox' :
    /safari/.test(u) ? 'Safari' : '';
  return { is_bot, os, device, browser };
}

export async function ensureEventsTable(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_uuid TEXT NOT NULL,
      ip TEXT, user_agent TEXT,
      device TEXT, os TEXT, browser TEXT, is_bot INTEGER DEFAULT 0,
      country TEXT, region TEXT, city TEXT,
      referer TEXT, lang TEXT, source TEXT,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // migration douce : ajoute les colonnes manquantes sur une table déjà existante
  for (const col of ['device TEXT', 'os TEXT', 'browser TEXT', 'is_bot INTEGER DEFAULT 0',
                     'region TEXT', 'lang TEXT', 'source TEXT']) {
    try { await db.execute(`ALTER TABLE tracking_events ADD COLUMN ${col}`); } catch { /* existe déjà */ }
  }
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_te_uuid ON tracking_events(media_uuid)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_te_at ON tracking_events(viewed_at)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_te_source ON tracking_events(source)`);
}

export async function ensureMediaTable(db: any) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS media (
      uuid TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      type TEXT, title TEXT, category TEXT,
      owner TEXT, collaborators TEXT,
      stream_lib TEXT, stream_guid TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // migration douce des colonnes d'embed
  for (const col of ['stream_lib TEXT', 'stream_guid TEXT']) {
    try { await db.execute(`ALTER TABLE media ADD COLUMN ${col}`); } catch { /* existe déjà */ }
  }
}

export async function logEvent(db: any, req: Request, uuid: string, url?: URL) {
  const h = (k: string) => req.headers.get(k) || '';
  const ua = h('user-agent');
  const { is_bot, os, device, browser } = parseUA(ua);
  const ip = (h('x-forwarded-for').split(',')[0] || '').trim() || h('x-real-ip') || 'unknown';
  const source = url ? (url.searchParams.get('s') || url.searchParams.get('utm_source') || '') : '';
  try {
    await db.execute({
      sql: `INSERT INTO tracking_events
            (media_uuid, ip, user_agent, device, os, browser, is_bot, country, region, city, referer, lang, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [uuid, ip, ua, device, os, browser, is_bot ? 1 : 0,
             h('x-vercel-ip-country'), h('x-vercel-ip-country-region'), h('x-vercel-ip-city'),
             h('referer'), h('accept-language').split(',')[0], source],
    });
  } catch (e) {
    console.error('[events] insert error:', e);
  }
}
