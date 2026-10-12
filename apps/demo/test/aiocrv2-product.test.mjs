import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AIOCRV2 is packaged as a protected methodmore Product', async () => {
  const [corporate, corporateStyles, app, login, loginScript, sitemap, server] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/corporate.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/aiocrv2/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/aiocrv2/login.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/aiocrv2/login.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  ]);
  const scriptPath = app.match(/src="(\/aiocrv2\/assets\/index-[^"]+\.js)"/)?.[1];
  const stylePath = app.match(/href="(\/aiocrv2\/assets\/index-[^"]+\.css)"/)?.[1];
  assert.ok(scriptPath, 'app script path is missing');
  assert.ok(stylePath, 'app stylesheet path is missing');
  const [appScript, appStyles] = await Promise.all([
    readFile(new URL(`../public${scriptPath}`, import.meta.url), 'utf8'),
    readFile(new URL(`../public${stylePath}`, import.meta.url), 'utf8'),
  ]);

  for (const copy of ['AIOCRV2', 'ログイン制デモ・限定公開', 'Excel原本の読取', 'FMA・MEP評価入力', '退院時サマリ生成']) {
    assert.ok(corporate.includes(copy), `Product copy is missing: ${copy}`);
  }
  assert.match(corporate, /href="\/aiocrv2\/"[^>]*>ログインして開く/);
  assert.match(corporate, /<a href="\/aiocrv2\/">AIOCRV2<\/a>/);
  assert.match(corporateStyles, /\.aiocrv2-preview/);
  assert.match(app, /<title>AIOCRV2 \| OT脳卒中評価<\/title>/);
  assert.match(app, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(appScript, /AIOCRV2 Product/);
  assert.match(appScript, /\/aiocrv2\/logout/);
  assert.match(appStyles, /\.logout-link/);
  assert.doesNotMatch(appStyles, /fonts\.googleapis\.com/);
  assert.match(login, /action="\/aiocrv2\/login"/);
  assert.match(login, /デモに表示される患者・評価記録はすべて架空/);
  assert.match(loginScript, /ユーザー名またはパスワードが違います/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/method-more\.com\/aiocrv2\/<\/loc>/);
  assert.match(server, /const aiocrv2Path = '\/aiocrv2'/);
  assert.match(server, /const aiocrv2Username = [^;]+\|\| 'AIOCRV2'/);
  assert.ok(!`${corporate}\n${app}\n${login}\n${loginScript}\n${server}`.includes(['OCR', '123'].join('')));
});
