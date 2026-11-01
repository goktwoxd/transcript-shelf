# Privacy Policy — Transcript Shelf

Effective date: 2026-11-01

Transcript Shelf is a Chrome extension that copies the transcript of a YouTube
video you are watching into your clipboard.

## What it does with data

- It reads the transcript panel and the video page in the tab you click from.
- The transcript goes to your clipboard when you press **Copy**, and to
  `chrome.storage.local` when you press **Add**.
- Nothing else.

## What it does not do

- It makes no network requests of its own. The extension never contacts its
  author or anyone else.
- No analytics, telemetry, crash reporting, advertising, or accounts.
- No data is sold, shared, or transmitted off your device.

## What is stored, and where

`chrome.storage.local` holds your shelf (up to 25 transcripts) and your
formatting options. That storage lives inside your browser profile. Removing the
extension or clearing extension data deletes it.

## Permissions

- `storage` — keeps the shelf and options locally.
- `scripting` — reads the transcript panel and opens it in the active tab, after
  you click the extension icon.
- `clipboardWrite` — puts the transcript on your clipboard.
- `https://*.youtube.com/*` — limits the reads above to YouTube pages.

## Copyright

Transcripts are the work of the video's creator. This tool copies them for your
own reading and analysis; do not republish them.

## Contact

Open an issue at https://github.com/goktwoxd/transcript-shelf/issues.
