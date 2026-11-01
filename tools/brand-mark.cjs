// Single source of truth for the v4 brand mark geometry.
//
// The path lives in brand_guidelines/assets/mataresit-mark.svg — the file the
// brand sheet ships. The generators read it from there rather than keeping a
// copy of the path, so the raster assets cannot drift from the mark the app
// draws in src/components/brand/MataresitMark.tsx.
//
// The mark is drawn on a 24 x 24 canvas, but its ink is not centred in that
// canvas: the tear peaks at y 5.15 and the flat cut base at y 21, so the ink
// centre sits 1.075 units low. The app shifts the path up by that amount (see
// MataresitMark.tsx) so a flex-centred wordmark lines up with the ink. Every
// generator applies the same shift, so the favicon and the in-app mark match.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_SVG = path.join(ROOT, 'brand_guidelines', 'assets', 'mataresit-mark.svg');
const COMPONENT = path.join(ROOT, 'src', 'components', 'brand', 'MataresitMark.tsx');

/** The canvas the mark is drawn on. */
const CANVAS = 24;

/** Ink bounds: the tear peaks at the top, the flat cut base at the bottom. */
const INK_TOP = 5.15;
const INK_BOTTOM = 21;
const INK_CENTRE = (INK_TOP + INK_BOTTOM) / 2;

/**
 * Ink bounds across: the sheet runs from x 2.4 to x 21.6, which is symmetric
 * about the canvas centre. The rows inside it stop short of the right edge,
 * so they do not widen the mark.
 */
const INK_LEFT = 2.4;
const INK_RIGHT = 21.6;
const INK_CENTRE_X = (INK_LEFT + INK_RIGHT) / 2;

/** How far the art moves up for its ink centre to land on the canvas centre. */
const INK_SHIFT = Number((INK_CENTRE - CANVAS / 2).toFixed(3));

/** Read the mark path from the brand sheet's source SVG. */
function readMarkPath() {
  const svg = fs.readFileSync(SOURCE_SVG, 'utf8');
  const match = svg.match(/<path\b[^>]*\bd="([^"]+)"/);
  if (!match) {
    throw new Error(`${SOURCE_SVG}: no <path d="..."> found`);
  }
  return match[1].replace(/\s+/g, ' ').trim();
}

/**
 * Compare two path strings by the numbers they hold, so differences in
 * formatting (line breaks, commas, spacing) do not read as drift.
 */
function sameGeometry(a, b) {
  const numbers = (value) => (value.match(/-?\d*\.?\d+/g) || []).map(Number);
  const left = numbers(a);
  const right = numbers(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * The component and the assets have to draw the same mark. Comparing the
 * component's MARK_PATH constant with the brand sheet's source SVG here means
 * a redraw in one place cannot silently leave the other behind.
 */
function assertComponentInSync(pathData) {
  const source = fs.readFileSync(COMPONENT, 'utf8');
  const match = source.match(/const MARK_PATH =\s*([\s\S]*?);\n/);
  if (!match) {
    throw new Error(`${COMPONENT}: MARK_PATH constant not found`);
  }
  // The constant is a concatenation of string literals.
  const fromComponent = match[1]
    .split('"')
    .filter((_, index) => index % 2 === 1)
    .join(' ');
  if (!sameGeometry(fromComponent, pathData)) {
    throw new Error(
      'The mark path in MataresitMark.tsx does not match ' +
        'brand_guidelines/assets/mataresit-mark.svg. Update both together.',
    );
  }
}

module.exports = {
  CANVAS,
  INK_TOP,
  INK_BOTTOM,
  INK_CENTRE,
  INK_LEFT,
  INK_RIGHT,
  INK_CENTRE_X,
  INK_SHIFT,
  readMarkPath,
  sameGeometry,
  assertComponentInSync,
};
