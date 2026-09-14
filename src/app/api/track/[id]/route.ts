import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { ensureEventsTable, logEvent } from '../../../../lib/events';

// Tracking pixel: <img src="/api/track/<uuid>"> on an HTML page (passive view).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uuid } = await params;

  if (uuid && uuid.length >= 8) {
    try {
      const db = await getDb();
      await ensureEventsTable(db);
      await logEvent(db, req, uuid, new URL(req.url));
    } catch (err) {
      console.error('[tracking] insert error:', err);
    }
  }

  const pixel = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b,
  ]);

  return new NextResponse(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
