import { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  DASHBOARD_PATH,
  SIGN_IN_PATH,
  createAdminSession,
  sessionCookieOptions,
} from '../../../../lib/admin-session';
import { escapeHtml, htmlPage } from '../../../../lib/html-page';
import { checkPortalPass } from '../../../../lib/portal-pass';

// Entry from the owner's portal: a form post carrying a portal pass
// (src/lib/portal-pass.ts). A valid pass opens the same admin session as the
// sign-in with ADMIN_SECRET; anything else explains and links to that sign-in.
//
// The answer is a small page that moves on by itself, not a redirect: this
// request comes from another site, and a SameSite=Lax cookie set in that answer
// is only sent once the browser starts a navigation from this site.

export async function POST(req: NextRequest) {
  let token: FormDataEntryValue | null = null;
  try {
    token = (await req.formData()).get('pass');
  } catch {
    // not a form post: handled as a malformed pass below
  }

  let check;
  let session;
  try {
    check = checkPortalPass(token);
    session = check.ok ? createAdminSession() : null;
  } catch (err) {
    console.error('[admin/portal-pass] configuration error:', err instanceof Error ? err.message : err);
    return htmlPage(500, 'Portal sign-in unavailable', `<p>This dashboard is not configured for the portal yet.</p><p><a href="${SIGN_IN_PATH}">Sign in with the admin secret</a></p>`);
  }

  if (!check.ok || !session) {
    console.warn('[admin/portal-pass] refused:', check.ok ? 'no session' : check.reason);
    return htmlPage(401, 'Pass refused', `<p>The portal pass was not accepted (it may have expired). Open this dashboard again from the portal, or sign in here.</p><p><a href="${SIGN_IN_PATH}">Sign in with the admin secret</a></p>`);
  }

  const destination = check.to ?? DASHBOARD_PATH;
  const res = htmlPage(200, 'Signed in', `<p><a href="${escapeHtml(destination)}">Continue to the dashboard</a></p>`, destination);
  res.cookies.set(ADMIN_SESSION_COOKIE, session.token, sessionCookieOptions(session.maxAgeSeconds));
  return res;
}
