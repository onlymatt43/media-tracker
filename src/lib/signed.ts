import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Compact signed tokens (payload.signature, HMAC-SHA256, base64url), used for
// the admin session cookie (src/lib/admin-session.ts).

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

export function sign<T extends { exp: number }>(payload: T, secret: string | Buffer): string {
  const body = b64(JSON.stringify(payload));
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** The payload when the signature is valid and `exp` (ms epoch) is in the future. */
export function verify<T extends { exp: number }>(token: string | null | undefined, secret: string | Buffer): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
    return typeof payload.exp === 'number' && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Constant-time comparison of a candidate with a secret. Both sides are hashed
 * first, so the comparison takes the same time whatever the lengths and does
 * not reveal the secret's length. An empty side never matches.
 */
export function sameSecret(candidate: string | null | undefined, secret: string | null | undefined): boolean {
  if (!candidate || !secret) return false;
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}
