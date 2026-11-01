// One video shape for the rest of the app. The page probe is the only source,
// so this file is just field picking with sane defaults.

import { watchUrl } from '../common/const.js';

export function fromProbe(probe, videoId) {
  return {
    videoId,
    title: probe.title ?? probe.pageTitle ?? 'Untitled',
    author: probe.author ?? '',
    published: probe.published ?? null,
    lengthSeconds: Number(probe.lengthSeconds) || null,
    url: watchUrl(videoId),
  };
}

// Used when the player payload is missing, or still describes the previous video
// (YouTube swaps videos without reloading). The page title is still current.
export function blank(videoId, title = 'Untitled') {
  return {
    videoId,
    title: title || 'Untitled',
    author: '',
    published: null,
    lengthSeconds: null,
    url: watchUrl(videoId),
  };
}
