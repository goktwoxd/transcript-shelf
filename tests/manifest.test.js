import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

// Keep the broad permission from creeping back in: Chrome's details page shows
// activeTab-only extensions as if they could read every site.
test('site access is limited to YouTube', () => {
  assert.deepEqual(manifest.host_permissions, ['https://*.youtube.com/*']);
  assert.equal(manifest.permissions.includes('activeTab'), false);
  assert.equal(manifest.permissions.includes('scripting'), true);
});

test('the manifest and package versions move together', () => {
  assert.equal(manifest.version, pkg.version);
});
