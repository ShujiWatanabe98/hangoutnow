import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CoachGo shared reports use the API proxy and have a protected management dashboard', async () => {
  const [server, runtime, adminHtml, adminScript, migration] = await Promise.all([
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/dist/mobile/demo.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-admin/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-admin/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../../api/prisma/migrations/20260901162000_add_coachgo_shared_hazard_reports/migration.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(server, /userReportApiUrl: '\/api\/coachgo\/reports'/);
  assert.match(server, /'x-coachgo-owner-token'/);
  assert.match(server, /requestedPath === '\/coachgo-admin'/);
  assert.match(runtime, /loadSharedUserReports\(apiUrl, currentReportOwnerId\)/);
  assert.match(runtime, /createSharedUserReport\(apiUrl, currentReportOwnerId, category, coordinates\)/);
  assert.match(runtime, /deleteSharedUserReport\(apiUrl, currentReportOwnerId, id\)/);
  assert.match(adminHtml, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(adminHtml, /管理トークンはブラウザへ保存しません/);
  assert.match(adminScript, /'x-admin-token':tokenInput\.value/);
  assert.match(adminScript, /updateReport\(report,'HIDDEN'/);
  assert.match(adminScript, /updateReport\(report,'DELETED'/);
  assert.match(migration, /owner_token_hash/);
  assert.doesNotMatch(migration, /owner_token"/);
});
