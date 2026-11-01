import test from 'node:test';
import assert from 'node:assert/strict';

import { panelProbe } from '../src/youtube/source.js';

// Small DOM stand-in: the probe only queries tags, one attribute, and two
// classes inside a row. Enough to drive it, not a browser.
const OPEN = 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';

function node(tag, attrs = {}, children = []) {
  return {
    tag,
    attrs,
    children,
    textContent: attrs.text ?? '',
    innerText: attrs.text ?? '',
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    getClientRects() {
      return [{ width: 1, height: 1 }];
    },
    querySelector(selector) {
      return find(this, selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      return find(this, selector);
    },
    click() {
      this.clicked = true;
    },
  };
}

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

function match(el, part) {
  const tag = part.match(/^[a-z0-9-]+/i)?.[0] ?? null;
  const classes = (part.match(/\.[\w-]+/g) ?? []).map((name) => name.slice(1));
  const attrs = [...part.matchAll(/\[([\w-]+)="([^"]*)"\]/g)].map((hit) => [hit[1], hit[2]]);

  if (!tag && !classes.length && !attrs.length) {
    return false;
  }

  if (tag && el.tag !== tag) {
    return false;
  }

  const own = String(el.attrs.class ?? '').split(/\s+/);

  if (classes.some((name) => !own.includes(name))) {
    return false;
  }

  return attrs.every(([name, value]) => el.attrs[name] === value);
}

function find(root, selector) {
  return selector.split(',').flatMap((part) => findOne(root, part.trim()));
}

function findOne(root, selector) {
  const parts = selector.split(/\s+/);
  const last = parts.pop();
  let scopes = [root];

  for (const part of parts) {
    scopes = scopes.flatMap((scope) => descendants(scope).filter((el) => match(el, part)));
  }

  return scopes.flatMap((scope) => descendants(scope).filter((el) => match(el, last)));
}

// Builds a page with the panel, the watch element, and the transcript rows.
function page({ pageId = 'dQw4w9WgXcQ', visibility = OPEN, rows = [], text = '' } = {}) {
  const segments = rows.map(([stamp, label]) =>
    node('ytd-transcript-segment-renderer', {}, [
      node('div', { class: 'segment-timestamp', text: stamp }),
      node('div', { class: 'segment-text', text: label }),
    ]),
  );

  const panel = node('ytd-engagement-panel-section-list-renderer', {
    'target-id': 'engagement-panel-searchable-transcript',
    visibility,
  });

  panel.innerText = text;

  return node('#document', {}, [node('ytd-watch-flexy', { 'video-id': pageId }), panel, ...segments]);
}

function install(tree) {
  globalThis.document = {
    title: 'Test - YouTube',
    querySelector: (selector) => find(tree, selector)[0] ?? null,
    querySelectorAll: (selector) => find(tree, selector),
  };
}

// The 2026 UI reported in the wild: rows are transcript-segment-view-model,
// the engagement panel element exists but is not displayed, and the transcript
// renders inline under the description. No .segment-* classes anywhere.
function viewModelPage(cues) {
  const rows = cues.map(([stamp, label]) => {
    const row = node('transcript-segment-view-model', {});

    row.innerText = `${stamp}\n${label}`;

    return row;
  });

  const panel = node('ytd-engagement-panel-section-list-renderer', {
    'target-id': 'engagement-panel-searchable-transcript',
    visibility: 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN',
  });

  return node('#document', {}, [node('ytd-watch-flexy', { 'video-id': 'dQw4w9WgXcQ' }), panel, ...rows]);
}

test('reads the rows of the current video', async () => {
  install(page({ rows: [['0:00', 'hello'], ['0:07', 'world']] }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(result.rows, [
    { t: 0, text: 'hello' },
    { t: 7, text: 'world' },
  ]);
  assert.equal(result.report, null);
});

// The regression from 1.1.0: a page id that does not match must not block the
// read, because it proves nothing about which video the rows belong to.
test('ignores a mismatched page id when the rows fit the video', async () => {
  install(page({ pageId: 'OTHERVIDEO1', rows: [['0:00', 'hi']] }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.equal(result.rows?.[0].text, 'hi');
});

test('refuses rows that run past the end of the video', async () => {
  install(page({ rows: [['0:00', 'old'], ['40:00', 'older']] }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.equal(result.rows, null);
  assert.equal(result.report.reason, 'stale');
});

test('reads without a length, since the check needs one', async () => {
  install(page({ rows: [['0:00', 'hi'], ['99:00', 'long']] }));

  const result = await panelProbe('dQw4w9WgXcQ', 0);

  assert.equal(result.rows.length, 2);
});

// The reader that does not depend on element names: a panel that renders
// timestamps as text is enough.
test('reads a panel whose rows use unknown tags', async () => {
  install(page({ text: '0:00\nhello\n0:07\nworld' }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(result.rows, [
    { t: 0, text: 'hello' },
    { t: 7, text: 'world' },
  ]);
});

test('joins the lines a single cue wrapped into', async () => {
  install(page({ text: '0:00\nhello\nthere' }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(result.rows, [{ t: 0, text: 'hello there' }]);
});

// YouTube labels rows for screen readers with the timestamp in words; it is
// only noise when it agrees with the row's own timestamp.
test('drops the spoken timestamp from the cue text', async () => {
  install(page({ text: '17:57\n17 minutes, 57 seconds hello there' }));

  const result = await panelProbe('dQw4w9WgXcQ', 1300);

  assert.deepEqual(result.rows, [{ t: 1077, text: 'hello there' }]);
});

test('drops the short spoken prefixes too', async () => {
  install(page({ text: '0:08\n8 seconds Back up. Back up.\n0:54\n54 seconds then quiet' }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(
    result.rows.map((cue) => cue.text),
    ['Back up. Back up.', 'then quiet'],
  );
});

test('keeps real speech that starts with a duration', async () => {
  install(page({ text: '0:08\n2 minutes later we left' }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(result.rows, [{ t: 8, text: '2 minutes later we left' }]);
});

// Rows are the source that matched real YouTube; the panel's text is only a
// seam for the moment before the rows render. Never a second opinion.
test('prefers rows over text when rows exist', async () => {
  install(page({ rows: [['0:05', 'row text']], text: '0:05\nrow text\n0:12\nsecond\n0:20\nthird' }));

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(result.rows, [{ t: 5, text: 'row text' }]);
});

test('keeps two cues that share a second', async () => {
  install(
    page({
      rows: [
        ['0:05', 'alpha'],
        ['0:05', 'beta'],
      ],
    }),
  );

  const result = await panelProbe('dQw4w9WgXcQ', 300);

  assert.deepEqual(
    result.rows.map((cue) => cue.text),
    ['alpha', 'beta'],
  );
});

test('reads the view-model rows the description renders inline', async () => {
  install(
    viewModelPage([
      ['16:31', 'I know. I know.'],
      ['16:36', 'Get out.'],
    ]),
  );

  const result = await panelProbe('dQw4w9WgXcQ', 1303);

  assert.deepEqual(result.rows, [
    { t: 991, text: 'I know. I know.' },
    { t: 996, text: 'Get out.' },
  ]);
});
