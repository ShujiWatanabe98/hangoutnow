import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("顧客スマホの挨拶には利用者のフルネームを表示する", async () => {
  const source = await readFile(new URL("../src/components/customer-app.tsx", import.meta.url), "utf8");

  assert.match(source, /const customerFullName = dashboard\.customer\.name\.trim\(\);/);
  assert.match(source, /aria-label="利用者氏名（フルネーム）"[^>]*>\{customerFullName\}さん<\/h1>/);
  assert.doesNotMatch(source, /dashboard\.customer\.name\.split\(/);
});
