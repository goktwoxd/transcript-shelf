# Transcript Shelf

[![tests](https://github.com/goktwoxd/transcript-shelf/actions/workflows/test.yml/badge.svg)](https://github.com/goktwoxd/transcript-shelf/actions/workflows/test.yml)

Copy the transcript of the YouTube video you are watching as clean Markdown or
plain text, and collect several into one block for your notes or an LLM.

<!-- Screenshot goes here: docs/images/popup.png -->

## Features

- One click copies the open video's transcript.
- Add it to a shelf, then **Copy all** or **Export .txt** as a numbered set.
- Each entry carries title, channel, publish date, link, and length.
- Markdown or plain text, timestamps optional, spacing optional.
- Light, dark, or follow the system.
- Free and local. No account, no server, no analytics. [Privacy policy](PRIVACY.md).
- Chrome Web Store listing coming soon.

## Install

1. Download `transcript-shelf-v1.0.0.zip` from [Releases](https://github.com/goktwoxd/transcript-shelf/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. **Load unpacked**, pick the unzipped folder, pin the icon.

## Use

On a video: click the icon, then **Copy transcript**, or **Add** to keep it.
**Copy all** and **Export .txt** turn the shelf into:

```text
# Transcripts

3 videos

1) Designing calm interfaces — Lead Dev — 2026-02-11
   https://www.youtube.com/watch?v=xxxxxxxxxxx
2) The quiet economics of small software — Indie Hackers — 2026-01-29
   https://www.youtube.com/watch?v=yyyyyyyyyyy

---

## 1) Designing calm interfaces — transcript

**Channel:** Lead Dev
**Published:** 2026-02-11
**Link:** https://www.youtube.com/watch?v=xxxxxxxxxxx
**Length:** 42:10

[0:00] So the first thing to notice is
[0:04] how the spacing carries the page
```

The sliders button opens the format panel: preset, checkboxes, theme. A copy
that stops early says so: `Copied up to 12:04 of 21:43`.

## Privacy

Everything is local. The extension reads the tab you are on, writes to your
clipboard or to `chrome.storage.local`, and makes no network requests of its
own. Opening the transcript panel is a page action, so YouTube loads the
transcript the way it normally would. Details in [PRIVACY.md](PRIVACY.md).

## Limits

- One video at a time: the tab you are on, after you click.
- Needs captions, uploaded or automatic.
- Shorts have no transcript panel.
- A long list may only be rendered around the viewport; the popup says where
  the copy stopped.
- YouTube restyles the panel now and then. Every selector lives in
  `src/youtube/source.js`.
- The words belong to the video's creator. Copy them for your own reading and
  analysis; do not republish them.

## How it works

```text
popup ─▶ loadVideo ─┬─ probe   MAIN world      window.ytInitialPlayerResponse
                    └─ panel   isolated world  clicks Show transcript, reads rows
```

Both reads happen in the tab you already have open, after you click the icon.
The probe must run in `MAIN`: from the isolated world, every page global
including `ytInitialPlayerResponse` is undefined. The reader walks the
transcript list, which may only be rendered around the viewport, merges what
each window showed, and puts the scroll back.

Permissions are `activeTab`, `storage`, `scripting`, `clipboardWrite`. No host
permission is requested: Chrome hands over the tab you clicked from, for that
tab only.

## Development

```sh
node --test
```

No build step. After edits, reload the extension card in `chrome://extensions`.

Packaging for the store, from committed files only:

```sh
npm run pack
```

## Reporting a bug

Open an issue with your Chrome version, the video URL, and the text from
**Copy debug info** in the popup. That text includes up to 240 characters of the
transcript, so remove anything you would rather not share.

## License

MIT
