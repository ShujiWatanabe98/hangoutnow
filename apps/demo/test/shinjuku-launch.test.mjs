import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
