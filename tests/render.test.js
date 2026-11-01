import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_OPTIONS, PRESETS } from '../src/common/const.js';
import { renderOne, renderShelf } from '../src/format/render.js';
import { clock } from '../src/format/time.js';

const ONE = {
  videoId: 'dQw4w9WgXcQ',
  title: 'One',
  author: 'Chan',
  published: '2009-10-25',
  lengthSeconds: 212,
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  segments: [
    { t: 0, text: 'first' },
    { t: 65, text: 'second' },
  ],
};

const TWO = { ...ONE, videoId: '9bZkp7q19f0', title: 'Two', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' };

test('clock matches YouTube notation', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(65), '1:05');
  assert.equal(clock(212), '3:32');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(undefined), '0:00');
});

test('renders one transcript with a full header', () => {
  const text = renderOne(ONE, DEFAULT_OPTIONS);

  assert.equal(
    text,
    [
      '## One — transcript',
      '',
      '**Channel:** Chan',
      '**Published:** 2009-10-25',
      '**Link:** https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '**Length:** 3:32',
      '',
      '[0:00] first',
      '[1:05] second',
    ].join('\n'),
  );
});

test('plain preset drops markdown, timestamps and length', () => {
  const text = renderOne(ONE, PRESETS.plain);

  assert.equal(
    text,
    ['One — transcript', '', 'Channel: Chan', 'Published: 2009-10-25', 'Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', '', 'first', 'second'].join('\n'),
  );
});

test('blank lines separate cue rows', () => {
  const text = renderOne(ONE, { ...DEFAULT_OPTIONS, blankLines: true });

  assert.match(text, /\[0:00\] first\n\n\[1:05\] second$/);
});

test('a shelf starts with a numbered index and splits sections', () => {
  const text = renderShelf([ONE, TWO], DEFAULT_OPTIONS);

  assert.ok(text.startsWith('# Transcripts\n\n2 videos\n\n1) One — Chan — 2009-10-25\n   https://'));
  assert.ok(text.includes('\n\n---\n\n## 1) One — transcript'));
  assert.ok(text.includes('\n\n---\n\n## 2) Two — transcript'));
});

test('plain preset still separates videos with a rule', () => {
  const text = renderShelf([ONE, TWO], PRESETS.plain);

  assert.ok(text.includes('\n\n---\n\n'));
  assert.ok(!text.includes('## '));
});

test('a shelf with one item skips the index', () => {
  const text = renderShelf([ONE], DEFAULT_OPTIONS);

  assert.ok(text.startsWith('## One — transcript'));
  assert.ok(!text.includes('# Transcripts'));
});

test('an empty shelf renders an empty string', () => {
  assert.equal(renderShelf([], DEFAULT_OPTIONS), '');
});
