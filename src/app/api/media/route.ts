import { NextRequest, NextResponse } from 'next/server';
import { ensureMediaTable } from '../../../lib/events';
import { getDb } from '../../../lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Registers (or updates) a media item: uuid → url + context.
// Called by the pipeline on deliver. Auth: x-admin-secret header.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const { uuid, url, type, title, category, owner, collaborators, stream_lib, stream_guid } = body || {};
  if (!uuid || !url) {
    return NextResponse.json({ error: 'uuid and url required' }, { status: 400 });
  }

  const db = await getDb();
  await ensureMediaTable(db);
  await db.execute({
    sql: `INSERT INTO media (uuid, url, type, title, category, owner, collaborators, stream_lib, stream_guid, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(uuid) DO UPDATE SET
            url=excluded.url, type=excluded.type, title=excluded.title,
            category=excluded.category, owner=excluded.owner,
            collaborators=excluded.collaborators, stream_lib=excluded.stream_lib,
            stream_guid=excluded.stream_guid, updated_at=datetime('now')`,
    // stream_lib is a TEXT column but the pipeline sends the library id as a
    // JSON number. libsql binds a JS number as a double, and TEXT affinity
    // then stores it as "552081.0" -- which produced an invalid embed URL
    // (/embed/552081.0/<guid>, HTTP 400). Coercing to a string here keeps the
    // stored value exactly what the pipeline meant.
    args: [uuid, url, type ?? null, title ?? null, category ?? null, owner ?? null,
           collaborators ? JSON.stringify(collaborators) : null,
           stream_lib != null ? String(stream_lib) : null,
           stream_guid != null ? String(stream_guid) : null],
  });

  return NextResponse.json({ ok: true, uuid, track_url: `/m/${uuid}` });
}
