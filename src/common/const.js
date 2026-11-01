// Values shared by two or more modules. One-off numbers stay local to their use.

export const STORAGE = {
  settings: 'settings',
  collection: 'collection',
};

export const THEME = {
  auto: 'auto',
  light: 'light',
  dark: 'dark',
};

export const PRESET = {
  markdown: 'markdown',
  plain: 'plain',
  custom: 'custom',
};

// Output shape. `md` switches markdown syntax (#, **); the rest toggle content.
export const DEFAULT_OPTIONS = {
  preset: PRESET.markdown,
  md: true,
  index: true,
  heading: true,
  title: true,
  channel: true,
  published: true,
  link: true,
  length: true,
  timestamps: true,
  blankLines: false,
  theme: THEME.auto,
};

// Presets only seed the checkboxes. Editing any box switches to "custom".
// Plain drops timestamps: they double the token cost and add nothing to prose.
export const PRESETS = {
  [PRESET.markdown]: { ...DEFAULT_OPTIONS, preset: PRESET.markdown, md: true },
  [PRESET.plain]: {
    ...DEFAULT_OPTIONS,
    preset: PRESET.plain,
    md: false,
    length: false,
    timestamps: false,
  },
};

// chrome.storage.local holds 10 MB (Chrome 114+). 25 long transcripts fit.
export const MAX_ITEMS = 25;

export const YT_ORIGIN = 'https://www.youtube.com';

export const watchUrl = (id) => `${YT_ORIGIN}/watch?v=${id}`;
