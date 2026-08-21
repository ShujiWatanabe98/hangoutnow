import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const publicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('Shinjuku first-member campaign is honest, safe, indexable, and measurable', async () => {
  const [homepage, recruitment, cafeGuide, sitemap, share] = await Promise.all([
    publicFile('index.html'),
    publicFile('shinjuku-first-members.html'),
    publicFile('shinjuku-cafe-friends.html'),
    publicFile('sitemap.xml'),
    publicFile('share.js'),
  ]);

  assert.match(homepage, /href="\/shinjuku-first-members\.html"/);
  assert.match(homepage, /href="\/shinjuku-cafe-friends\.html" data-guide-name="shinjuku-cafe-friends"/);
  assert.match(recruitment, /<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">/);
  assert.match(recruitment, /"@type": "WebPage"/);
  assert.match(recruitment, /"@type": "BreadcrumbList"/);
  assert.match(recruitment, /"@type": "FAQPage"/);
  assert.match(recruitment, /18歳以上/);
  assert.equal((recruitment.match(/href="\/app\.html\?mode=register"/g)??[]).length, 2);
  assert.match(recruitment, /正確な集合場所.*承認/);
  assert.match(recruitment, /デモ画面の人物・募集は検証用の架空データ/);
  for (const answer of ['一人で参加申請することを前提', 'アカウント登録は無料', '条件が合わない募集へ無理に申請する必要はありません', '本人の許可なく連絡先を運営へ渡したりしない']) {
    assert.ok(recruitment.includes(answer), `recruitment FAQ is missing: ${answer}`);
  }
  assert.match(recruitment, /data-cta-name="first-members-open-app"/);
  assert.doesNotMatch(recruitment, /残り[0-9０-９]+名|現在[0-9０-９]+名/);
  for (const contract of ['30〜60分、2〜4人', '予算と精算方法を書く', 'アレルギー', '営業、宗教、投資、恋愛目的への変更']) {
    assert.ok(cafeGuide.includes(contract), `cafe guide is missing: ${contract}`);
  }
  assert.match(cafeGuide, /<link rel="canonical" href="https:\/\/method-more\.com\/shinjuku-cafe-friends\.html">/);
  assert.match(cafeGuide, /"@type": "Article"/);
  assert.match(cafeGuide, /"@type": "BreadcrumbList"/);
  assert.match(cafeGuide, /utm_source=method-more&amp;utm_medium=organic-search&amp;utm_campaign=shinjuku-launch-202609&amp;utm_content=guide-cafe-search/);
  assert.match(sitemap, /https:\/\/method-more\.com\/shinjuku-cafe-friends\.html/);
  assert.match(sitemap, /https:\/\/method-more\.com\/shinjuku-first-members\.html/);
  assert.match(share, /shinjuku-cafe-friends/);
  assert.match(share, /shinjuku-first-members/);
});

test('campaign kit uses privacy-safe UTM values', async () => {
  const kit = await readFile(new URL('../../../docs/SHINJUKU_FIRST_FIVE_LAUNCH_KIT_JA.md', import.meta.url), 'utf8');
  assert.match(kit, /utm_campaign=shinjuku-launch-202609/);
  assert.match(kit, /氏名、電話番号、私信は公開しない/);
  assert.match(kit, /apps\/demo\/public\/assets\/shinjuku-first-five-qr\.png/);
});

test('campaign attribution requires consent and keeps only allow-listed UTM fields', async () => {
  const [script, app, server, privacy] = await Promise.all([
    publicFile('attribution.js'), publicFile('app.js'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'), publicFile('privacy.html'),
  ]);
  const local = new Map(); const session = new Map(); const listeners = new Map();
  const storage = (map) => ({ getItem:(key)=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:(key)=>map.delete(key) });
  const context = {
    localStorage:storage(local),sessionStorage:storage(session),
    location:{search:'?utm_source=x&utm_medium=organic-social&utm_campaign=shinjuku-launch-202609&utm_content=post-concept-01&email=private%40example.com'},
    URLSearchParams, addEventListener:(name,listener)=>listeners.set(name,listener),
  };
  runInNewContext(script, context);
  assert.equal(session.has('hangout-now-acquisition-v1'), false);
  local.set('hangout-now-analytics-consent', 'granted');
  listeners.get('hangout:analytics-consent')({detail:'granted'});
  assert.deepEqual(JSON.parse(session.get('hangout-now-acquisition-v1')), {source:'x',medium:'organic-social',campaign:'shinjuku-launch-202609',content:'post-concept-01'});
  context.location.search='?utm_source=instagram&utm_medium=organic-social&utm_campaign=shinjuku-launch-202609&utm_content=second-touch';
  listeners.get('hangout:analytics-consent')({detail:'granted'});
  assert.equal(JSON.parse(session.get('hangout-now-acquisition-v1')).source, 'x');
  listeners.get('hangout:analytics-consent')({detail:'denied'});
  assert.equal(session.has('hangout-now-acquisition-v1'), false);
  context.location.search='?utm_source=method-more&utm_medium=organic-search&utm_campaign=shinjuku-launch-202609&utm_content=guide-cafe-search';
  local.set('hangout-now-analytics-consent', 'granted');
  listeners.get('hangout:analytics-consent')({detail:'granted'});
  assert.deepEqual(JSON.parse(session.get('hangout-now-acquisition-v1')), {source:'method-more',medium:'organic-search',campaign:'shinjuku-launch-202609',content:'guide-cafe-search'});
  assert.match(app, /body\.acquisition=acquisition/);
  assert.match(app, /searchParams\.get\('mode'\)===\'register\'\?\'register\':\'login\'/);
  assert.match(app, /return valid\?\{consent:true,source:value\.source,medium:value\.medium,campaign:value\.campaign,content:value\.content\}:undefined/);
  assert.match(app, /clearPendingAcquisition/);
  assert.match(server, /attribution\.js\?v=20260821-2/);
  assert.match(privacy, /氏名、メールアドレス、電話番号、正確な位置、トーク内容は含めず/);
  assert.doesNotMatch(script, /document\.referrer|parameters\.get\(['"](?:email|phone|latitude|longitude)/);
});
