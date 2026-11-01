import test from 'node:test';
import assert from 'node:assert/strict';

import { isShorts, isYouTube, videoId } from '../src/youtube/ids.js';

test('reads the urls a tab can actually be', () => {
  assert.equal(videoId('https://www.youtube.com/watch?v=9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(videoId('https://www.youtube.com/shorts/9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(videoId('https://www.youtube.com/embed/9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(videoId('https://www.youtube.com/live/9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(videoId('https://m.youtube.com/watch?v=9bZkp7q19f0&list=PL123'), '9bZkp7q19f0');
});

test('reads v= when other params come first', () => {
  assert.equal(videoId('https://www.youtube.com/watch?feature=share&v=9bZkp7q19f0'), '9bZkp7q19f0');
});

test('rejects ids longer than 11 characters', () => {
  assert.equal(videoId('https://www.youtube.com/watch?v=9bZkp7q19f0X'), null);
});

test('ignores v= outside youtube', () => {
  assert.equal(videoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('refuses hosts the extension cannot read', () => {
  assert.equal(videoId('https://youtu.be/9bZkp7q19f0'), null);
  assert.equal(videoId('https://www.youtube-nocookie.com/embed/9bZkp7q19f0'), null);
});

test('detects the youtube hosts a tab can be', () => {
  assert.equal(isYouTube('https://www.youtube.com/watch?v=x'), true);
  assert.equal(isYouTube('https://m.youtube.com/watch?v=x'), true);
  assert.equal(isYouTube('https://youtu.be/x'), false);
  assert.equal(isYouTube('https://www.youtube-nocookie.com/embed/x'), false);
  assert.equal(isYouTube('https://example.com/watch?v=x'), false);
});

test('ignores pages that hold no video', () => {
  assert.equal(videoId('https://www.youtube.com/feed/subscriptions'), null);
  assert.equal(videoId(''), null);
});

test('spots shorts, which have no transcript panel', () => {
  assert.equal(isShorts('https://www.youtube.com/shorts/kJQP7kiw5Fk'), true);
  assert.equal(isShorts('https://www.youtube.com/watch?v=kJQP7kiw5Fk'), false);
});
