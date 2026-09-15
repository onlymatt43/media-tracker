import { test, before, after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET as adminGet } from '../src/app/api/admin/route';
import { POST as mediaPost } from '../src/app/api/media/route';
import { POST as signInPost } from '../src/app/api/admin/sign-in/route';
import { POST as signOutPost } from '../src/app/api/admin/sign-out/route';
import { ADMIN_SESSION_COOKIE, createAdminSession, isValidAdminSession } from '../src/lib/admin-session';
import { getDb } from '../src/lib/db';
import { ensureEventsTable, ensureMediaTable } from '../src/lib/events';
import { envSnapshot, randomHexSecret } from './helpers';

// The admin API against a throwaway local libSQL file: header auth (pipeline),
// session cookie auth (dashboard), neither.

const ADMIN = 'test-admin-secret';
const restore = envSnapshot([
  'ADMIN_SECRET', 'TRACKER_SESSION_SECRET', 'TRACKER_SESSION_TTL_SECONDS', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN',
]);
let dir: string;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'media-tracker-test-'));
});
beforeEach(async () => {
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = 'unused-for-a-local-file';
  process.env.ADMIN_SECRET = ADMIN;
  process.env.TRACKER_SESSION_SECRET = randomHexSecret();
  process.env.TRACKER_SESSION_TTL_SECONDS = '600';
  const db = await getDb();
  await ensureEventsTable(db);
  await ensureMediaTable(db);
});
afterEach(restore);
after(() => rmSync(dir, { recursive: true, force: true }));

const adminRequest = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/admin', { headers });

test('GET /api/admin accepts the x-admin-secret header (pipeline), with no session configuration at all', async () => {
  delete process.env.TRACKER_SESSION_SECRET;
  delete process.env.TRACKER_SESSION_TTL_SECONDS;
  const res = await adminGet(adminRequest({ 'x-admin-secret': ADMIN }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok('totals' in body && Array.isArray(body.medias));
});

test('GET /api/admin accepts a valid session cookie', async () => {
  const { token } = createAdminSession();
  const res = await adminGet(adminRequest({ cookie: `${ADMIN_SESSION_COOKIE}=${token}` }));
  assert.equal(res.status, 200);
});

test('GET /api/admin refuses neither, a wrong header, a forged or expired cookie, a query-string secret', async (t) => {
  const refused = async (req: NextRequest) => assert.equal((await adminGet(req)).status, 401);
  await refused(adminRequest());
  await refused(adminRequest({ 'x-admin-secret': `${ADMIN}x` }));
  await refused(adminRequest({ 'x-admin-secret': ADMIN.slice(0, -1) }));
  await refused(adminRequest({ cookie: `${ADMIN_SESSION_COOKIE}=${ADMIN}` }));
  await refused(adminRequest({ cookie: `admin_session=${createAdminSession().token}` }));
  await refused(new NextRequest(`http://localhost/api/admin?secret=${ADMIN}&x-admin-secret=${ADMIN}`));
  const { token } = createAdminSession();
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 601_000);
  await refused(adminRequest({ cookie: `${ADMIN_SESSION_COOKIE}=${token}` }));
});

test('GET /api/admin: unset ADMIN_SECRET refuses the header with 401, as before, and logs the name', async (t) => {
  const errors: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args.join(' ')); });
  delete process.env.ADMIN_SECRET;
  assert.equal((await adminGet(adminRequest({ 'x-admin-secret': ADMIN }))).status, 401);
  assert.ok(errors.some((e) => e.includes('ADMIN_SECRET')));
});

test('GET /api/admin: a cookie with a broken session configuration is a 500, logged by name', async (t) => {
  const { token } = createAdminSession();
  const errors: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args.join(' ')); });
  delete process.env.TRACKER_SESSION_SECRET;
  const res = await adminGet(adminRequest({ cookie: `${ADMIN_SESSION_COOKIE}=${token}` }));
  assert.equal(res.status, 500);
  assert.ok(errors.some((e) => e.includes('TRACKER_SESSION_SECRET')));
});

const mediaRequest = (headers: Record<string, string>) =>
  new NextRequest('http://localhost/api/media', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ uuid: '00000000-0000-4000-8000-000000000001', url: 'https://media.example/a.jpg', stream_lib: 42 }),
  });

test('POST /api/media: header only — the pipeline registers, a session cookie does not', async () => {
  const ok = await mediaPost(mediaRequest({ 'x-admin-secret': ADMIN }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).ok, true);
  const { token } = createAdminSession();
  assert.equal((await mediaPost(mediaRequest({ cookie: `${ADMIN_SESSION_COOKIE}=${token}` }))).status, 401);
  assert.equal((await mediaPost(mediaRequest({ 'x-admin-secret': 'wrong' }))).status, 401);
  assert.equal((await mediaPost(mediaRequest({}))).status, 401);
});

const signInRequest = (fields: Record<string, string>) =>
  new NextRequest('http://localhost/api/admin/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

test('sign-in: the right secret sets the session cookie and returns to a safe `from` or the dashboard', async () => {
  let res = await signInPost(signInRequest({ secret: ADMIN }));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/dashboard.html');
  const cookie = res.cookies.get(ADMIN_SESSION_COOKIE);
  assert.ok(cookie && isValidAdminSession(cookie.value));
  assert.ok(!cookie.value.includes(ADMIN));
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');

  res = await signInPost(signInRequest({ secret: ADMIN, from: '/dashboard.html' }));
  assert.equal(res.headers.get('location'), '/dashboard.html');
  res = await signInPost(signInRequest({ secret: ADMIN, from: '//evil.example/' }));
  assert.equal(res.headers.get('location'), '/dashboard.html');
});

test('sign-in: a wrong or missing secret goes back to the form with no cookie', async () => {
  for (const fields of [{ secret: 'wrong', from: '/dashboard.html' }, { secret: '' }, {}]) {
    const res = await signInPost(signInRequest(fields));
    assert.equal(res.status, 303);
    assert.match(res.headers.get('location') ?? '', /^\/sign-in\?error=invalid/);
    assert.equal(res.cookies.get(ADMIN_SESSION_COOKIE), undefined);
  }
});

test('sign-in: missing configuration is a 500, logged by name', async (t) => {
  const errors: string[] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args.join(' ')); });
  delete process.env.TRACKER_SESSION_TTL_SECONDS;
  assert.equal((await signInPost(signInRequest({ secret: ADMIN }))).status, 500);
  assert.ok(errors.some((e) => e.includes('TRACKER_SESSION_TTL_SECONDS')));
  delete process.env.ADMIN_SECRET;
  assert.equal((await signInPost(signInRequest({ secret: ADMIN }))).status, 500);
  assert.ok(errors.some((e) => e.includes('ADMIN_SECRET')));
});

test('sign-out: expires the cookie and returns to the sign-in', async () => {
  const res = await signOutPost();
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/sign-in');
  assert.match(res.headers.get('set-cookie') ?? '', new RegExp(`^${ADMIN_SESSION_COOKIE}=;.*Max-Age=0`));
});
