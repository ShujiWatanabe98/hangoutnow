import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appRoot, "../..");

async function source(relativePath) {
  return readFile(path.resolve(appRoot, relativePath), "utf8");
}

test("both clinical video APIs use the shared storage abstraction", async () => {
  const files = await Promise.all([
    source("src/app/api/videos/route.ts"),
    source("src/app/api/videos/[id]/route.ts"),
    source("src/app/api/physical-function/videos/route.ts"),
    source("src/app/api/physical-function/videos/[id]/route.ts"),
  ]);

  for (const file of files) {
    assert.match(file, /@\/lib\/video-storage/);
    assert.doesNotMatch(file, /path\.resolve\(process\.cwd\(\),\s*"storage"/);
  }
});

test("storage supports private S3 objects, local compatibility and range reads", async () => {
  const storage = await source("src/lib/video-storage.ts");
  assert.match(storage, /PutObjectCommand/);
  assert.match(storage, /GetObjectCommand/);
  assert.match(storage, /DeleteObjectCommand/);
  assert.match(storage, /HeadObjectCommand/);
  assert.match(storage, /ROBOREHA_VIDEO_STORAGE_MODE/);
  assert.match(storage, /NODE_ENV === "production" \? "s3" : "local"/);
  assert.match(storage, /ContentType: contentType/);
  assert.match(storage, /status: 206 as const/);
});

test("health endpoint exposes durability and Render opts into compatibility mode", async () => {
  const health = await source("src/app/api/healthz/route.ts");
  const render = await readFile(path.resolve(repositoryRoot, "render.yaml"), "utf8");
  assert.match(health, /videoStorageStatus/);
  assert.match(health, /videoStorage: storage/);
  assert.match(render, /key: ROBOREHA_VIDEO_STORAGE_MODE\s+value: local/);
});

test("local compatibility storage saves, serves byte ranges and deletes video", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roboreha-video-storage-"));
  const temporaryModuleRoot = await mkdtemp(path.join(appRoot, ".video-storage-test-"));
  const previousMode = process.env.ROBOREHA_VIDEO_STORAGE_MODE;
  const previousRoot = process.env.ROBOREHA_LOCAL_VIDEO_ROOT;
  process.env.ROBOREHA_VIDEO_STORAGE_MODE = "local";
  process.env.ROBOREHA_LOCAL_VIDEO_ROOT = temporaryRoot;

  try {
    const typescript = await import("typescript");
    const storageSource = await source("src/lib/video-storage.ts");
    const compiled = typescript.transpileModule(storageSource, {
      compilerOptions: {
        module: typescript.ModuleKind.ESNext,
        target: typescript.ScriptTarget.ES2022,
      },
    }).outputText;
    const compiledPath = path.join(temporaryModuleRoot, "video-storage.mjs");
    await writeFile(compiledPath, compiled, "utf8");
    const storageUrl = pathToFileURL(compiledPath);
    const storage = await import(storageUrl.href);
    const content = Buffer.from("0123456789", "utf8");

    await storage.storeVideo("videos", "sample.mp4", content, "video/mp4");
    const full = await storage.readVideo("videos", "sample.mp4", null);
    assert.equal(full.status, 200);
    assert.equal(full.content.toString("utf8"), "0123456789");

    const partial = await storage.readVideo("videos", "sample.mp4", "bytes=2-5");
    assert.equal(partial.status, 206);
    assert.equal(partial.content.toString("utf8"), "2345");
    assert.equal(partial.contentRange, "bytes 2-5/10");

    await storage.deleteVideo("videos", "sample.mp4");
    await assert.rejects(
      storage.readVideo("videos", "sample.mp4", null),
      (error) => error instanceof storage.VideoNotFoundError,
    );
  } finally {
    if (previousMode === undefined) delete process.env.ROBOREHA_VIDEO_STORAGE_MODE;
    else process.env.ROBOREHA_VIDEO_STORAGE_MODE = previousMode;
    if (previousRoot === undefined) delete process.env.ROBOREHA_LOCAL_VIDEO_ROOT;
    else process.env.ROBOREHA_LOCAL_VIDEO_ROOT = previousRoot;
    await rm(temporaryRoot, { recursive: true, force: true });
    await rm(temporaryModuleRoot, { recursive: true, force: true });
  }
});
