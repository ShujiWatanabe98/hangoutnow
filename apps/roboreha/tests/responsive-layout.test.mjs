import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tablet and smartphone controls keep touch-sized targets", async () => {
  const css = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  const physical = await readFile(
    new URL("../src/components/physical-function-manager.tsx", import.meta.url),
    "utf8",
  );
  const equipment = await readFile(
    new URL("../src/components/equipment-manager.tsx", import.meta.url),
    "utf8",
  );
  const facility = await readFile(
    new URL("../src/components/facility-app.tsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(physical, /min-h-11 w-full bg-transparent text-lg/);
  assert.match(equipment, /grid-cols-\[44px_1fr_44px\]/);
  assert.match(equipment, /grid grid-cols-2 gap-2/);
  assert.match(css, /@media \(min-width: 1025px\)/);
  assert.match(css, /\.facility-ipad-shell[\s\S]*width: 1024px;[\s\S]*height: 768px;/);
  assert.match(facility, /facility-ipad-stage/);
  assert.match(facility, /md:grid-cols-\[80px_minmax\(0,1fr\)\]/);
  assert.match(facility, /sticky top-0/);
  assert.match(facility, /className="min-w-0 md:col-start-2"/);
  assert.doesNotMatch(facility, /label: "施術記録"/);
  assert.doesNotMatch(facility, /ClinicalManager/);
});

test("long clinical history is paginated and schedule explains horizontal touch navigation", async () => {
  const clinical = await readFile(
    new URL("../src/components/clinical-manager.tsx", import.meta.url),
    "utf8",
  );
  const schedule = await readFile(
    new URL("../src/components/schedule-calendar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(clinical, /const HISTORY_PAGE_SIZE = 8/);
  assert.match(clinical, /aria-label="施術履歴ページ"/);
  assert.match(clinical, /visibleHistoryItems/);
  assert.match(schedule, /表は左右にスワイプして/);
  assert.match(schedule, /aria-label="予約スケジュール表・左右にスクロールできます"/);
  assert.match(schedule, /空き枠をタップで登録、予定をタップで詳細/);
  assert.match(schedule, /title="タップで詳細・長押ししてドラッグで移動"/);
  assert.doesNotMatch(schedule, /onDoubleClick/);
});

test("private login has a responsive branded workspace layout", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/login/login.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ケアの流れを、ひとつにつなぐ。/);
  assert.match(page, /表示される情報はすべて架空のデモデータです。/);
  assert.match(page, /autoComplete="username"/);
  assert.match(page, /autoComplete="current-password"/);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.16fr\) minmax\(370px, 0\.84fr\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
});
