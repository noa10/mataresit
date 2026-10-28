// One-off asset generator for the brand mark. Not part of the build.
// Run from the repo root: node tools/generate-brand-assets.cjs
// Source of truth: brand_guidelines/assets/mataresit-mark.svg (24 x 24, even-odd).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

const D =
  'M2.4 7.05L4 5.15L5.6 7.05L7.2 5.15L8.8 7.05L10.4 5.15L12 7.05L13.6 5.15L15.2 7.05L16.8 5.15L18.4 7.05L20 5.15L21.6 7.05V21H2.4Z ' +
  'M5.2 9.4H16.8V10.9H5.2Z M5.2 12.7H20.2V14.2H5.2Z M5.2 16H13.6V17.5H5.2Z M5.2 18.8H18.4V20.3H5.2Z';

const PANEL = '#101614';
const PAPER = '#F1F2EE';
const BRAND = '#0B6B4D';

// Transparent mark, mark fills `inset` of a square canvas (e.g. 0.9 = 90%).
const markSvg = (size, fill, inset) => {
  const s = size * inset;
  const off = (size - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${off} ${off}) scale(${s / 24})">
    <path fill="${fill}" fill-rule="evenodd" d="${D}"/>
  </g>
</svg>`;
};

(async () => {
  const written = [];
  const emit = async (file, buf) => {
    fs.writeFileSync(path.join(OUT, file), buf);
    written.push(`${file} (${buf.length} bytes)`);
  };

  // Tab icon: the mark on its own. Runs to the full canvas edge so a 16px tab
  // icon keeps the tear and rows readable.
  for (const size of [32, 64, 192, 512]) {
    const buf = await sharp(Buffer.from(markSvg(size, BRAND, 1))).png().toBuffer();
    await emit(`mataresit-${size}.png`, buf);
  }

  // Touch icon / social card / notification icon: solid tile, safe padding for
  // platform masks (iOS rounds and crops the corners).
  const tile = (size, plate, ink) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${plate}"/>
  <g transform="translate(${size * 0.17} ${size * 0.17}) scale(${(size * 0.66) / 24})">
    <path fill="${ink}" fill-rule="evenodd" d="${D}"/>
  </g>
</svg>`;

  for (const size of [180, 192, 512]) {
    const buf = await sharp(Buffer.from(tile(size, PANEL, PAPER))).png().toBuffer();
    const file = size === 180 ? 'mataresit-180.png' : `mataresit-tile-${size}.png`;
    await emit(file, buf);
  }

  // Android notification badge: silhouette only, transparent ground.
  const badge = await sharp(Buffer.from(markSvg(96, '#FFFFFF', 0.92))).png().toBuffer();
  await emit('mataresit-badge.png', badge);

  console.log(written.join('\n'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
