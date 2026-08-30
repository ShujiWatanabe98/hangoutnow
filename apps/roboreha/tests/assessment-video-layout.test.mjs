import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HAL comparison video stays in the assessment form below its create button", async () => {
  const source = await readFile(
    new URL("../src/components/customers-manager.tsx", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function AssessmentModal(");
  const end = source.indexOf("const overlayJointIndexes", start);
  const modal = source.slice(start, end);
  const createButton = modal.indexOf('"HAL前後動画作成"');
  const resultSection = modal.indexOf('data-testid="hal-comparison-video-result"');
  const resultPlayer = modal.indexOf('data-testid="hal-comparison-video-player"');
  const aiComparison = modal.indexOf("poseComparison && beforePoseMetrics");

  assert.ok(start >= 0 && end > start, "assessment modal source should exist");
  assert.ok(createButton >= 0, "create button should exist");
  assert.ok(resultSection > createButton, "created result should be below the button");
  assert.ok(resultPlayer > resultSection, "created video player should be inside the result");
  assert.ok(aiComparison > resultPlayer, "created video should remain above AI comparison");
  assert.equal(
    modal.includes("{result ? ("),
    false,
    "creation must not replace the assessment form with another screen",
  );
  assert.equal(
    modal.includes("AI所見・申し送り・サマリーを下の記録へ追加"),
    false,
    "manual AI comparison append button should not be rendered",
  );
  assert.match(
    modal,
    /sticky bottom-0[\s\S]*保存して閉じる/,
    "save and close should always stay in the sticky footer",
  );
  assert.doesNotMatch(modal, />\s*所見を保存\s*</);
  assert.match(modal, /async function saveAllAndClose\(\)/);
  assert.match(modal, /if \(beforeFile\)[\s\S]*if \(afterFile\)/);
  assert.match(modal, /await onSaved\(\);\s*onClose\(\);/);
});
