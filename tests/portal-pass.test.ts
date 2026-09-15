import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { checkPortalPass, safeLocalPath } from '../src/lib/portal-pass';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '../src/lib/admin-session';
import { POST as portalPassPost } from '../src/app/api/admin/portal-pass/route';
import { envSnapshot, mintPass, passKeys, passPayload, randomHexSecret } from './helpers';

const AUDIENCE = 'test-audience';
const restore = envSnapshot([
  'PORTAL_PASS_PUBLIC_KEY', 'PORTAL_PASS_AUDIENCE', 'PORTAL_PASS_MAX_TTL_SECONDS',
  'TRACKER_SESSION_SECRET', 'TRACKER_SESSION_TTL_SECONDS',
]);
let keys: ReturnType<typeof passKeys>;

beforeEach(() => {
  keys = passKeys();
  process.env.PORTAL_PASS_PUBLIC_KEY = keys.publicKeyBase64;
  process.env.PORTAL_PASS_AUDIENCE = AUDIENCE;
  process.env.PORTAL_PASS_MAX_TTL_SECONDS = '60';
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  process.env.TRACKER_SESSION_TTL_SECONDS = '3600';
});
afterEach(restore);

test('pass: a valid pass is accepted, with its safe `to`', () => {
  assert.deepEqual(checkPortalPass(mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000))), { ok: true, to: null });
  const withTo = mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000, { to: '/dashboard.html' }));
  assert.deepEqual(checkPortalPass(withTo), { ok: true, to: '/dashboard.html' });
  const unsafeTo = mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000, { to: 'https://elsewhere.example/' }));
  assert.deepEqual(checkPortalPass(unsafeTo), { ok: true, to: null });
});

test('pass: refuses a bad signature, another audience, an expired or over-long pass', () => {
  const other = passKeys();
  assert.deepEqual(checkPortalPass(mintPass(other.privateKey, passPayload(AUDIENCE, 30_000))), { ok: false, reason: 'signature' });
  assert.deepEqual(checkPortalPass(mintPass(keys.privateKey, passPayload('another-app', 30_000))), { ok: false, reason: 'audience' });
  assert.deepEqual(checkPortalPass(mintPass(keys.privateKey, passPayload(AUDIENCE, -1))), { ok: false, reason: 'expired' });
  assert.deepEqual(checkPortalPass(mintPass(keys.privateKey, passPayload(AUDIENCE, 61_000))), { ok: false, reason: 'lifetime' });

  // A payload changed after signing no longer matches its signature.
  const [v, , sig] = mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000)).split('.');
  const swapped = Buffer.from(JSON.stringify(passPayload(AUDIENCE, 30_000, { to: '/x' }))).toString('base64url');
  assert.deepEqual(checkPortalPass(`${v}.${swapped}.${sig}`), { ok: false, reason: 'signature' });
});

test('pass: refuses malformed values', () => {
  const good = mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000));
  for (const bad of [null, 42, '', 'v1', 'v1.a', `v2.${good.slice(3)}`, `${good}.extra`, good.replace('v1.', 'v1..')]) {
    const result = checkPortalPass(bad);
    assert.equal(result.ok, false, String(bad));
  }
});

test('pass: missing or invalid configuration throws, naming the variable', () => {
  const pass = mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000));
  delete process.env.PORTAL_PASS_AUDIENCE;
  assert.throws(() => checkPortalPass(pass), /PORTAL_PASS_AUDIENCE/);
  process.env.PORTAL_PASS_AUDIENCE = AUDIENCE;
  process.env.PORTAL_PASS_MAX_TTL_SECONDS = '0';
  assert.throws(() => checkPortalPass(pass), /PORTAL_PASS_MAX_TTL_SECONDS/);
  process.env.PORTAL_PASS_MAX_TTL_SECONDS = '60';
  process.env.PORTAL_PASS_PUBLIC_KEY = 'bm90IGEga2V5';
  assert.throws(() => checkPortalPass(pass), /PORTAL_PASS_PUBLIC_KEY/);
  delete process.env.PORTAL_PASS_PUBLIC_KEY;
  assert.throws(() => checkPortalPass(pass), /PORTAL_PASS_PUBLIC_KEY/);
});

test('safeLocalPath: only same-site paths', () => {
  assert.equal(safeLocalPath('/dashboard.html'), '/dashboard.html');
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'dashboard.html', '/a\nb', '/a\x7fb', 42, null]) {
    assert.equal(safeLocalPath(bad), null, JSON.stringify(bad));
  }
});

function passRequest(pass: string | null) {
  const body = new URLSearchParams(pass === null ? {} : { pass });
  return new NextRequest('http://localhost/api/admin/portal-pass', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

test('portal-pass route: valid pass sets the session cookie and moves on to `to` or the dashboard', async () => {
  let res = await portalPassPost(passRequest(mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000))));
  assert.equal(res.status, 200);
  const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
  assert.ok(cookie?.value);
  assert.equal(isValidAdminSession(cookie.value), true);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.domain, undefined);
  assert.equal(cookie.maxAge, 3600);
  assert.match(await res.text(), /<meta http-equiv="refresh" content="0;url=\/dashboard\.html">/);

  res = await portalPassPost(passRequest(mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000, { to: '/dashboard.html?bots=1' }))));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /content="0;url=\/dashboard\.html\?bots=1"/);
});

test('portal-pass route: invalid pass is a 401 page linking to the sign-in, with no cookie', async () => {
  for (const req of [
    passRequest(mintPass(passKeys().privateKey, passPayload(AUDIENCE, 30_000))),
    passRequest(mintPass(keys.privateKey, passPayload('another-app', 30_000))),
    passRequest(null),
    new NextRequest('http://localhost/api/admin/portal-pass', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }),
  ]) {
    const res = await portalPassPost(req);
    assert.equal(res.status, 401);
    assert.equal(res.cookies.get(ADMIN_SESSION_COOKIE), undefined);
    assert.match(await res.text(), /href="\/sign-in"/);
  }
});

test('portal-pass route: configuration error is a 500 page, logged with the variable name', async (t) => {
  const errors: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args.join(' ')); });
  delete process.env.PORTAL_PASS_PUBLIC_KEY;
  let res = await portalPassPost(passRequest(mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000))));
  assert.equal(res.status, 500);
  assert.equal(res.cookies.get(ADMIN_SESSION_COOKIE), undefined);
  assert.ok(errors.some((e) => e.includes('PORTAL_PASS_PUBLIC_KEY')));

  process.env.PORTAL_PASS_PUBLIC_KEY = keys.publicKeyBase64;
  delete process.env.TRACKER_SESSION_SECRET;
  res = await portalPassPost(passRequest(mintPass(keys.privateKey, passPayload(AUDIENCE, 30_000))));
  assert.equal(res.status, 500);
  assert.ok(errors.some((e) => e.includes('TRACKER_SESSION_SECRET')));
});
