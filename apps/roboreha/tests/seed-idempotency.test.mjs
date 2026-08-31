import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("today attendance seed is safe to run after a date change", async () => {
  const seed = await readFile(new URL("../db/seed.sql", import.meta.url), "utf8");
  const block = seed.match(
    /INSERT INTO attendance_records \(staff_id, store_id, work_date,[\s\S]*?ON CONFLICT \(staff_id, work_date\)[\s\S]*?;/,
  )?.[0];

  assert.ok(block, "today attendance must upsert by the staff and work-date key");
  assert.doesNotMatch(block, /ON CONFLICT \(id\)/);
  assert.doesNotMatch(block, /c0000000-0000-0000-0000-00000000000[1-4]/);
});

test("production start updates schema but bootstraps demo rows only for an empty database", async () => {
  const [start, bootstrap] = await Promise.all([
    readFile(new URL("../scripts/start.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/full-test-data.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(start, /"--if-empty"/);
  assert.match(bootstrap, /pg_advisory_lock/);
  assert.match(bootstrap, /SELECT EXISTS \(SELECT 1 FROM stores/);
  assert.match(bootstrap, /seed refresh was skipped/);
});
