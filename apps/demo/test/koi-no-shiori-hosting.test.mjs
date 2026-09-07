import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';

const publicApp = new URL('../public/koi-no-shiori/', import.meta.url);
let demo;
let origin;

before(async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  origin = `http://127.0.0.1:${port}`;
  demo = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DEMO_PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`${origin}/`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('methodmore demo server did not start');
});

after(() => demo?.kill());

test('checked-in fortune build is a subpath-scoped public PWA', async () => {
  const html = await readFile(new URL('index.html', publicApp), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', publicApp), 'utf8'));
  const worker = await readFile(new URL('sw.js', publicApp), 'utf8');
  const privacy = await readFile(new URL('privacy.html', publicApp), 'utf8');
  const terms = await readFile(new URL('terms.html', publicApp), 'utf8');
  const bundleName = html.match(/\/koi-no-shiori\/assets\/(index-[^"']+\.js)/)?.[1];
  assert.ok(bundleName, 'fortune app JavaScript bundle is linked');
  const bundle = await readFile(new URL(`assets/${bundleName}`, publicApp), 'utf8');

  assert.match(html, /<title>恋のしおり｜毎日の恋愛占い<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/method-more\.com\/koi-no-shiori"/);
  assert.match(html, /\/koi-no-shiori\/assets\/index-[^"']+\.js/);
  assert.match(html, /"@type":"SoftwareApplication"/);
  assert.match(html, /"price":"0"/);
  assert.doesNotMatch(html, /localhost|127\.0\.0\.1|analytics\.js|googletagmanager/i);
  assert.equal(manifest.id, '/koi-no-shiori/');
  assert.equal(manifest.start_url, '/koi-no-shiori/');
  assert.equal(manifest.scope, '/koi-no-shiori/');
  assert.ok(manifest.icons.every(({ src }) => src.startsWith('/koi-no-shiori/')));
  assert.match(worker, /assets\/index-[\w-]+\.js/);
  assert.match(worker, /manifest\.webmanifest/);
  assert.match(worker, /privacy\.html/);
  assert.match(worker, /terms\.html/);
  assert.match(worker, /denylist:\[\/\\\/privacy\\\.html\$\/,\/\\\/terms\\\.html\$\/\]/);
  assert.match(privacy, /運営者・お問い合わせ/);
  assert.match(privacy, /自動送信はありません/);
  assert.match(privacy, /info@method-more\.com/);
  assert.match(terms, /占いの位置づけ/);
  assert.match(bundle, /あなたの1枚を、無料で引く/);
  assert.match(bundle, /7日後再訪/);
  assert.match(bundle, /30日後再訪/);
  assert.match(bundle, /https:\/\/method-more\.com\/koi-no-shiori/);
});

test('server exposes the fortune app as indexable while keeping mutable PWA files fresh', async () => {
  const appResponse = await fetch(`${origin}/koi-no-shiori/`);
  const appHtml = await appResponse.text();
  assert.equal(appResponse.status, 200);
  assert.match(appResponse.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(appResponse.headers.get('x-robots-tag'), null);
  assert.match(appResponse.headers.get('content-security-policy') ?? '', /worker-src 'self' blob:/);
  assert.doesNotMatch(appHtml, /analytics\.js|attribution\.js|cookie-consent\.css/);

  const noSlash = await fetch(`${origin}/koi-no-shiori`);
  assert.equal(noSlash.status, 200);

  const manifestResponse = await fetch(`${origin}/koi-no-shiori/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('content-type') ?? '', /^application\/manifest\+json/);
  assert.equal(manifestResponse.headers.get('cache-control'), 'no-cache');

  const workerResponse = await fetch(`${origin}/koi-no-shiori/sw.js`);
  assert.equal(workerResponse.status, 200);
  assert.match(workerResponse.headers.get('content-type') ?? '', /^text\/javascript/);
  assert.equal(workerResponse.headers.get('cache-control'), 'no-cache');

  for (const document of ['privacy.html', 'terms.html']) {
    const legalResponse = await fetch(`${origin}/koi-no-shiori/${document}`);
    assert.equal(legalResponse.status, 200);
    assert.match(legalResponse.headers.get('content-type') ?? '', /^text\/html/);
    assert.equal(legalResponse.headers.get('x-robots-tag'), null);
  }

  const bundlePath = appHtml.match(/src="(\/koi-no-shiori\/assets\/index-[^"']+\.js)"/)?.[1];
  assert.ok(bundlePath, 'fortune app JavaScript bundle is linked');
  const bundleResponse = await fetch(`${origin}${bundlePath}`);
  assert.equal(bundleResponse.status, 200);
  assert.match(bundleResponse.headers.get('cache-control') ?? '', /max-age=86400/);
});
