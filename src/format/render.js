// Format layer. Pure string building: same options in, same text out.
// Two shapes: one transcript, or the whole shelf as a numbered set.

import { DEFAULT_OPTIONS } from '../common/const.js';
import { clock } from './time.js';

const RULE = '---';
const INDENT = '   ';

export function renderShelf(items, options = DEFAULT_OPTIONS) {
  if (!items.length) {
    return '';
  }

  const blocks = [];
  const numbered = items.length > 1;

  if (numbered && options.index) {
    blocks.push(indexBlock(items, options));
  }

  items.forEach((item, position) => {
    blocks.push(renderOne(item, options, numbered ? position + 1 : 0));
  });

  // The rule is a divider in both syntaxes: a blank line alone vanishes in plain.
  return blocks.filter(Boolean).join(`\n\n${RULE}\n\n`);
}

// number = 0 renders the transcript without a sequence number, for a lone copy.
export function renderOne(video, options = DEFAULT_OPTIONS, number = 0) {
  const blocks = [heading(video, options, number), metaLines(video, options), cueLines(video.segments, options)];

  return blocks.filter(Boolean).join('\n\n').trim();
}

function heading(video, options, number) {
  if (!options.heading) {
    return '';
  }

  const prefix = number ? `${number}) ` : '';
  const title = options.title && video.title ? `${video.title} — transcript` : 'Transcript';

  return `${options.md ? '## ' : ''}${prefix}${title}`;
}

function metaLines(video, options) {
  const rows = [
    ['Channel', options.channel && video.author],
    ['Published', options.published && video.published],
    ['Link', options.link && video.url],
    ['Length', options.length && video.lengthSeconds > 0 && clock(video.lengthSeconds)],
  ];

  return rows
    .filter(([, value]) => value)
    .map(([name, value]) => (options.md ? `**${name}:** ${value}` : `${name}: ${value}`))
    .join('\n');
}

function cueLines(segments, options) {
  const lines = (segments ?? []).map((segment) =>
    options.timestamps ? `[${clock(segment.t)}] ${segment.text}` : segment.text,
  );

  return lines.join(options.blankLines ? '\n\n' : '\n');
}

function indexBlock(items, options) {
  const header = [options.md ? '# Transcripts' : 'Transcripts', '', countLine(items.length)];
  const rows = items.map((item, position) => {
    const bits = [
      options.title && item.title,
      options.channel && item.author,
      options.published && item.published,
    ].filter(Boolean);

    const label = bits.length ? bits.join(' — ') : (item.url ?? 'Untitled');
    const lines = [`${position + 1}) ${label}`];

    if (options.link && item.url) {
      lines.push(`${INDENT}${item.url}`);
    }

    return lines.join('\n');
  });

  return [...header, '', ...rows].join('\n');
}

function countLine(count) {
  return `${count} ${count === 1 ? 'video' : 'videos'}`;
}
