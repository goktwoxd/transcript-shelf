import test from 'node:test';
import assert from 'node:assert/strict';

// The popup's only browser dependency in this path is chrome.scripting.
let probe = null;
let panel = null;
let panelReason = 'timeout';
let panelError = null;
let calls = [];

globalThis.chrome ??= {};
globalThis.chrome.scripting = {
  async executeScript({ func, world, args }) {
    calls.push({ name: func.name, world, args });

    if (func.name === 'pageProbe') {
      return [{ result: probe }];
    }

    if (panelError) {
      throw panelError;
    }

    const report = { reason: panelReason, rows: 0, panel: 'absent', pageId: null, expected: null, length: 0 };

    return [{ result: panel ? { rows: panel, report: null } : { rows: null, report } }];
  },
};

const { loadVideo, peekVideo } = await import('../src/youtube/index.js');

// The failure paths log a diagnostic report; keep the test output clean.
console.warn = () => {};

const PROBE = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Title',
  author: 'Chan',
  lengthSeconds: '212',
  published: '2009-10-25',
  pageTitle: 'Title - YouTube',
};

test('takes metadata from the page probe and text from the panel', async () => {
  probe = PROBE;
  panel = [
    { t: 0, text: '  hello  ' },
    { t: 5, text: '   ' },
  ];
  calls = [];

  const video = await loadVideo('dQw4w9WgXcQ', 7);

  assert.equal(video.title, 'Title');
  assert.equal(video.lengthSeconds, 212);
  assert.deepEqual(video.segments, [{ t: 0, text: 'hello' }]);
  assert.deepEqual(calls, [
    { name: 'pageProbe', world: 'MAIN', args: undefined },
    { name: 'panelProbe', world: undefined, args: ['dQw4w9WgXcQ', 212] },
  ]);
});

test('falls back to the page title when the probe is stale', async () => {
  probe = { ...PROBE, videoId: 'STALE000000', title: 'Old title', pageTitle: 'Current title' };
  panel = [{ t: 0, text: 'line' }];
  calls = [];

  const video = await loadVideo('dQw4w9WgXcQ', 7);

  assert.equal(video.videoId, 'dQw4w9WgXcQ');
  assert.equal(video.title, 'Current title');
  // Without a trusted length the panel probe gets 0 and skips the duration check.
  assert.deepEqual(calls[1].args, ['dQw4w9WgXcQ', 0]);
});

test('throws when the panel probe finds nothing', async () => {
  probe = PROBE;
  panel = null;
  panelReason = 'timeout';
  panelError = null;

  await assert.rejects(() => loadVideo('dQw4w9WgXcQ', 7), /No transcript panel/);
});

test('surfaces an injection failure instead of blaming the video', async () => {
  probe = PROBE;
  panel = null;
  panelError = new Error('Cannot access contents of the page.');

  await assert.rejects(() => loadVideo('dQw4w9WgXcQ', 7), /Cannot read this tab: Cannot access contents/);

  panelError = null;
});

test('names the stale case in the error', async () => {
  probe = PROBE;
  panel = null;
  panelReason = 'stale';

  await assert.rejects(() => loadVideo('dQw4w9WgXcQ', 7), /previous video/);
});

test('peek rejects a probe that describes another video', async () => {
  probe = { ...PROBE, videoId: 'STALE000000' };

  assert.equal(await peekVideo(7, 'dQw4w9WgXcQ'), null);
});

test('peek returns the card data for the matching video', async () => {
  probe = PROBE;

  const video = await peekVideo(7, 'dQw4w9WgXcQ');

  assert.equal(video.title, 'Title');
  assert.equal(video.author, 'Chan');
  assert.equal(video.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
