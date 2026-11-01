// An id is exactly 11 url-safe characters. The lookahead stops a 12-character
// token from being read as its first 11: "dQw4w9WgXcQQ" is not a video.
const ID = '([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])';

// Only pages that can be the active tab: youtu.be and youtube-nocookie links
// never are, and the extension has no access to them.
const LINK = new RegExp(
  'youtube\\.com/(?:watch\\?(?:[^#\\s]*&)?v=|shorts/|embed/|live/)' + ID,
  'i',
);

const HOST = /^https:\/\/(?:[\w-]+\.)*youtube\.com\//i;
const SHORTS = /youtube\.com\/shorts\//i;

// Tab URL -> video id, or null for anything else.
export function videoId(url) {
  return LINK.exec(String(url ?? ''))?.[1] ?? null;
}

export function isYouTube(url) {
  return HOST.test(String(url ?? ''));
}

// Shorts have no transcript panel, so the popup says so instead of waiting.
export function isShorts(url) {
  return SHORTS.test(String(url ?? ''));
}
