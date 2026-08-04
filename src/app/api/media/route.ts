import { NextRequest, NextResponse } from 'next/server';
import { ensureMediaTable } from '../../../lib/events';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function getDb() {
  const { createClient } = await import('@libsql/client');
  return createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN });
}

// Enregistre (ou met à jour) un média : uuid → url + contexte.
// Appelé par le pipeline au deliver. Auth : header x-admin-secret.
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

  const { uuid, url, type, title, category, owner, collaborators } = body || {};
  if (!uuid || !url) {
    return NextResponse.json({ error: 'uuid and url required' }, { status: 400 });
  }

  const db = await getDb();
  await ensureMediaTable(db);
  await db.execute({
    sql: `INSERT INTO media (uuid, url, type, title, category, owner, collaborators, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(uuid) DO UPDATE SET
            url=excluded.url, type=excluded.type, title=excluded.title,
            category=excluded.category, owner=excluded.owner,
            collaborators=excluded.collaborators, updated_at=datetime('now')`,
    args: [uuid, url, type ?? null, title ?? null, category ?? null, owner ?? null,
           collaborators ? JSON.stringify(collaborators) : null],
  });

  return NextResponse.json({ ok: true, uuid, track_url: `/m/${uuid}` });
}
