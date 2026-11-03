# Chrome Web Store listing

Copy for the dashboard, plus the answers it asks for. Last checked 2026-11-01.

## Item

- **Name:** Transcript Shelf
- **Summary (132 char max):** Copy the transcript of the open YouTube video,
  collect several, paste into any LLM. No network requests.
- **Category:** Productivity → Tools
- **Language:** English
- **Version:** 1.0.1

"YouTube" does not appear in the name, and never should: the branding rules
forbid it in an app name while allowing a description to say what the app works
with. The icon is ours, not YouTube's.

## Detailed description

```text
Transcript Shelf copies the transcript of the YouTube video you are watching
into clean, formatted text you can paste anywhere: a notes app, a document, or
an AI chat.

WHAT IT DOES
• One click copies the open video's transcript.
• Collect several videos into a shelf, then copy or export them as one block.
• Each entry can carry title, channel, publish date, link, length, timestamps.
• Markdown or plain text, with a checkbox for every field.

WHO IT IS FOR
• Students turning lectures into notes.
• Researchers quoting a talk without rewatching it.
• Anyone feeding a transcript to an AI assistant.
• Readers who need the words in text instead of audio.

PRIVACY
Everything runs locally in the tab you are on. No account, no server, no
network requests of its own, no analytics, no ads. Your shelf is stored in the
browser and never leaves it.

REQUIREMENTS
The video needs captions, uploaded or automatic. Shorts have no transcript
panel. If a long transcript is only partly rendered, the extension copies what
the panel shows and tells you where it stopped.

Transcript Shelf is not affiliated with, endorsed by, or sponsored by YouTube or
Google. YouTube is a trademark of Google LLC. Transcripts belong to their
creators; use them for your own reading and analysis.
```

## Single purpose

Copy the transcript of the YouTube video in the active tab into plain text, and
collect several transcripts into one block for reuse.

## Permission justifications

- **`https://*.youtube.com/*`** — the only site the extension can read or
  change. The page reads and the popup are scoped to YouTube.
- **`storage`** — saves the transcript shelf and the formatting options in
  `chrome.storage.local`. Nothing is transmitted.
- **`scripting`** — reads the transcript panel and, when it is closed, opens it
  in the active tab after the user clicks the extension icon. Reading that page
  is the extension's only function.
- **`clipboardWrite`** — puts the copied transcript on the clipboard. A read can
  take a while on a long video, and the clipboard API needs a permission grant
  once the click's transient activation has expired.

No remote code, no `eval`, no network requests.

## Privacy practices

- **Website content:** yes. The transcript text is read from the page to fulfil
  the single purpose and, when the user presses Add, stored in
  `chrome.storage.local`. It is never transmitted.
- **Everything else:** no.
- Certify: not sold, not transferred to third parties, not used for
  creditworthiness, not read by humans.
- **Privacy policy URL:**
  `https://github.com/goktwoxd/transcript-shelf/blob/main/PRIVACY.md`

## Screenshots

One to five, 1280×800 or 640×400 PNG, taken from a real window at 100 % zoom:

1. Popup over a video, "Now playing" card visible.
2. Shelf with three entries, Copy all in view.
3. Format panel open, checkboxes visible.

No YouTube logo or copyrighted thumbnail in frame; a plain video page is fine.

## Packaging

```sh
npm run pack
```

`git archive` writes `transcript-shelf.zip` from the committed runtime files
only: `manifest.json`, `src/`, `icons/`. Load that zip through "Load unpacked"
once before uploading, to confirm it is complete.

## What the extension reads

One video, in the tab the user is on, after they click. It opens YouTube's own
transcript panel when that panel is closed, reads the text the page already
rendered, and stores it locally. Nothing is fetched from YouTube's servers by
the extension, and no other video or page is touched.
