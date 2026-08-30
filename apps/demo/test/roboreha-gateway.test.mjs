import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const routePath = '/roboreha-preview-0123456789abcdef';
const username = 'preview-user';
const password = 'preview-password';
const sessionSecret = 'session-secret-for-tests-0123456789abcdef';
const proxySecret = 'proxy-secret-for-tests-0123456789abcdef';
let upstream;
let gateway;
let gatewayOrigin;
let receivedProxySecret = '';

before(async () => {
  upstream = createServer((request, response) => {
    receivedProxySecret = request.headers['x-roboreha-proxy-secret'] ?? '';
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

test('private path is not linked from the homepage or sitemap', async () => {
  const [homepage, sitemap] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
  ]);
  assert.equal(homepage.includes('roboreha-preview'), false);
  assert.equal(sitemap.includes('roboreha-preview'), false);
});

test('unauthenticated requests receive only the login screen', async () => {
  const response = await fetch(`${gatewayOrigin}${routePath}`);
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
