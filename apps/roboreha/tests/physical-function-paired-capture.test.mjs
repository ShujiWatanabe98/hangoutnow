import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("physical function capture uses the paired HAL before and after workflow", async () => {
  const source = await readFile(
    new URL("../src/components/physical-function-manager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /HAL使用前動画/);
  assert.match(source, /HAL使用後動画/);
  assert.match(source, /AI解析（歩行姿勢を推定）/);
  assert.match(source, /姿勢推定オーバーレイ/);
  assert.match(source, /腰角度 最大/);
  assert.match(source, /膝角度 最大/);
  assert.match(source, /かかと角度 最大/);
  assert.match(source, /加速度 最大/);
  assert.match(source, /歩幅 最大/);
  assert.match(source, /HAL前後動画作成/);
  assert.match(source, /data-testid="physical-hal-comparison-video"/);
  assert.match(source, /AI比較/);
  assert.match(source, /療法士が追加しそうなコメント候補/);
  assert.match(source, /sticky bottom-0[\s\S]*保存して閉じる/);
  assert.match(source, /phase === "before" \? "baseline" : "hal_assisted"/);
  assert.match(source, /uploadPhysicalVideo\(sessionId, "analysis", comparisonFile\)/);
  assert.doesNotMatch(source, /開発用 patient\/helper 歩行動画を使う/);
});

test("physical function detail exposes before, after, and comparison videos", async () => {
  const source = await readFile(
    new URL("../src/components/physical-function-manager.tsx", import.meta.url),
    "utf8",
  );
  const detail = source.slice(source.indexOf("function SessionDetail("));
  assert.match(detail, /\["baseline", "HAL使用前動画"\]/);
  assert.match(detail, /\["hal_assisted", "HAL使用後動画"\]/);
  assert.match(detail, /\["analysis", "HAL前後比較動画"\]/);
});
