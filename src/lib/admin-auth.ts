import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from './admin-session';
import { sameSecret } from './signed';

// Who may call an admin API route.
//
// - `x-admin-secret` header = ADMIN_SECRET: machine-to-machine (the metadata
//   pipeline, ../pipeline/tracker.py). Checked first and on its own, so the
//   pipeline never depends on the browser session configuration.
// - The admin session cookie (src/lib/admin-session.ts): the dashboard in a
//   browser, after the sign-in or a portal pass. Only where `allowSession`.
//
// Query strings are never read: they end up in logs and browser history.

export const ADMIN_SECRET_HEADER = 'x-admin-secret';

/** ADMIN_SECRET as configured, or null (logged, naming the variable) when unset. */
export function adminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error('[admin-auth] Missing env variable: ADMIN_SECRET');
    return null;
  }
  return secret;
}

export type AdminAuth ='header' | 'session' | 'unauthorized' | 'misconfigured';

interface CookieRequest {
  headers: Headers;
  cookies: { get(name: string): { value: string } | undefined };
}

export function authorizeAdmin(req: CookieRequest, { allowSession }: { allowSession: boolean }): AdminAuth {
  const header = req.headers.get(ADMIN_SECRET_HEADER);
  if (header) {
    // Compared with the value exactly as configured, as before this helper
    // existed. Unset keeps that answer (401) for the pipeline, logged by name.
    const secret = adminSecret();
    if (sameSecret(header, secret)) return 'header';
  }

  const token = allowSession ? req.cookies.get(ADMIN_SESSION_COOKIE)?.value : undefined;
  if (!token) return 'unauthorized';
  try {
    return isValidAdminSession(token) ? 'session' : 'unauthorized';
  } catch (err) {
    console.error('[admin-auth] admin session check failed:', err instanceof Error ? err.message : err);
    return 'misconfigured';
  }
}

/** The JSON error answer for a refused request, or null when the request is authorized. */
export function adminAuthError(auth: AdminAuth): NextResponse | null {
  if (auth === 'header' || auth === 'session') return null;
  if (auth === 'misconfigured') return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
