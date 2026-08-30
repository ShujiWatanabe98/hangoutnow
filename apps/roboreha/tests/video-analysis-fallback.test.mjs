import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI video analysis retries browser-incompatible video after H.264 MP4 normalization", async () => {
  const poseSource = await readFile(
    new URL("../src/lib/pose-analysis.ts", import.meta.url),
    "utf8",
  );
  const routeSource = await readFile(
    new URL("../src/app/api/video-normalize/route.ts", import.meta.url),
    "utf8",
  );
  const customerSource = await readFile(
    new URL("../src/components/customers-manager.tsx", import.meta.url),
    "utf8",
  );
  const physicalSource = await readFile(
    new URL("../src/components/physical-function-manager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(poseSource, /export async function analyzeVideoFileWithFallback/);
  assert.match(poseSource, /\/api\/video-normalize/);
  assert.match(poseSource, /analysis: await analyzeVideoFile\(normalizedFile, onProgress\)/);
  assert.match(routeSource, /normalizeVideoToMp4\(file\)/);
  assert.match(routeSource, /"Content-Type": normalized\.mimeType/);
  assert.match(customerSource, /analyzeVideoFileWithFallback/);
  assert.match(physicalSource, /analyzeVideoFileWithFallback/);
  assert.match(customerSource, /MP4（H\.264）へ変換しています/);
  assert.match(physicalSource, /MP4（H\.264）へ変換しています/);
});
