import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDirectory = new URL('../public/', import.meta.url);

function assetVersion(html, asset) {
  return html.match(new RegExp(`${asset.replace('.', '\\.')}\\?v=([0-9-]+)`))?.[1];
}

test('demo and production load the same application assets', async () => {
  const [demo, production] = await Promise.all([
    readFile(new URL('demo.html', publicDirectory), 'utf8'),
    readFile(new URL('app.html', publicDirectory), 'utf8'),
  ]);

  for (const asset of ['styles.css', 'portraits.css', 'auth.css', 'requests.css', 'app.js']) {
    assert.equal(assetVersion(production, asset), assetVersion(demo, asset), `${asset} must stay in sync`);
  }
  assert.match(production, /production:true,demoAccounts:null/);
});

test('production uses the shared Hangout, talk, notification, and profile flows', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');

  for (const contract of [
    'showJoinRequestDialogReliable',
    'openHangoutFlowChat',
    'showEditHangoutFixed',
    'notificationScreen',
    'showProfileEditor',
    'showHangoutRail',
    "h.hostUserId===session.user.id",
  ]) assert.ok(application.includes(contract), `missing shared production contract: ${contract}`);
});
