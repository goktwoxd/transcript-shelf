# Changelog

## 1.0.1 — 2026-11-03

- Ask for `https://*.youtube.com/*` instead of `activeTab`, so Chrome lists
  YouTube as the only site the extension can read and change. The extension
  page no longer shows an all-sites toggle.

## 1.0.0 — 2026-11-01

First public release.

- Copies the transcript of the open video: title, channel, publish date, link,
  length, timestamps.
- Shelf of up to 25 transcripts, with Copy all and Export .txt.
- Markdown and plain presets, a checkbox per field, and a light/dark/auto theme.
- Reads the transcript panel the page already rendered, walking a virtualised
  list and reporting where a partial copy stopped.
- No network requests of its own. Everything stays in `chrome.storage.local`.
