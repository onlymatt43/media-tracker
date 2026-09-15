import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAdminSession, isValidAdminSession, sessionCookieOptions } from '../src/lib/admin-session';
import { sameSecret } from '../src/lib/signed';
import { envSnapshot, randomHexSecret } from './helpers';

const restore = envSnapshot(['ADMIN_SECRET', 'TRACKER_SESSION_SECRET', 'TRACKER_SESSION_TTL_SECONDS', 'NODE_ENV']);
afterEach(restore);

test('session: signed token that never contains the admin secret', () => {
  process.env.ADMIN_SECRET = 'operator-secret';
  process.env.TRACKER_SESSION_SECRET = randomBytes(48).toString('base64');
  process.env.TRACKER_SESSION_TTL_SECONDS = '60';
  const { token, maxAgeSeconds } = createAdminSession();
  assert.equal(maxAgeSeconds, 60);
  assert.ok(!token.includes(process.env.ADMIN_SECRET));
  assert.equal(isValidAdminSession(token), true);
  assert.notEqual(createAdminSession().token, token);
});

test('session: refuses missing, forged, re-keyed and ADMIN_SECRET-as-token values', () => {
  process.env.ADMIN_SECRET = 'operator-secret';
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  process.env.TRACKER_SESSION_TTL_SECONDS = '60';
  const { token } = createAdminSession();
  const [body, mac] = token.split('.');
  assert.equal(isValidAdminSession(undefined), false);
  assert.equal(isValidAdminSession(''), false);
  assert.equal(isValidAdminSession(process.env.ADMIN_SECRET), false);
  const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 3_600_000, nonce: 'x' })).toString('base64url');
  assert.equal(isValidAdminSession(`${forged}.${mac}`), false);
  assert.equal(isValidAdminSession(`${body}.`), false);
  assert.equal(isValidAdminSession(`${token}.extra`), false);
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  assert.equal(isValidAdminSession(token), false);
});

test('session: expires after TRACKER_SESSION_TTL_SECONDS', (t) => {
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  process.env.TRACKER_SESSION_TTL_SECONDS = '5';
  const { token } = createAdminSession();
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 4_000);
  assert.equal(isValidAdminSession(token), true);
  t.mock.method(Date, 'now', () => now + 6_000);
  assert.equal(isValidAdminSession(token), false);
});

test('session: missing or weak config fails loudly, naming the variable', () => {
  process.env.TRACKER_SESSION_TTL_SECONDS = '60';
  assert.throws(() => createAdminSession(), /TRACKER_SESSION_SECRET/);
  assert.throws(() => isValidAdminSession('a.b'), /TRACKER_SESSION_SECRET/);
  process.env.TRACKER_SESSION_SECRET = randomBytes(16).toString('hex');
  assert.throws(() => createAdminSession(), /TRACKER_SESSION_SECRET/);
  process.env.TRACKER_SESSION_SECRET = 'not a secret!';
  assert.throws(() => createAdminSession(), /TRACKER_SESSION_SECRET/);
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  delete process.env.TRACKER_SESSION_TTL_SECONDS;
  assert.throws(() => createAdminSession(), /TRACKER_SESSION_TTL_SECONDS/);
  for (const bad of ['0', '-5', '1.5', 'abc']) {
    process.env.TRACKER_SESSION_TTL_SECONDS = bad;
    assert.throws(() => createAdminSession(), /TRACKER_SESSION_TTL_SECONDS/);
  }
});

test('session cookie: httpOnly, Lax, host-only, Secure only in production', () => {
  (process.env as Record<string, string>).NODE_ENV = 'production';
  const prod = sessionCookieOptions(60);
  assert.deepEqual(prod, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 });
  assert.equal('domain' in prod, false);
  (process.env as Record<string, string>).NODE_ENV = 'development';
  assert.equal(sessionCookieOptions(60).secure, false);
});

test('sameSecret: whole values only, empty never matches', () => {
  assert.equal(sameSecret('abc', 'abc'), true);
  assert.equal(sameSecret('abc', 'abcd'), false);
  assert.equal(sameSecret('abcd', 'abc'), false);
  assert.equal(sameSecret('', ''), false);
  assert.equal(sameSecret('abc', null), false);
  assert.equal(sameSecret(undefined, 'abc'), false);
});
