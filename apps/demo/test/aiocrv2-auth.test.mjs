import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const username = 'aiocrv2-test-user';
const password = 'aiocrv2-test-password';
let demo;
let origin;
let demoOutput = '';

before(async () => {
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  origin = `http://127.0.0.1:${port}`;

  demo = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DEMO_PORT: String(port),
      AIOCRV2_USERNAME: username,
      AIOCRV2_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex'),
      AIOCRV2_SESSION_SECRET: 'aiocrv2-test-session-secret-0123456789',
      AIOCRV2_COOKIE_SECURE: 'true',
      OPENAI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  demo.stdout.on('data', (chunk) => { demoOutput += chunk.toString(); });
  demo.stderr.on('data', (chunk) => { demoOutput += chunk.toString(); });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Demo server did not start\n${demoOutput}`);
});

after(() => {
  if (demo && !demo.killed) demo.kill();
});

test('AIOCRV2 requires login and accepts configured credentials', async () => {
  const entry = await fetch(`${origin}/aiocrv2/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/aiocrv2/login.html');
  assert.equal(entry.headers.get('cache-control'), 'no-store');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/aiocrv2/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /action="\/aiocrv2\/login"/);
  assert.match(loginHtml, /ログイン制デモ・架空データ/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  assert.equal((await fetch(`${origin}/aiocrv2/login.css`)).status, 200);
  assert.equal((await fetch(`${origin}/aiocrv2/login.js`)).status, 200);
  assert.equal((await fetch(`${origin}/aiocrv2/assets/protected.js`, { redirect: 'manual' })).status, 401);

  const rejected = await fetch(`${origin}/aiocrv2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong-password' }),
    redirect: 'manual',
  });
  assert.equal(rejected.status, 303);
  assert.equal(rejected.headers.get('location'), '/aiocrv2/login.html?error=invalid');
  assert.equal(rejected.headers.has('set-cookie'), false);

  const accepted = await fetch(`${origin}/aiocrv2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/aiocrv2/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /__Secure-aiocrv2=/);
  assert.match(setCookie, /Path=\/aiocrv2/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const app = await fetch(`${origin}/aiocrv2/`, { headers: { cookie } });
  const appHtml = await app.text();
  assert.equal(app.status, 200);
  assert.equal(app.headers.get('cache-control'), 'no-store');
  assert.equal(app.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(appHtml, /<title>AIOCRV2 \| OT脳卒中評価<\/title>/);

  const assetPath = appHtml.match(/src="(\/aiocrv2\/assets\/index-[^"]+\.js)"/)?.[1];
  assert.ok(assetPath, 'app script path is missing');
  const asset = await fetch(`${origin}${assetPath}`, { headers: { cookie } });
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'no-store');
  assert.match(await asset.text(), /AIOCRV2 Product/);

  const loggedInLoginPage = await fetch(`${origin}/aiocrv2/login.html`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(loggedInLoginPage.status, 303);
  assert.equal(loggedInLoginPage.headers.get('location'), '/aiocrv2/');

  const logout = await fetch(`${origin}/aiocrv2/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/aiocrv2/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('AIOCRV2 locks repeated failed login attempts', async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(`${origin}/aiocrv2/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.52' },
      body: new URLSearchParams({ username, password: `wrong-${attempt}` }),
      redirect: 'manual',
    });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/aiocrv2/login.html?error=invalid');
  }
  const locked = await fetch(`${origin}/aiocrv2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '198.51.100.52' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(locked.status, 303);
  assert.equal(locked.headers.get('location'), '/aiocrv2/login.html?error=locked');
});
