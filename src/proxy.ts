import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, SIGN_IN_PATH, isValidAdminSession } from './lib/admin-session';

// Gate of the static dashboard (public/dashboard.html): without a valid admin
// session the visitor gets the sign-in, not the page. The data itself is also
// refused by /api/admin, so this is the first of two locks.
//
// The matcher lists only the dashboard: every public tracking route (/m, the
// pixel, the beacon, GET /api/media, /om-track.js) never passes through here.
export function proxy(req: NextRequest) {
  let signedIn: boolean;
  try {
    signedIn = isValidAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  } catch (err) {
    console.error('[proxy] admin session check failed:', err instanceof Error ? err.message : err);
    return new NextResponse('Server misconfigured', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = '';
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  matcher: ['/dashboard.html'],
};
