import { NextRequest, NextResponse } from 'next/server';
import { ensureEventsTable, logEvent } from '../../../../lib/events';
import { getDb } from '../../../../lib/db';

// Video engagement beacon (v2 analytics): navigator.sendBeacon(..., Blob text/plain)
// sent by om-track.js on play/pause/ended and when crossing 25/50/75/100 %.
// Expected payload: { event: "play"|"pause"|"ended"|"q25"|"q50"|"q75"|"q100", position, duration, session }.
// CORS: sendBeacon + Blob "text/plain" is a simple request, no preflight — the
// response exposes nothing (204), so nothing needs to be allowed explicitly via headers.
// Non-blocking: an invalid payload or an insert error never surfaces an error
// to the client (same stance as the /api/track pixel).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uuid } = await params;
  if (!uuid || uuid.length < 8) {
    return new NextResponse(null, { status: 204 });
  }

  let body: any = null;
  try {
    const text = await req.text();
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const eventType = typeof body?.event === 'string' ? body.event.slice(0, 20) : null;
  if (!eventType) {
    return new NextResponse(null, { status: 204 });
  }
  const position = typeof body?.position === 'number' ? body.position : null;
  const duration = typeof body?.duration === 'number' ? body.duration : null;
  const sessionId = typeof body?.session === 'string' ? body.session.slice(0, 64) : null;

  try {
    const db = await getDb();
    await ensureEventsTable(db);
    await logEvent(db, req, uuid, new URL(req.url), {
      event_type: eventType, position, duration, session_id: sessionId,
    });
  } catch (err) {
    console.error('[event] insert error:', err);
  }

  return new NextResponse(null, { status: 204 });
}
