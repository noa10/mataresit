// One-off asset generator for the brand mark. Not part of the build.
// Run from the repo root: node tools/generate-brand-assets.cjs
//
// Source of truth: brand_guidelines/assets/mataresit-mark.svg (24 x 24, even-odd).
// The path is read from there by tools/brand-mark.cjs, and the generator refuses
// to run if src/components/brand/MataresitMark.tsx has drifted from it.
//
// The mark's ink sits 1.075 units low in the 24-unit canvas, so every variant
// below shifts the art up by that amount. The app does the same shift in
// MataresitMark.tsx, which is what keeps the favicon and the in-app mark in
// the same place.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { CANVAS, INK_SHIFT, readMarkPath, assertComponentInSync } = require('./brand-mark.cjs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

const PANEL = '#101614';
const PAPER = '#F1F2EE';
const BRAND = '#0B6B4D';

// How far into the square the mark is inset, as a fraction. 1 = the 24-unit box
// fills the square.
const INSET = 1;

// How much of the square the mark's box occupies inside a tile, and where that
// box starts. The margin is what keeps the mark clear of the rounded corners
// platforms cut into touch icons and social cards.
const TILE_SCALE = 0.66;
const TILE_INSET = 0.17;

const D = readMarkPath();
assertComponentInSync(D);

// The art, shifted so its ink is centred on the canvas.
const inkCentred = (inner) =>
  `<g transform="translate(0 ${-INK_SHIFT})">${inner}</g>`;

// Transparent mark, mark fills `inset` of a square canvas.
const markSvg = (size, fill, inset) => {
  const s = size * inset;
  const off = (size - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${off} ${off}) scale(${s / CANVAS})">
    ${inkCentred(`<path fill="${fill}" fill-rule="evenodd" d="${D}"/>`)}
  </g>
</svg>`;
};

// Solid tile: a plate with the mark centred on it, padded for platform masks.
const tileSvg = (size, plate, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${plate}"/>
  <g transform="translate(${size * TILE_INSET} ${size * TILE_INSET}) scale(${(size * TILE_SCALE) / CANVAS})">
    ${inkCentred(`<path fill="${ink}" fill-rule="evenodd" d="${D}"/>`)}
  </g>
</svg>`;

// The standalone mark, as an SVG file. Seed colour so it reads on any page,
// and currentColor-free because a standalone SVG has no inherited colour.
const markFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}" role="img" aria-labelledby="mt-title">
  <title id="mt-title">Mataresit</title>
  <!-- Ink-centred: the art spans y 5.15 to 21, so it is shifted up by 1.075
       units to sit centred in the square. Keep this in step with
       MataresitMark.tsx. -->
  ${inkCentred(`<path fill="${BRAND}" fill-rule="evenodd" d="${D}"/>`)}
</svg>
`;

// The standalone tile, as an SVG file. Same composition as the PNG tiles.
const iconFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024" role="img" aria-labelledby="mt-title">
  <title id="mt-title">Mataresit</title>
  <!-- Panel ink plate, paper knockout, mark centred with the same margin the
       PNG tiles use. -->
  <rect width="1024" height="1024" fill="${PANEL}"/>
  <g transform="translate(${1024 * TILE_INSET} ${1024 * TILE_INSET}) scale(${(1024 * TILE_SCALE) / CANVAS})">
    ${inkCentred(`<path fill="${PAPER}" fill-rule="evenodd" d="${D}"/>`)}
  </g>
</svg>
`;

(async () => {
  const written = [];
  const emit = async (file, buf) => {
    fs.writeFileSync(path.join(OUT, file), buf);
    written.push(`${file} (${buf.length} bytes)`);
  };

  // Tab icon: the mark on its own. Runs to the full canvas edge so a 16px tab
  // icon keeps the tear and rows readable.
  for (const size of [32, 64, 192, 512]) {
    const buf = await sharp(Buffer.from(markSvg(size, BRAND, INSET))).png().toBuffer();
    await emit(`mataresit-${size}.png`, buf);
  }

  // Touch icon / social card: solid tile, safe padding for platform masks
  // (iOS rounds and crops the corners).
  for (const size of [180, 192, 512]) {
    const buf = await sharp(Buffer.from(tileSvg(size, PANEL, PAPER))).png().toBuffer();
    const file = size === 180 ? 'mataresit-180.png' : `mataresit-tile-${size}.png`;
    await emit(file, buf);
  }

  // Android notification badge: silhouette only, transparent ground.
  const badge = await sharp(Buffer.from(markSvg(96, '#FFFFFF', 0.92))).png().toBuffer();
  await emit('mataresit-badge.png', badge);

  // The vector pair: the mark alone, and the tile.
  await emit('mataresit-mark.svg', Buffer.from(markFile));
  await emit('mataresit-icon.svg', Buffer.from(iconFile));

  console.log(written.join('\n'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
