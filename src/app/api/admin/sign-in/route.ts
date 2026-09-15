import { NextRequest, NextResponse } from 'next/server';
import { adminSecret } from '../../../../lib/admin-auth';
import {
  ADMIN_SESSION_COOKIE,
  DASHBOARD_PATH,
  SIGN_IN_PATH,
  createAdminSession,
  sessionCookieOptions,
} from '../../../../lib/admin-session';
import { htmlPage } from '../../../../lib/html-page';
import { safeLocalPath } from '../../../../lib/portal-pass';
import { sameSecret } from '../../../../lib/signed';

// Sign-in of the dashboard (form on /sign-in): ADMIN_SECRET is typed once and
// traded for the signed session cookie; the secret itself is never stored in
// the browser. Form fields: `secret`, and `from` (a local path to return to).
//
// Answers with relative 303 redirects, so the browser follows with a GET on
// this same host whatever proxy sits in front.

function redirect(location: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {
    // not a form post: treated as a wrong secret below
  }
  const candidate = form?.get('secret');
  const from = safeLocalPath(form?.get('from'));

  let session: { token: string; maxAgeSeconds: number };
  try {
    const secret = adminSecret();
    if (!secret) throw new Error('Missing env variable: ADMIN_SECRET');
    if (typeof candidate !== 'string' || !sameSecret(candidate, secret)) {
      const back = new URLSearchParams({ error: 'invalid', ...(from ? { from } : {}) });
      return redirect(`${SIGN_IN_PATH}?${back}`);
    }
    session = createAdminSession();
  } catch (err) {
    console.error('[admin/sign-in] cannot create a session:', err instanceof Error ? err.message : err);
    return htmlPage(500, 'Sign-in unavailable', '<p>This dashboard is not configured for sign-in. The server log names the missing setting.</p>');
  }

  const res = redirect(from ?? DASHBOARD_PATH);
  res.cookies.set(ADMIN_SESSION_COOKIE, session.token, sessionCookieOptions(session.maxAgeSeconds));
  return res;
}
