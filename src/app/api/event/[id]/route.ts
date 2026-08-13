import { NextRequest, NextResponse } from 'next/server';
import { ensureEventsTable, logEvent } from '../../../../lib/events';
import { getDb } from '../../../../lib/db';

// Beacon d'engagement vidéo (v2 analytics) : navigator.sendBeacon(..., Blob text/plain)
// depuis om-track.js, sur play/pause/ended et le franchissement de 25/50/75/100 %.
// Payload attendu : { event: "play"|"pause"|"ended"|"q25"|"q50"|"q75"|"q100", position, duration, session }.
// CORS : sendBeacon + Blob "text/plain" est une requête simple, pas de préflight — la
// réponse n'a rien à exposer (204), donc rien à autoriser explicitement côté headers.
// Non-bloquant : un payload invalide ou une erreur d'insert ne remonte jamais d'erreur
// au client (même posture que le pixel /api/track).
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
