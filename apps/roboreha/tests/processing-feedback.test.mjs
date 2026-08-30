import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = (name) => readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8");

test("時間のかかる処理は操作を禁止する共通進捗オーバーレイを使う", async () => {
  const loading = await component("loading.tsx");
  assert.match(loading, /data-testid="blocking-progress-overlay"/);
  assert.match(loading, /role="alertdialog"/);
  assert.match(loading, /aria-modal="true"/);
  assert.match(loading, /document\.body\.style\.overflow = "hidden"/);
  assert.match(loading, /animate-spin/);
  assert.match(loading, /進捗 \$\{normalizedProgress\}%/);

  const protectedComponents = [
    "admin-app.tsx",
    "billing-manager.tsx",
    "clinical-manager.tsx",
    "customer-app.tsx",
    "customer-registration-app.tsx",
    "customers-manager.tsx",
    "equipment-manager.tsx",
    "facility-app.tsx",
    "intake-app.tsx",
    "intake-manager.tsx",
    "physical-function-manager.tsx",
    "schedule-calendar.tsx",
    "staff-manager.tsx",
  ];
  for (const name of protectedComponents) {
    assert.match(await component(name), /<BlockingProgressOverlay/, `${name} に処理中オーバーレイがありません`);
  }
});

test("本日の注意事項は本日の利用者一覧より上に表示する", async () => {
  const source = await component("customers-manager.tsx");
  const todaySection = source.indexOf('{mode === "today" ? (');
  const caution = source.indexOf('aria-label="本日の注意事項"', todaySection);
  const customerRows = source.indexOf('<div className="space-y-3">', todaySection);
  assert.ok(todaySection >= 0 && caution > todaySection && customerRows > caution);
  assert.match(source.slice(caution, customerRows), /className="mb-5 rounded-2xl/);
});

test("失敗しても主要な保存処理は必ず操作禁止を解除する", async () => {
  const [clinical, intake] = await Promise.all([
    component("clinical-manager.tsx"),
    component("intake-app.tsx"),
  ]);
  assert.match(clinical, /finally \{ setSaving\(false\); \}/);
  assert.match(intake, /finally \{\s*setSubmitting\(false\);\s*\}/);
});
