// Transport layer. Reads the tab the user is on: once in the page's own world
// for the player payload, once in the extension's world for the rendered panel.
// Nothing here makes a network request.

/*
 *  MAIN world    ─ reads the player payload (window global or player element)
 *  ISOLATED world ─ reads and clicks the DOM (the page's JS never sees us)
 *
 * The probe must run in MAIN: from the isolated world every page global,
 * including ytInitialPlayerResponse, is undefined.
 */
export async function probeTab(tabId) {
  const [entry] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageProbe,
    world: 'MAIN',
  });

  return entry?.result ?? null;
}

// Opens YouTube's transcript panel and reads what it renders. The click is the
// same one the user would make; the text is already on the page.
// Returns { rows, report }: rows is null when nothing trustworthy was found,
// and report says what the page looked like, for the popup's error message.
export async function readPanel(tabId, videoId, lengthSeconds) {
  const [entry] = await chrome.scripting.executeScript({
    target: { tabId },
    func: panelProbe,
    args: [videoId, lengthSeconds ?? 0],
  });

  return entry?.result ?? null;
}

// ---- Runs inside the YouTube page (serialized by chrome.scripting) ----------
// Cannot reference module scope: only its own body and browser globals.

function pageProbe() {
  // After an in-page navigation the window global can still describe the first
  // video. The player element is updated in place, so ask it first and keep the
  // global as the fallback for the initial load.
  const live = () => {
    try {
      const response = document.getElementById('movie_player')?.getPlayerResponse?.();
      return response?.videoDetails?.videoId ? response : null;
    } catch {
      return null;
    }
  };

  const player = live() ?? window.ytInitialPlayerResponse ?? {};
  const details = player.videoDetails ?? {};
  const micro = player.microformat?.playerMicroformatRenderer ?? {};

  return {
    videoId: details.videoId ?? null,
    title: details.title ?? null,
    author: details.author ?? null,
    lengthSeconds: details.lengthSeconds ?? null,
    published: micro.publishDate ?? micro.uploadDate ?? null,
    pageTitle: String(document.title ?? '').replace(/\s*-\s*YouTube$/, ''),
  };
}

// Exported for tests: this is where every fragile selector lives.
export async function panelProbe(expectedId, lengthSeconds) {
  const ATTEMPTS = 40;
  const WAIT_MS = 250;
  const SETTLE_MS = 600;
  const EXPAND_MS = 400;
  const CLICK_EVERY = 12;
  const CLICKS = 4;
  const STALE_POLLS = 4;
  const SLACK_S = 15;
  const COVERAGE = 0.8;
  const SCROLL_PAUSE = 120;
  const SCROLL_BUDGET = 15000;
  const MAX_SWEEPS = 2;
  const ROWS =
    'transcript-segment-view-model, ytd-transcript-segment-renderer, yt-transcript-segment-renderer, [class*="transcript-segment"]';
  const LIST = 'ytd-transcript-segment-list-renderer #segments-container';
  const TRIGGER =
    'ytd-video-description-transcript-section-renderer button, ytd-video-description-transcript-section-renderer yt-button-shape';
  const EXPAND = 'ytd-text-inline-expander #expand, tp-yt-paper-button#expand';
  const PANEL = 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
  const PAGE = 'ytd-watch-flexy';
  const OPEN = 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
  const LABEL = /transcript|transkript|transcrip|транскрип/i;
  const STAMP = /^\d{1,2}:\d{2}(?::\d{2})?$/;
  const SPOKEN =
    /^((?:\d{1,3} (?:hours?|minutes?|seconds?))(?:, \d{1,3} (?:hours?|minutes?|seconds?))*) ?/i;

  const length = Number(lengthSeconds) || 0;
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const panels = () => Array.from(document.querySelectorAll(PANEL));

  // YouTube mounts more than one panel element; prefer the one on screen.
  const shown = () => panels().find((node) => node.getClientRects().length > 0) ?? panels()[0] ?? null;

  // Rows are the segment elements. YouTube has shipped this as a renderer, a
  // view model, and a plain class; any of those tags is one row.
  const rows = () => {
    const tagged = Array.from(document.querySelectorAll(ROWS));

    if (tagged.length) {
      return tagged;
    }

    const list = document.querySelector(LIST) ?? document.querySelector('#segments-container');

    return list ? Array.from(list.children) : [];
  };

  const seconds = (stamp) =>
    String(stamp ?? '')
      .trim()
      .split(':')
      .reduce((total, part) => total * 60 + (Number(part) || 0), 0);

  // YouTube labels rows for screen readers with the timestamp in words:
  // "8 seconds", "17 minutes, 57 seconds". It is noise only when it agrees
  // with the row's own timestamp; "2 minutes later he…" is real speech.
  const spokenSeconds = (phrase) => {
    let total = 0;

    for (const [, value, unit] of phrase.matchAll(/(\d{1,3}) (hours?|minutes?|seconds?)/gi)) {
      const count = Number(value);

      if (/hour/i.test(unit)) {
        total += count * 3600;
      } else if (/minute/i.test(unit)) {
        total += count * 60;
      } else {
        total += count;
      }
    }

    return total;
  };

  const stripSpoken = (text, t) => {
    const value = String(text ?? '').trim();
    const match = SPOKEN.exec(value);

    if (!match) {
      return value;
    }

    return Math.abs(spokenSeconds(match[1]) - t) > 1 ? value : value.slice(match[0].length).trim();
  };

  // A row, whatever markup is inside it: the old classes first, then its text.
  const rowCue = (row) => {
    const t = seconds(row.querySelector('.segment-timestamp')?.textContent);
    const direct = stripSpoken(row.querySelector('.segment-text')?.textContent, t);

    if (direct) {
      return { t, text: direct };
    }

    const text = String(row.innerText ?? '').trim();
    const [first, ...rest] = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (first && STAMP.test(first)) {
      return { t: seconds(first), text: stripSpoken(rest.join(' '), seconds(first)) };
    }

    const match = /(\d{1,2}:\d{2}(?::\d{2})?)\s+([\s\S]+)/.exec(text);

    if (!match) {
      return null;
    }

    const start = seconds(match[1]);

    return { t: start, text: stripSpoken(match[2].replace(/\s+/g, ' '), start) };
  };

  // Text-only fallback, used when no row elements exist at all.
  const parseCues = (text) => {
    const cues = [];
    let current = null;

    for (const raw of String(text ?? '').split('\n')) {
      const line = raw.trim();

      if (!line) {
        continue;
      }

      if (STAMP.test(line)) {
        if (current) {
          cues.push(current);
        }

        current = { t: seconds(line), text: '' };
        continue;
      }

      if (current) {
        current.text = `${current.text} ${line}`.trim();
      }
    }

    if (current) {
      cues.push(current);
    }

    return cues
      .map((cue) => ({ t: cue.t, text: stripSpoken(cue.text, cue.t) }))
      .filter((cue) => cue.text);
  };

  const textCues = () => {
    const fromPanel = parseCues(document.querySelector(PANEL)?.innerText ?? '');

    if (fromPanel.length) {
      return fromPanel;
    }

    const loose = Array.from(document.querySelectorAll('[class*="transcript" i], [id*="transcript" i]'))
      .filter((node) => node.getClientRects().length > 0)
      .sort((left, right) => (right.innerText?.length ?? 0) - (left.innerText?.length ?? 0))[0];

    return parseCues(loose?.innerText ?? '');
  };

  // Two cues can share a second; only identical rows are duplicates.
  const dedupe = (cues) => {
    const byKey = new Map();

    for (const cue of cues) {
      if (cue.text) {
        byKey.set(`${cue.t}|${cue.text}`, cue);
      }
    }

    return [...byKey.values()].sort((left, right) => left.t - right.t);
  };

  // Rows are the only source seen on real YouTube. The panel's text is a seam
  // for the moment before they render, never a second opinion on them.
  const read = () => {
    const fromRows = dedupe(rows().map(rowCue).filter(Boolean));

    return fromRows.length ? fromRows : dedupe(textCues());
  };

  const coverage = (list) => (!length || !list.length ? 1 : list[list.length - 1].t / length);

  // A cue stamped past the end of the video cannot belong to it.
  const fits = (list) => !length || !list.length || list[list.length - 1].t <= length + SLACK_S;

  const scroller = () => {
    for (let node = rows()[0]; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 20) {
        return node;
      }
    }

    return null;
  };

  // A virtualised list only holds the window in view. Walk it to the bottom and
  // merge what each window showed, then put the scroll back.
  const sweep = async (first) => {
    const box = scroller();

    if (!box) {
      return first;
    }

    const merged = new Map();
    const keep = (cues) => {
      for (const cue of cues) {
        if (cue.text) {
          merged.set(`${cue.t}|${cue.text}`, cue);
        }
      }
    };

    keep(first);

    const start = box.scrollTop;
    const deadline = Date.now() + SCROLL_BUDGET;

    box.scrollTop = 0;
    await pause(SCROLL_PAUSE);

    while (Date.now() < deadline) {
      keep(read());

      const before = box.scrollTop;
      box.scrollTop = before + box.clientHeight * 0.9;
      await pause(SCROLL_PAUSE);

      if (box.scrollTop === before) {
        break;
      }
    }

    box.scrollTop = start;

    return [...merged.values()].sort((left, right) => left.t - right.t);
  };

  // The list is put back after a sweep, so a later read only sees the first
  // window again. Keep the best set seen and hand that back.
  let best = [];
  let sweeps = 0;
  let sweptLength = 0;

  const readAll = async () => {
    const first = read();

    if (!first.length) {
      return best;
    }

    if (first.length > best.length) {
      best = first;
    }

    const worth = first.length > sweptLength;

    if (coverage(best) >= COVERAGE || sweeps >= MAX_SWEEPS || !worth) {
      return best;
    }

    sweeps += 1;
    sweptLength = first.length;

    const swept = await sweep(first);

    if (swept.length > best.length) {
      best = swept;
    }

    return best;
  };

  const panelState = () => {
    const panel = shown();

    if (!panel) {
      return 'absent';
    }

    return panel.getAttribute('visibility') === OPEN ? 'expanded' : 'hidden';
  };

  const mounted = () => Boolean(document.querySelector('ytd-transcript-renderer'));
  const labels = () =>
    Array.from(document.querySelectorAll('button, yt-button-renderer')).filter((node) =>
      LABEL.test(node.textContent ?? ''),
    );

  // A bare .click() is ignored by some of YouTube's handlers; the full pointer
  // sequence is what a real mouse sends.
  const press = (node) => {
    const target = node.tagName === 'BUTTON' ? node : (node.querySelector('button') ?? node);
    const options = { bubbles: true, cancelable: true, view: window };

    target.dispatchEvent(new PointerEvent('pointerdown', options));
    target.dispatchEvent(new MouseEvent('mousedown', options));
    target.dispatchEvent(new PointerEvent('pointerup', options));
    target.dispatchEvent(new MouseEvent('mouseup', options));
    target.dispatchEvent(new MouseEvent('click', options));
  };

  // The section button only acts once the description is expanded, so expand it
  // first. "...more" is the honest signal: visible means collapsed.
  const visible = (node) => Boolean(node) && node.getClientRects().length > 0;
  let expanded = false;

  const open = async () => {
    const more = document.querySelector(EXPAND);

    if (!expanded && visible(more)) {
      press(more);
      expanded = true;
      await pause(EXPAND_MS);
    }

    const structural = document.querySelector(TRIGGER);

    if (structural) {
      press(structural);
      return 'section';
    }

    const [labelled] = labels();

    if (labelled) {
      press(labelled);
      return 'label';
    }

    return 'none';
  };

  // Everything a failure could need, including a short sample of transcript
  // text: the popup says so before copying it into a bug report.
  const signature = () => {
    const tags = {};
    let shadow = 0;

    for (const node of document.querySelectorAll('*')) {
      if (node.shadowRoot) {
        shadow += 1;
      }

      const name = node.tagName.toLowerCase();

      if (/transcript|segment|caption/i.test(name)) {
        tags[name] = (tags[name] ?? 0) + 1;
      }
    }

    return JSON.stringify({
      tags,
      shadow,
      panels: panels().length,
      shown: Boolean(shown()?.getClientRects().length),
      text: String(shown()?.innerText ?? '').slice(0, 240),
    });
  };

  // Rows already on screen may be the previous video's. One beat before the
  // first read lets a swap finish, and keeps it out of the loop below.
  if (rows().length) {
    await pause(SETTLE_MS);
  }

  let stale = 0;
  let clicks = 0;
  let clicked = 'none';

  const report = (reason) => ({
    reason,
    rows: rows().length,
    panel: panelState(),
    clicked,
    mounted: mounted(),
    labels: labels().length,
    pageId: document.querySelector(PAGE)?.getAttribute('video-id') ?? null,
    expected: expectedId ?? null,
    length,
    signature: signature(),
  });

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const cues = await readAll();
    const short = cues.length > 0 && coverage(cues) < COVERAGE;

    if (cues.length) {
      if (fits(cues)) {
        return { rows: cues, report: null, signature: short ? signature() : null };
      }

      // Loaded but unfit: the list is showing a longer video than this one.
      stale += 1;

      if (stale >= STALE_POLLS) {
        return { rows: null, report: report('stale') };
      }
    } else if (
      clicks < CLICKS &&
      attempt % CLICK_EVERY === 0 &&
      panelState() !== 'expanded' &&
      !(clicks > 0 && mounted())
    ) {
      // Retry every three seconds: a section button that is not hydrated yet,
      // or a panel that opens slowly, both need another attempt. Once something
      // has mounted, further clicks could only close it.
      clicked = await open();
      clicks += 1;
    }

    await pause(WAIT_MS);
  }

  const late = await readAll();

  if (late.length && fits(late)) {
    return {
      rows: late,
      report: null,
      signature: coverage(late) < COVERAGE ? signature() : null,
    };
  }

  return { rows: null, report: report('timeout') };
}
