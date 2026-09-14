import { NextRequest, NextResponse } from 'next/server';
import { ensureEventsTable, ensureMediaTable, logEvent } from '../../../lib/events';
import { getDb } from '../../../lib/db';

// Tracked link: /m/<uuid>[?s=source]
//   → logs the (rich) view, then redirects (302) to the media URL.
// 404 only when the database answered and knows no such media. A database that
// cannot be reached or queried (outage, missing TURSO_* variables) is a 503:
// reported as "Not Found" it would look like every tracked link was deleted.
// Logging the view stays best-effort: a failed insert never blocks the redirect.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uuid } = await params;
  if (!uuid || uuid.length < 8) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  let db: Awaited<ReturnType<typeof getDb>>;
  let url: string | null;
  try {
    db = await getDb();
    await ensureMediaTable(db);
    const r = await db.execute({ sql: `SELECT url FROM media WHERE uuid = ?`, args: [uuid] });
    url = (r.rows[0]?.url as string) ?? null;
  } catch (err) {
    console.error('[m] media lookup failed:', err);
    return new NextResponse('Service Unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!url) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    await ensureEventsTable(db);
    await logEvent(db, req, uuid, new URL(req.url));
  } catch (err) {
    console.error('[m] view not logged:', err);
  }
  return NextResponse.redirect(url, 302);
}
