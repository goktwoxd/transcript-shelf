// Popup controller. Owns DOM, state and events; every other module is a service.

import { DEFAULT_OPTIONS, MAX_ITEMS, PRESET, PRESETS, THEME } from '../common/const.js';
import { renderOne, renderShelf } from '../format/render.js';
import { clock } from '../format/time.js';
import { addItem, clearItems, listItems, removeItem } from '../store/collection.js';
import { loadSettings, saveSettings } from '../store/settings.js';
import { isShorts, isYouTube, videoId } from '../youtube/ids.js';
import { loadVideo, peekVideo } from '../youtube/index.js';

const FIELDS = [
  ['index', 'Numbered list'],
  ['heading', 'Section heading'],
  ['title', 'Video title'],
  ['channel', 'Channel'],
  ['published', 'Published date'],
  ['link', 'Video link'],
  ['length', 'Length'],
  ['timestamps', 'Timestamps'],
  ['blankLines', 'Blank lines'],
];

const STATUS_MS = 2600;
const WARN_MS = 6000;
const CLEAR_ARM_MS = 3000;

let clearTimer = 0;

const state = {
  options: { ...DEFAULT_OPTIONS },
  items: [],
  current: null,
  armed: false,
  blocked: false,
  diagnostics: null,
};

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

let statusTimer = 0;

const ui = {
  options: byId('options'),
  settingsButton: byId('settingsButton'),
  fields: byId('fields'),
  presets: [...document.querySelectorAll('#options [data-preset]')],
  themes: [...document.querySelectorAll('#options [data-theme]')],
  current: byId('current'),
  currentTitle: byId('currentTitle'),
  currentMeta: byId('currentMeta'),
  copyButton: byId('copyButton'),
  addButton: byId('addButton'),
  list: byId('list'),
  empty: byId('empty'),
  count: byId('count'),
  shelfTools: byId('shelfTools'),
  copyAllButton: byId('copyAllButton'),
  exportButton: byId('exportButton'),
  clearButton: byId('clearButton'),
  status: byId('status'),
  debugButton: byId('debugButton'),
};

await boot();

async function boot() {
  state.options = await loadSettings();
  state.items = await listItems();

  paintTheme();
  buildFields();
  paintOptions();
  paintShelf();
  bind();
  await paintCurrent();
}

function bind() {
  ui.settingsButton.addEventListener('click', toggleOptions);
  ui.copyButton.addEventListener('click', copyCurrent);
  ui.addButton.addEventListener('click', addCurrent);
  ui.copyAllButton.addEventListener('click', copyAll);
  ui.exportButton.addEventListener('click', exportTxt);
  ui.clearButton.addEventListener('click', clearShelf);
  ui.debugButton.addEventListener('click', copyDiagnostics);
  document.addEventListener('click', onDocumentClick);

  for (const chip of ui.presets) {
    chip.addEventListener('click', onPreset);
  }

  for (const chip of ui.themes) {
    chip.addEventListener('click', onTheme);
  }

  // Follow the system while the popup is open and the theme is "auto".
  darkQuery.addEventListener('change', () => {
    if (state.options.theme === THEME.auto) {
      paintTheme();
    }
  });
}

/* ---- Current tab --------------------------------------------------------- */

async function paintCurrent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';

  // The youtube.com host permission is what exposes this tab's URL. Anything
  // outside YouTube is out of scope.
  if (!isYouTube(url)) {
    return;
  }

  const id = videoId(url);

  if (!id) {
    return;
  }

  ui.current.hidden = false;

  // Shorts render no transcript panel, so do not start a read that must time out.
  if (isShorts(tab.url)) {
    state.blocked = true;
    paintCard({ title: tabTitle(tab), author: '', lengthSeconds: null, published: null });
    ui.currentMeta.textContent = 'Shorts have no transcript panel';
    ui.copyButton.disabled = true;
    ui.addButton.disabled = true;
    return;
  }

  state.current = { videoId: id, tabId: tab.id };
  paintCard({ title: tabTitle(tab), author: '', lengthSeconds: null, published: null });

  const peek = await peekVideo(tab.id, id).catch(() => null);
  if (peek) {
    paintCard(peek);
  }
}

function tabTitle(tab) {
  return (tab?.title ?? 'YouTube video').replace(/\s*-\s*YouTube$/, '');
}

function paintCard(video) {
  ui.currentTitle.textContent = video.title || 'YouTube video';
  ui.currentMeta.textContent = metaLine(video) || 'Transcript on copy';
}

function metaLine(video) {
  return [
    video.author,
    video.lengthSeconds ? clock(video.lengthSeconds) : null,
    video.published,
  ]
    .filter(Boolean)
    .join(' · ');
}

/* ---- Reading a video ---------------------------------------------------- */

async function grab() {
  if (!state.current) {
    return null;
  }

  setBusy(true);
  showDiagnostics(null);

  try {
    return await loadVideo(state.current.videoId, state.current.tabId);
  } catch (error) {
    setStatus(error.message || 'Could not read this video', 'error');
    showDiagnostics(error.diagnostics ?? null);
    return null;
  } finally {
    setBusy(false);
  }
}

// A failed read carries a DOM signature; one click puts it on the clipboard.
function showDiagnostics(text) {
  state.diagnostics = text;
  ui.debugButton.hidden = !text;
}

async function copyDiagnostics() {
  if (!state.diagnostics) {
    return;
  }

  await copyText(state.diagnostics, 'Debug info copied');
}

async function copyCurrent() {
  const video = await grab();
  if (!video) {
    return;
  }

  paintCard(video);
  await copyText(renderOne(video, state.options), 'Copied');
  noteRead(video);
}

// A transcript that stops well before the video does is usually a virtualised
// list the walk did not reach the end of. Say where it stopped, not "failed".
function noteRead(video) {
  const total = video.lengthSeconds ?? 0;
  const last = video.segments[video.segments.length - 1];
  const short = total > 0 && Boolean(last) && last.t < total * 0.8;

  showDiagnostics(short ? (video.diagnostics ?? null) : null);

  if (short) {
    setStatus(`Copied up to ${clock(last.t)} of ${clock(total)}`, 'warn');
  }
}

async function addCurrent() {
  const video = await grab();
  if (!video) {
    return;
  }

  await store(video);
  noteRead(video);
}

async function store(video) {
  try {
    const { items, dropped } = await addItem(video);
    state.items = items;
    paintShelf();
    setStatus(dropped ? `Added. Shelf holds ${MAX_ITEMS}.` : 'Added', 'ok');
  } catch {
    setStatus('Could not save. Local storage is full.', 'error');
  }
}

/* ---- Shelf actions ------------------------------------------------------ */

async function copyAll() {
  const text = renderShelf(state.items, state.options);
  if (!text) {
    return;
  }

  await copyText(text, `Copied ${state.items.length} transcripts`);
}

async function copyOne(item) {
  await copyText(renderOne(item, state.options), 'Copied');
}

async function clearShelf() {
  if (!state.items.length) {
    return;
  }

  // Two-step clear: a stray click must not wipe a set of long transcripts.
  if (!state.armed) {
    state.armed = true;
    ui.clearButton.textContent = 'Sure?';

    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      state.armed = false;
      ui.clearButton.textContent = 'Clear all';
    }, CLEAR_ARM_MS);

    return;
  }

  clearTimeout(clearTimer);

  state.armed = false;
  ui.clearButton.textContent = 'Clear all';

  try {
    state.items = await clearItems();
    paintShelf();
    setStatus('Shelf cleared');
  } catch {
    setStatus('Could not save. Local storage is full.', 'error');
  }
}

function exportTxt() {
  const text = renderShelf(state.items, state.options);
  if (!text) {
    return;
  }

  const href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');

  anchor.href = href;
  anchor.download = `transcripts-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(href), 1000);
  setStatus('Exported', 'ok');
}

/* ---- Shelf rendering ---------------------------------------------------- */

function paintShelf() {
  ui.list.replaceChildren(...state.items.map(itemRow));
  ui.count.textContent = state.items.length ? String(state.items.length) : '';
  ui.empty.hidden = state.items.length > 0;
  ui.shelfTools.hidden = state.items.length === 0;
  ui.copyAllButton.disabled = state.items.length === 0;
}

function itemRow(item, index) {
  const row = document.createElement('li');
  row.className = 'item';
  row.title = 'Copy this transcript';

  const body = document.createElement('div');
  body.className = 'item-body';

  const title = document.createElement('p');
  title.className = 'item-title';
  title.textContent = item.title;

  const meta = document.createElement('p');
  meta.className = 'item-meta';
  meta.textContent = metaLine(item);

  body.append(title, meta);
  row.append(numberCell(index), body, removeButton(item));
  row.addEventListener('click', () => copyOne(item));

  return row;
}

function numberCell(index) {
  const cell = document.createElement('span');
  cell.className = 'item-number';
  cell.textContent = String(index + 1);
  return cell;
}

function removeButton(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item-remove';
  button.textContent = '×';
  button.title = 'Remove';

  button.addEventListener('click', async (event) => {
    event.stopPropagation();

    try {
      state.items = await removeItem(item.videoId);
      paintShelf();
      setStatus('Removed');
    } catch {
      setStatus('Could not save. Local storage is full.', 'error');
    }
  });

  return button;
}

/* ---- Formatting panel --------------------------------------------------- */

function buildFields() {
  const fragment = document.createDocumentFragment();

  for (const [name, label] of FIELDS) {
    const row = document.createElement('label');
    const box = document.createElement('input');

    box.type = 'checkbox';
    box.name = name;
    box.addEventListener('change', onField);

    row.append(box, document.createTextNode(label));
    fragment.append(row);
  }

  ui.fields.replaceChildren(fragment);
}

function paintOptions() {
  for (const chip of ui.presets) {
    paintChip(chip, chip.dataset.preset === state.options.preset);
  }

  for (const chip of ui.themes) {
    paintChip(chip, chip.dataset.theme === state.options.theme);
  }

  for (const box of ui.fields.querySelectorAll('input')) {
    box.checked = Boolean(state.options[box.name]);
  }
}

function paintChip(chip, active) {
  chip.classList.toggle('active', active);
  chip.setAttribute('aria-pressed', String(active));
}

function toggleOptions() {
  ui.options.hidden = !ui.options.hidden;
  ui.settingsButton.setAttribute('aria-expanded', String(!ui.options.hidden));
}

// Clicking the page is the natural way out of a popup menu.
function onDocumentClick(event) {
  if (ui.options.hidden || event.target.closest?.('.top')) {
    return;
  }

  closeOptions();
}

function closeOptions() {
  ui.options.hidden = true;
  ui.settingsButton.setAttribute('aria-expanded', 'false');
}

function onPreset(event) {
  const { preset } = event.currentTarget.dataset;

  if (preset === PRESET.custom) {
    return;
  }

  state.options = { ...PRESETS[preset], theme: state.options.theme };
  paintTheme();
  paintOptions();
  persist();
}

function onField(event) {
  state.options[event.target.name] = event.target.checked;
  state.options.preset = PRESET.custom;
  paintOptions();
  persist();
}

function onTheme(event) {
  state.options.theme = event.currentTarget.dataset.theme;
  paintTheme();
  paintOptions();
  persist();
}

function paintTheme() {
  const theme =
    state.options.theme === THEME.auto
      ? (darkQuery.matches ? THEME.dark : THEME.light)
      : state.options.theme;

  document.documentElement.dataset.theme = theme;
}

function persist() {
  saveSettings(state.options).catch(() => {});
}

/* ---- Clipboard and status ----------------------------------------------- */

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    if (!fallbackCopy(text)) {
      setStatus('Clipboard blocked by the browser', 'error');
      return;
    }
  }

  setStatus(message, 'ok');
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  document.body.append(area);
  area.select();

  const copied = document.execCommand('copy');
  area.remove();

  return copied;
}

function setStatus(message, kind = 'info') {
  ui.status.textContent = message;
  ui.status.className = `status ${kind}`;
  clearTimeout(statusTimer);

  if (kind === 'error') {
    return;
  }

  // A partial copy is worth reading; let the warning outlast "Copied".
  const hold = kind === 'warn' ? WARN_MS : STATUS_MS;

  statusTimer = setTimeout(() => {
    ui.status.textContent = '';
    ui.status.className = 'status';
  }, hold);
}

function setBusy(on) {
  document.body.classList.toggle('busy', on);

  for (const button of document.querySelectorAll('.button, .text-button')) {
    button.disabled = on || state.blocked || (button === ui.copyAllButton && !state.items.length);
  }
}

function byId(id) {
  return document.getElementById(id);
}
