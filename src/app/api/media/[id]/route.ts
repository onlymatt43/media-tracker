import { NextRequest, NextResponse } from 'next/server';
import { ensureMediaTable } from '../../../../lib/events';
import { getDb } from '../../../../lib/db';

// Lecture PUBLIQUE d'un média (pour l'embarquer sur un site : WP/Breakdance, etc.).
// Renvoie de quoi construire l'embed + le pixel/lien de tracking.
// GET /api/media/<uuid>
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uuid } = await params;
  if (!uuid || uuid.length < 8) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureMediaTable(db);
    const r = await db.execute({
      sql: `SELECT uuid, url, type, title, category, stream_lib, stream_guid FROM media WHERE uuid = ?`,
      args: [uuid],
    });
    const m: any = r.rows[0];
    if (!m) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    const kind = m.stream_guid ? 'stream' : (m.type === 'video' ? 'video' : 'image');
    // The Bunny Stream embed host comes from the environment, never hardcoded.
    // A stream media with no host configured fails loudly, naming the missing
    // variable, rather than emitting a broken iframe URL.
    let embed = m.url;
    if (m.stream_guid) {
      const embedHost = process.env.BUNNY_STREAM_EMBED_HOST;
      if (!embedHost) {
        return NextResponse.json(
          { error: 'Missing required environment variable: BUNNY_STREAM_EMBED_HOST' },
          { status: 500 },
        );
      }
      embed = `https://${embedHost}/embed/${m.stream_lib}/${m.stream_guid}`;
    }

    return NextResponse.json({
      uuid: m.uuid,
      kind,
      type: m.type,
      title: m.title,
      category: m.category,
      url: m.url,          // page/redirect
      embed,               // à mettre dans un <iframe> (stream) ou <img>/<video> (fichier)
      pixel: `/api/track/${m.uuid}`,
      link: `/m/${m.uuid}`,
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('[media GET] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
