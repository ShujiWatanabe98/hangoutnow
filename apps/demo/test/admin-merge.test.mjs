import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Hangout Now admin is exported and served by the combined platform', async () => {
  const [renderConfig, dockerfile, combinedServer, nextConfig, server, adminPage] = await Promise.all([
    readFile(new URL('../../../render.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../../api/Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../../api/scripts/start-render-combined.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../admin/next.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../admin/app/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(renderConfig, /^\s+name: hangoutnow-admin$/m);
  assert.match(renderConfig, /name: hangoutnow-api[\s\S]*runtime: docker[\s\S]*dockerfilePath: \.\/apps\/api\/Dockerfile/);
  assert.match(dockerfile, /COPY apps\/demo apps\/demo/);
  assert.match(dockerfile, /npm run build -w @hangout-now\/admin/);
  assert.match(combinedServer, /startChild\("MethodMore Website"/);
  assert.match(nextConfig, /output: 'export'/);
  assert.match(nextConfig, /basePath: '\/hangoutnow-admin'/);
  assert.match(server, /const hangoutNowAdminRoot = join\(import\.meta\.dirname, '\.\.\/admin\/out'\)/);
  assert.match(server, /const hangoutNowApiPath = '\/hangoutnow-api'/);
  assert.match(adminPage, /const API=process\.env\.NEXT_PUBLIC_API_URL\?\?'\/hangoutnow-api'/);
});
