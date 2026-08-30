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

  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(physical, /min-h-11 w-full bg-transparent text-lg/);
  assert.match(equipment, /grid-cols-\[44px_1fr_44px\]/);
  assert.match(equipment, /grid grid-cols-2 gap-2/);
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
});
