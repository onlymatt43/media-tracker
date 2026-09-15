import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, SIGN_IN_PATH } from '../../../../lib/admin-session';

// Sign-out of the dashboard: expires the session cookie on this host and goes
// back to the sign-in. Stateless sessions: a copied token stays valid until it
// expires (rotate TRACKER_SESSION_SECRET to revoke every session).
export async function POST() {
  const res = new NextResponse(null, { status: 303, headers: { Location: SIGN_IN_PATH, 'Cache-Control': 'no-store' } });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
