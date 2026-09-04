import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const username = 'dashboard-test-user';
const password = 'dashboard-test-password';
let demo;
let origin;

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
      SMARIHA_DASHBOARD_USERNAME: username,
      SMARIHA_DASHBOARD_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex'),
      SMARIHA_DASHBOARD_SESSION_SECRET: 'smariha-dashboard-test-session-secret-0123456789',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Demo server did not start');
});

after(() => {
  if (demo && !demo.killed) demo.kill();
});

test('Smariha dashboard requires login and grants a protected session', async () => {
  const entry = await fetch(`${origin}/smariha-dashboard/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/smariha-dashboard/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/smariha-dashboard/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /スマリハ管理/);
  assert.match(loginHtml, /name="username"/);
  assert.match(loginHtml, /name="password"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  const protectedAsset = await fetch(`${origin}/smariha-dashboard/app.js`, { redirect: 'manual' });
  assert.equal(protectedAsset.status, 401);
  const protectedTaisho = await fetch(`${origin}/smariha-dashboard/taisho/`, { redirect: 'manual' });
  assert.equal(protectedTaisho.status, 302);
  assert.equal(protectedTaisho.headers.get('location'), '/smariha-dashboard/login.html');

  const rejected = await fetch(`${origin}/smariha-dashboard/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong-password' }),
    redirect: 'manual',
  });
  assert.equal(rejected.status, 303);
  assert.equal(rejected.headers.get('location'), '/smariha-dashboard/login.html?error=invalid');
  assert.equal(rejected.headers.has('set-cookie'), false);

  const accepted = await fetch(`${origin}/smariha-dashboard/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/smariha-dashboard/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const dashboard = await fetch(`${origin}/smariha-dashboard/`, { headers: { cookie } });
  const dashboardHtml = await dashboard.text();
  assert.equal(dashboard.status, 200);
  assert.match(dashboardHtml, /大勝病院向け/);
  assert.match(dashboardHtml, /実績指数およびFIM管理MVP/);
  assert.match(dashboardHtml, /渓仁会病院向け/);
  assert.match(dashboardHtml, /院内連携パス管理MVP/);
  assert.match(dashboardHtml, /href="\/smariha-dashboard\/taisho\/"/);
  assert.match(dashboardHtml, /href="\/smariha-dashboard\/keijinkai\/"/);
  assert.doesNotMatch(dashboardHtml, /analytics\.js|cookie-consent/);

  const taisho = await fetch(`${origin}/smariha-dashboard/taisho/`, { headers: { cookie } });
  const taishoHtml = await taisho.text();
  assert.equal(taisho.status, 200);
  assert.match(taishoHtml, /大勝病院向け・実績指数およびFIM管理MVP/);

  const keijinkai = await fetch(`${origin}/smariha-dashboard/keijinkai/`, { headers: { cookie } });
  const keijinkaiHtml = await keijinkai.text();
  assert.equal(keijinkai.status, 200);
  assert.match(keijinkaiHtml, /渓仁会病院向け・院内連携パス管理MVP/);

  const logout = await fetch(`${origin}/smariha-dashboard/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/smariha-dashboard/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
