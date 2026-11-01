// The shelf: an ordered list of transcripts in chrome.storage.local.
// Newest last, so the block reads in the order the videos were added.

import { MAX_ITEMS, STORAGE } from '../common/const.js';

export async function listItems() {
  const stored = await chrome.storage.local.get(STORAGE.collection);
  const items = stored[STORAGE.collection];

  return Array.isArray(items) ? items : [];
}

// Re-adding a video replaces it in place. Past MAX_ITEMS the oldest falls off,
// which keeps the 10 MB local quota (Chrome 114+) out of reach.
export async function addItem(video) {
  const items = (await listItems()).filter((item) => item.videoId !== video.videoId);
  items.push(toItem(video));

  const dropped = Math.max(0, items.length - MAX_ITEMS);
  const kept = items.slice(dropped);

  await write(kept);
  return { items: kept, dropped };
}

export async function removeItem(videoId) {
  const kept = (await listItems()).filter((item) => item.videoId !== videoId);

  await write(kept);
  return kept;
}

export async function clearItems() {
  await write([]);
  return [];
}

function write(items) {
  return chrome.storage.local.set({ [STORAGE.collection]: items });
}

// Only these fields are kept: anything else would bloat the quota.
function toItem(video) {
  return {
    videoId: video.videoId,
    title: video.title,
    author: video.author,
    published: video.published,
    lengthSeconds: video.lengthSeconds,
    url: video.url,
    segments: video.segments,
    savedAt: Date.now(),
  };
}
