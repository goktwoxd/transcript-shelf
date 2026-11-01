const ZERO_WIDTH = /[\u200b\u200c\u200d\u200e\u200f\ufeff]/g;
const WHITESPACE = /\s+/g;
const EMPTY = '';

// Collapse the newlines and zero-width spaces YouTube sprinkles into captions.
export function clean(text) {
  return String(text ?? '')
    .replace(ZERO_WIDTH, EMPTY)
    .replace(WHITESPACE, ' ')
    .trim();
}
