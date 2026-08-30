import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("questionnaire builder persists a one-column up and down order", async () => {
  const [manager, route] = await Promise.all([
    readSource("src/components/intake-manager.tsx"),
    readSource("src/app/api/intake-template/route.ts"),
  ]);

  assert.match(manager, /async function moveItem\(/);
  assert.match(manager, /を上へ移動/);
  assert.match(manager, /を下へ移動/);
  assert.doesNotMatch(manager, /xl:grid-cols-2/);
  assert.match(route, /itemIds/);
  assert.match(route, /SET sort_order=\$1/);
  assert.match(route, /transaction\(async \(client\)/);
});

test("customer intake follows template order and exposes numbered progress", async () => {
  const app = await readSource("src/components/intake-app.tsx");

  assert.match(app, /orderedQuestions\.map\(\(item, index\)/);
  assert.match(app, /aria-label="問診の進捗"/);
  assert.match(app, /問診中/);
  assert.match(app, /回答済み \{answeredQuestionCount\}問/);
  assert.match(app, /あと \{remainingQuestionCount\}問/);
  assert.match(app, /intake-question-\$\{item\.id\}/);
});
