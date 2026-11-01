// Service layer: "the open tab in, a transcript out". No network, no fallbacks
// to other endpoints: the panel is the only source that does not fight YouTube.

import { clean } from '../common/text.js';
import { probeTab, readPanel } from './source.js';
import { blank, fromProbe } from './video.js';

/*
 *  popup ─▶ loadVideo ─┬─ probe  (MAIN world, player data already on the page)
 *                      └─ panel  (isolated world, clicks Show transcript)
 */
export async function loadVideo(videoId, tabId) {
  const probe = await probeTab(tabId).catch(() => null);
  const video = probe?.videoId === videoId ? fromProbe(probe, videoId) : blank(videoId, probe?.pageTitle);
  const result = await readPanel(tabId, videoId, video.lengthSeconds).catch((error) => ({ error }));
  const rows = result?.rows ?? [];
  const segments = rows.map((row) => ({ t: row.t, text: clean(row.text) })).filter((row) => row.text);

  if (!segments.length) {
    console.warn('[transcript-shelf]', describe(result));

    const error = new Error(failureMessage(result));

    // The popup turns this into a "Copy debug" button.
    error.diagnostics = result?.report?.signature ?? null;

    throw error;
  }

  return { ...video, segments, diagnostics: result?.signature ?? null };
}

// Metadata for the card. A probe describing another video means YouTube swapped
// the player without a reload, so nothing here is safe to show.
export async function peekVideo(tabId, videoId) {
  const probe = await probeTab(tabId).catch(() => null);

  if (probe?.videoId !== videoId) {
    return null;
  }

  return fromProbe(probe, videoId);
}

// Why an injection failed matters: a missing permission and an empty panel
// look identical to the user otherwise.
function failureMessage(result) {
  if (result?.error) {
    return `Cannot read this tab: ${describe(result.error)}`;
  }

  const report = result?.report;

  if (report?.reason === 'stale') {
    return 'The open transcript belongs to the previous video';
  }

  const detail = report ? ` (${report.rows} rows, panel ${report.panel}, click ${report.clicked})` : '';

  return `No transcript panel on this video${detail} · open Show transcript, then copy`;
}

function describe(value) {
  if (!value) {
    return 'nothing';
  }

  if (value instanceof Error) {
    return value.message;
  }

  return value.message ?? JSON.stringify(value);
}
