// Settings live in chrome.storage.local. A preset always wins on load, so a
// half-written checkbox cannot leave the UI disagreeing with the preset chip.

import { DEFAULT_OPTIONS, PRESET, PRESETS, STORAGE } from '../common/const.js';

export async function loadSettings() {
  const stored = (await chrome.storage.local.get(STORAGE.settings))[STORAGE.settings];

  if (!stored || stored.preset === PRESET.custom || !PRESETS[stored.preset]) {
    return { ...DEFAULT_OPTIONS, ...stored };
  }

  return { ...PRESETS[stored.preset], theme: stored.theme ?? DEFAULT_OPTIONS.theme };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE.settings]: settings });
}
