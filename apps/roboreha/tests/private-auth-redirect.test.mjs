import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(import.meta.dirname, "..");

test("private authentication redirects stay on the public origin", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "roboreha-auth-redirect-"));

  try {
    const typescript = await import("typescript");
    const helperSource = await readFile(
      path.join(appRoot, "src/lib/same-origin-redirect.ts"),
      "utf8",
    );
    const compiled = typescript.transpileModule(helperSource, {
      compilerOptions: {
        module: typescript.ModuleKind.ESNext,
        target: typescript.ScriptTarget.ES2022,
      },
    }).outputText;
    const compiledPath = path.join(temporaryRoot, "same-origin-redirect.mjs");
    await writeFile(compiledPath, compiled, "utf8");
    const { sameOriginRedirect } = await import(pathToFileURL(compiledPath).href);

    assert.deepEqual(sameOriginRedirect("/roboreha-app/"), {
      status: 303,
      headers: { location: "/roboreha-app/" },
    });
    assert.throws(() => sameOriginRedirect("https://localhost:3101/roboreha-app/"));
    assert.throws(() => sameOriginRedirect("//localhost:3101/roboreha-app/"));
    assert.throws(() => sameOriginRedirect("/roboreha-app/\r\nlocation: https://example.com"));

    const routeSource = await readFile(
      path.join(appRoot, "src/app/api/private-auth/route.ts"),
      "utf8",
    );
    assert.match(routeSource, /sameOriginRedirect\(`\$\{ROBOREHA_BASE_PATH\}\/`\)/);
    assert.match(routeSource, /sameOriginRedirect\(`\$\{ROBOREHA_BASE_PATH\}\/login\?error=1`\)/);
    assert.match(routeSource, /sameOriginRedirect\(`\$\{ROBOREHA_BASE_PATH\}\/login\?locked=1`\)/);
    assert.doesNotMatch(routeSource, /new URL\([^)]*request\.url/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
