import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const publicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('Shinjuku first-member campaign is honest, safe, and measurable', async () => {
  const [homepage, recruitment, share] = await Promise.all([
    publicFile('index.html'),
    publicFile('shinjuku-first-members.html'),
    publicFile('share.js'),
  ]);

  assert.match(homepage, /href="\/shinjuku-first-members\.html"/);
  assert.match(recruitment, /<meta name="robots" content="noindex,follow,noarchive">/);
  assert.match(recruitment, /18歳以上/);
  assert.equal((recruitment.match(/href="\/app\.html\?mode=register"/g)??[]).length, 2);
  assert.match(recruitment, /正確な集合場所.*承認/);
  assert.match(recruitment, /デモ画面の人物・募集は検証用の架空データ/);
  assert.match(recruitment, /data-cta-name="first-members-open-app"/);
  assert.doesNotMatch(recruitment, /残り[0-9０-９]+名|現在[0-9０-９]+名/);
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
  assert.match(app, /body\.acquisition=acquisition/);
  assert.match(app, /searchParams\.get\('mode'\)===\'register\'\?\'register\':\'login\'/);
  assert.match(app, /return valid\?\{consent:true,source:value\.source,medium:value\.medium,campaign:value\.campaign,content:value\.content\}:undefined/);
  assert.match(app, /clearPendingAcquisition/);
  assert.match(server, /attribution\.js\?v=20260820-1/);
  assert.match(privacy, /氏名、メールアドレス、電話番号、正確な位置、トーク内容は含めず/);
  assert.doesNotMatch(script, /document\.referrer|parameters\.get\(['"](?:email|phone|latitude|longitude)/);
});
