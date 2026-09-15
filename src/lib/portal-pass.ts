import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { requireEnv, requirePositiveIntEnv } from './env';

// Verifies a pass issued by the owner's portal (admin.onlymatt.ca), which opens
// the dashboard without typing ADMIN_SECRET. The dashboard's own sign-in is
// unchanged and stays the fallback.
//
//   v1.<base64url(JSON payload)>.<base64url(Ed25519 signature of "v1.<payload>")>
//   payload: { aud, iat, exp, jti, to? }   (iat and exp in ms since epoch)
//
// Only the portal holds the private key. This app holds the public key
// (PORTAL_PASS_PUBLIC_KEY), which can check a pass but never make one. A pass
// is accepted when its signature is valid, it is addressed to this app
// (PORTAL_PASS_AUDIENCE), it has not expired, and it does not claim to live
// longer than PORTAL_PASS_MAX_TTL_SECONDS: a pass minted with a far expiry is
// refused even with a valid signature.
//
// Not single-use: there is no store here to remember a pass once used. It lives
// only seconds and travels in a POST body from the owner's own browser, never
// in an address.
//
// Same format and checks as release-onlymatt/lib/portal-pass.ts: a change to
// the format is a change to every system the portal opens.
const VERSION = 'v1';

let cachedKey: { source: string; key: KeyObject } | null = null;

function publicKey(): KeyObject {
  const source = requireEnv('PORTAL_PASS_PUBLIC_KEY');
  if (cachedKey?.source === source) return cachedKey.key;
  let key: KeyObject;
  try {
    key = createPublicKey({ key: Buffer.from(source, 'base64'), format: 'der', type: 'spki' });
  } catch {
    throw new Error('Env variable PORTAL_PASS_PUBLIC_KEY must be a base64 SPKI DER Ed25519 public key');
  }
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('Env variable PORTAL_PASS_PUBLIC_KEY must be an Ed25519 key');
  }
  cachedKey = { source, key };
  return key;
}

export type PassCheck =
  | { ok: true; to: string | null }
  | { ok: false; reason: 'malformed' | 'signature' | 'audience' | 'expired' | 'lifetime' };

/** A same-site path, or null. Refuses "//host", "/\host" and control characters. */
export function safeLocalPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) return null;
  if (candidate.startsWith('//') || candidate.includes('\\')) return null;
  if (/[\x00-\x1f\x7f]/.test(candidate)) return null;
  return candidate;
}

/** Throws, naming the variable, when this app's pass configuration is missing or invalid. */
export function checkPortalPass(token: unknown, now = Date.now()): PassCheck {
  const key = publicKey();
  const audience = requireEnv('PORTAL_PASS_AUDIENCE');
  const maxTtlMs = requirePositiveIntEnv('PORTAL_PASS_MAX_TTL_SECONDS') * 1000;

  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION || !parts[1] || !parts[2]) return { ok: false, reason: 'malformed' };
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  if (!verify(null, signed, key, Buffer.from(parts[2], 'base64url'))) return { ok: false, reason: 'signature' };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (payload.aud !== audience) return { ok: false, reason: 'audience' };
  if (typeof payload.exp !== 'number' || payload.exp <= now) return { ok: false, reason: 'expired' };
  if (payload.exp > now + maxTtlMs) return { ok: false, reason: 'lifetime' };
  return { ok: true, to: safeLocalPath(payload.to) };
}
