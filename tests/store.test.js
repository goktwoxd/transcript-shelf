import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory stand-in for chrome.storage.local, keyed like the real API.
const memory = {};

globalThis.chrome ??= {};
globalThis.chrome.storage = {
  local: {
    async get(key) {
      return key in memory ? { [key]: structuredClone(memory[key]) } : {};
    },
    async set(values) {
      Object.assign(memory, structuredClone(values));
    },
  },
};

const { MAX_ITEMS } = await import('../src/common/const.js');
const { addItem, clearItems, listItems, removeItem } = await import('../src/store/collection.js');
const { loadSettings, saveSettings } = await import('../src/store/settings.js');

// 11 characters, like a real id, and unique per call.
const id = (n) => String(n).padStart(11, '0');

function video(n) {
  return {
    videoId: id(n),
    title: `Title ${n}`,
    author: 'Chan',
    published: '2026-01-01',
    lengthSeconds: 60,
    url: `https://www.youtube.com/watch?v=${id(n)}`,
    segments: [{ t: 0, text: 'hi' }],
  };
}

test('adds items in order and keeps only the useful fields', async () => {
  await clearItems();
  await addItem(video(1));
  await addItem(video(2));

  const items = await listItems();

  assert.deepEqual(items.map((item) => item.videoId), [id(1), id(2)]);
  assert.deepEqual(items[0].segments, [{ t: 0, text: 'hi' }]);
  assert.ok(items[0].savedAt > 0);
  assert.equal(items[0].tracks, undefined);
});

test('re-adding a video moves it instead of duplicating it', async () => {
  await clearItems();
  await addItem(video(1));
  await addItem(video(2));
  await addItem(video(1));

  assert.deepEqual((await listItems()).map((item) => item.videoId), [id(2), id(1)]);
});

test('the shelf keeps the newest MAX_ITEMS', async () => {
  await clearItems();

  for (let n = 1; n <= MAX_ITEMS + 2; n += 1) {
    await addItem(video(n));
  }

  const items = await listItems();

  assert.equal(items.length, MAX_ITEMS);
  assert.equal(items[0].videoId, id(3));
  assert.equal(items.at(-1).videoId, id(MAX_ITEMS + 2));
});

test('removes one item, clears all', async () => {
  await clearItems();
  await addItem(video(1));
  await addItem(video(2));

  assert.deepEqual((await removeItem(id(1))).map((item) => item.videoId), [id(2)]);
  assert.deepEqual(await clearItems(), []);
});

test('a preset wins over stale checkboxes on load', async () => {
  await saveSettings({ preset: 'plain', md: true, timestamps: true, theme: 'dark' });

  const settings = await loadSettings();

  assert.equal(settings.md, false);
  assert.equal(settings.timestamps, false);
  assert.equal(settings.theme, 'dark');
});

test('custom keeps the checkboxes exactly as saved', async () => {
  await saveSettings({ preset: 'custom', md: true, timestamps: false, theme: 'light' });

  const settings = await loadSettings();

  assert.equal(settings.preset, 'custom');
  assert.equal(settings.md, true);
  assert.equal(settings.timestamps, false);
  assert.equal(settings.theme, 'light');
});
