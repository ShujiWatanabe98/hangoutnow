import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('四ツ谷ロボケア is packaged as a protected methodmore Product', async () => {
  const [corporate, corporateStyles, app, login, loginScript, sitemap, server] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/corporate.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/yotsuya-robocare/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/yotsuya-robocare/login.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/yotsuya-robocare/login.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  ]);
  const scriptPath = app.match(/src="(\/yotsuya-robocare\/assets\/index-[^"]+\.js)"/)?.[1];
  const stylePath = app.match(/href="(\/yotsuya-robocare\/assets\/index-[^"]+\.css)"/)?.[1];
  assert.ok(scriptPath, 'app script path is missing');
  assert.ok(stylePath, 'app stylesheet path is missing');
  const [appScript, appStyles] = await Promise.all([
    readFile(new URL(`../public${scriptPath}`, import.meta.url), 'utf8'),
    readFile(new URL(`../public${stylePath}`, import.meta.url), 'utf8'),
  ]);

  for (const copy of ['四ツ谷', 'ロボケア', 'ログイン制デモ・限定公開', '面談音声・SOAP記録', 'HAL資料レビュー', '月次レポート作成']) {
    assert.ok(corporate.includes(copy), `Product copy is missing: ${copy}`);
  }
  assert.match(corporate, /href="\/yotsuya-robocare\/"[^>]*>ログインして開く/);
  assert.match(corporate, /<a href="\/yotsuya-robocare\/">四ツ谷ロボケア<\/a>/);
  assert.match(corporateStyles, /\.yotsuya-preview/);
  assert.match(app, /<title>四ツ谷ロボケア 記録支援<\/title>/);
  assert.match(app, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(app, /\/yotsuya-robocare\/assets\/index-[^"']+\.js/);
  assert.match(appScript, /四ツ谷ロボケア/);
  assert.match(appScript, /\/yotsuya-robocare\/logout/);
  assert.match(appStyles, /\.logout-link/);
  assert.doesNotMatch(appStyles, /fonts\.googleapis\.com/);
  assert.match(login, /action="\/yotsuya-robocare\/login"/);
  assert.match(login, /name="username"/);
  assert.match(login, /name="password"/);
  assert.match(login, /デモに表示される人物・記録はすべて架空/);
  assert.match(loginScript, /ユーザー名またはパスワードが違います/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/method-more\.com\/yotsuya-robocare\/<\/loc>/);
  assert.match(server, /const yotsuyaRobocarePath = '\/yotsuya-robocare'/);
  assert.match(server, /const yotsuyaRobocareUsername = [^;]+\|\| 'yotsuyarobo'/);
  assert.ok(!`${corporate}\n${app}\n${login}\n${loginScript}\n${server}`.includes(['robo', '123'].join('')));
});
