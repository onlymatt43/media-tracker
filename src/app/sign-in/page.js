import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, DASHBOARD_PATH, isValidAdminSession } from '@/lib/admin-session';
import { safeLocalPath } from '@/lib/portal-pass';
import { siteName } from '@/lib/site-config';

// Sign-in of the dashboard: the fallback to the portal pass. The form posts to
// /api/admin/sign-in, which trades ADMIN_SECRET for the session cookie. Plain
// HTML form, no client script.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

const ERRORS = {
  invalid: 'Wrong secret.',
};

export default async function SignInPage({ searchParams }) {
  const { from, error } = await searchParams;
  const returnTo = safeLocalPath(from);

  // Already signed in: straight on. A broken session configuration is not
  // decided here — the form's answer names it in the server log.
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  let signedIn = false;
  try {
    signedIn = isValidAdminSession(token);
  } catch (err) {
    console.error('[sign-in] admin session check failed:', err instanceof Error ? err.message : err);
  }
  if (signedIn) redirect(returnTo ?? DASHBOARD_PATH);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{siteName()}</h1>
      <form method="post" action="/api/admin/sign-in" className="flex w-full max-w-xs flex-col gap-3">
        <label htmlFor="secret" className="text-sm opacity-80">Admin secret</label>
        <input
          id="secret"
          name="secret"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="rounded-md border border-current bg-transparent px-3 py-2"
        />
        {returnTo ? <input type="hidden" name="from" value={returnTo} /> : null}
        {ERRORS[error] ? <p role="alert" className="text-sm text-red-500">{ERRORS[error]}</p> : null}
        <button type="submit" className="rounded-full border border-current px-5 py-2 font-medium">
          Sign in
        </button>
      </form>
    </main>
  );
}
