import { createHmac, randomUUID } from 'node:crypto';
import { requireEnv, requirePositiveIntEnv } from './env';
import { sign, verify } from './signed';

// Admin session cookie of the dashboard: a signed, expiring token instead of
// ADMIN_SECRET kept in the browser.
//
// The token is signed with a key derived from TRACKER_SESSION_SECRET, never
// from ADMIN_SECRET: a MAC keyed by a human-chosen secret would let anyone
// holding one cookie brute-force that secret offline.
//
// Stateless, so signing out clears the cookie but cannot revoke a copied token
// before it expires. Rotating TRACKER_SESSION_SECRET revokes every session;
// changing ADMIN_SECRET alone does not.
//
// Node.js only (node:crypto): it runs in route handlers, server components and
// src/proxy.ts, which Next.js 16 runs on the Node.js runtime.

// Named for this app rather than a generic "admin_session": other apps on a
// parent domain may set a domain-wide admin_session cookie, which the browser
// would send alongside this one.
export const ADMIN_SESSION_COOKIE = 'tracker_admin_session';

// App routes of the admin flow. The static dashboard (public/dashboard.html)
// repeats the sign-in and sign-out paths in its script: keep them identical.
export const DASHBOARD_PATH = '/dashboard.html';
export const SIGN_IN_PATH = '/sign-in';

// Context label of the derived key, so this key never signs any other kind of token.
const SESSION_CONTEXT = 'tracker-admin-session/v1';

// Minimum entropy of TRACKER_SESSION_SECRET, in decoded bytes.
const MIN_SECRET_BYTES = 32;

function decodeSecret(text: string): Buffer | null {
  if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) return Buffer.from(text, 'hex');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return Buffer.from(text, 'base64');
  if (/^[A-Za-z0-9_-]+$/.test(text)) return Buffer.from(text, 'base64url');
  return null;
}

function sessionKey(): Buffer {
  const secret = decodeSecret(requireEnv('TRACKER_SESSION_SECRET'));
  if (!secret || secret.length < MIN_SECRET_BYTES) {
    throw new Error(
      `Env variable TRACKER_SESSION_SECRET must be hex or base64 encoding of at least ${MIN_SECRET_BYTES} random bytes`,
    );
  }
  return createHmac('sha256', secret).update(SESSION_CONTEXT).digest();
}

interface AdminSessionPayload {
  exp: number;
  nonce: string;
}

/** A new session token and its lifetime. Throws naming the variable when the config is missing or invalid. */
export function createAdminSession(): { token: string; maxAgeSeconds: number } {
  const maxAgeSeconds = requirePositiveIntEnv('TRACKER_SESSION_TTL_SECONDS');
  const payload: AdminSessionPayload = { exp: Date.now() + maxAgeSeconds * 1000, nonce: randomUUID() };
  return { token: sign(payload, sessionKey()), maxAgeSeconds };
}

/** True for an unexpired token signed with the current key. Throws when TRACKER_SESSION_SECRET is missing or invalid. */
export function isValidAdminSession(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = verify<AdminSessionPayload>(token, sessionKey());
  return payload !== null && typeof payload.nonce === 'string';
}

/**
 * Cookie attributes of the session: httpOnly, SameSite=Lax, Secure in
 * production, host-only (no Domain attribute), whole site.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
