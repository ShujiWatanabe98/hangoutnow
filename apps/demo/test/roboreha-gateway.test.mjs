import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const routePath = '/roboreha-app';
const retiredRoutePath = '/roboreha-preview-320b600f541ac09e';
const username = 'preview-user';
const password = 'preview-password';
const sessionSecret = 'session-secret-for-tests-0123456789abcdef';
const proxySecret = 'proxy-secret-for-tests-0123456789abcdef';
let upstream;
let gateway;
let gatewayOrigin;
let receivedProxySecret = '';
let transientFailuresRemaining = 0;
let transientRequestCount = 0;
let healthFailuresRemaining = 0;

before(async () => {
  upstream = createServer((request, response) => {
    receivedProxySecret = request.headers['x-roboreha-proxy-secret'] ?? '';
    if (request.url?.endsWith('/api/healthz')) {
      if (healthFailuresRemaining > 0) {
        healthFailuresRemaining -= 1;
        response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
        response.end('{"status":"starting"}');
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end('{"status":"ok"}');
      return;
    }
    if (request.url?.endsWith('/unavailable')) {
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Starting service');
      return;
    }
    if (request.url?.endsWith('/cold-start')) {
      transientRequestCount += 1;
      if (transientFailuresRemaining > 0) {
        transientFailuresRemaining -= 1;
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Starting service');
        return;
      }
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Protected RoboReha</title>');
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const upstreamPort = upstream.address().port;

  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const gatewayPort = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  gatewayOrigin = `http://127.0.0.1:${gatewayPort}`;

  gateway = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      DEMO_PORT: String(gatewayPort),
      ROBOREHA_ROUTE_PATH: routePath,
      ROBOREHA_UPSTREAM_ORIGIN: `http://127.0.0.1:${upstreamPort}`,
      ROBOREHA_USERNAME: username,
      ROBOREHA_PASSWORD: password,
      ROBOREHA_SESSION_SECRET: sessionSecret,
      ROBOREHA_PROXY_SECRET: proxySecret,
      ROBOREHA_UPSTREAM_RETRY_DELAYS_MS: '5,10,15',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${gatewayOrigin}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Gateway did not start');
});

after(async () => {
  if (gateway && !gateway.killed) gateway.kill();
  if (upstream) await new Promise((resolve) => upstream.close(resolve));
});

test('homepage links to the canonical application while the sitemap stays public-only', async () => {
  const [homepage, sitemap] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
  ]);
  assert.match(homepage, /href="\/roboreha-app"[^>]*>Webアプリを開く/);
  assert.doesNotMatch(homepage, /href="\/roboreha-preview-/);
  assert.equal(sitemap.includes('roboreha-preview'), false);
});

test('canonical application entry receives the login screen', async () => {
  const response = await fetch(`${gatewayOrigin}${routePath}`, { redirect: 'manual' });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /ユーザー名とパスワード/);
  assert.equal(response.headers.has('location'), false);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

test('former application URL is removed without redirecting', async () => {
  for (const path of [retiredRoutePath, `${retiredRoutePath}/login`]) {
    const response = await fetch(`${gatewayOrigin}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 410);
    assert.equal(response.headers.has('location'), false);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  }
});

test('unauthenticated login path receives only the login screen', async () => {
  const response = await fetch(`${gatewayOrigin}${routePath}/login`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /ユーザー名とパスワード/);
  assert.doesNotMatch(html, /Protected RoboReha/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

test('wrong credentials are rejected without a session cookie', async () => {
  const response = await fetch(`${gatewayOrigin}${routePath}/_auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong' }),
    redirect: 'manual',
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.has('set-cookie'), false);
});

test('valid credentials create an HttpOnly session and proxy with the shared secret', async () => {
  const login = await fetch(`${gatewayOrigin}${routePath}/_auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, new RegExp(`Path=${routePath}`));

  const protectedPage = await fetch(`${gatewayOrigin}${routePath}/`, {
    headers: { cookie: cookie.split(';')[0] },
  });
  assert.equal(protectedPage.status, 200);
  assert.match(await protectedPage.text(), /Protected RoboReha/);
  assert.equal(receivedProxySecret, proxySecret);
  assert.equal(protectedPage.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(
    protectedPage.headers.get('content-security-policy') ?? '',
    /media-src 'self' blob:/,
  );
});

test('safe requests retry transient upstream cold-start errors', async () => {
  const login = await fetch(`${gatewayOrigin}${routePath}/_auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);

  transientFailuresRemaining = 2;
  transientRequestCount = 0;
  const response = await fetch(`${gatewayOrigin}${routePath}/cold-start`, {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Protected RoboReha/);
  assert.equal(transientRequestCount, 3);
});

test('HTML navigation receives a recovery screen while the upstream starts', async () => {
  const login = await fetch(`${gatewayOrigin}${routePath}/_auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);

  const response = await fetch(`${gatewayOrigin}${routePath}/unavailable`, {
    headers: { accept: 'text/html', cookie },
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-roboreha-gateway-state'), 'waking');
  assert.match(html, /RoboRehaを準備しています/);
  assert.match(html, new RegExp(`${routePath}/_gateway/readiness`));
  assert.match(html, /location\.reload\(\)/);
  assert.doesNotMatch(html, /Protected RoboReha/);
});

test('readiness endpoint stays minimal and reports the upstream state', async () => {
  healthFailuresRemaining = 1;
  const starting = await fetch(`${gatewayOrigin}${routePath}/_gateway/readiness`);
  assert.equal(starting.status, 503);
  assert.deepEqual(await starting.json(), { ready: false });

  const ready = await fetch(`${gatewayOrigin}${routePath}/_gateway/readiness`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { ready: true });
  assert.equal(receivedProxySecret, proxySecret);
});
