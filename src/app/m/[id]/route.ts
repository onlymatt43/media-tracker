import { NextRequest, NextResponse } from 'next/server';
import { ensureEventsTable, ensureMediaTable, logEvent } from '../../../lib/events';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

async function getDb() {
  const { createClient } = await import('@libsql/client');
  return createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
}

// Tracked link: /m/<uuid>[?s=source]
//   → logs the (rich) view, then redirects (302) to the media URL.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uuid } = await params;
  if (!uuid || uuid.length < 8) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  let url: string | null = null;
  try {
    const db = await getDb();
    await ensureMediaTable(db);
    await ensureEventsTable(db);

    const r = await db.execute({ sql: `SELECT url FROM media WHERE uuid = ?`, args: [uuid] });
    url = (r.rows[0]?.url as string) ?? null;

    if (url) {
      await logEvent(db, req, uuid, new URL(req.url));
    }
  } catch (err) {
    console.error('[m] error:', err);
  }

  if (!url) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return NextResponse.redirect(url, 302);
}
