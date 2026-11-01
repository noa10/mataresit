// One-off favicon generator. Writes favicon-16/24/32/48 PNGs to a temp folder,
// then tools/pack-favicon.cjs combines them into public/favicon.ico.
// Run from the repo root: node tools/generate-favicon.cjs <outDir>
//
// The path comes from tools/brand-mark.cjs, which reads it from the brand
// sheet's source SVG and refuses to run if MataresitMark.tsx has drifted.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { CANVAS, INK_SHIFT, readMarkPath, assertComponentInSync } = require('./brand-mark.cjs');

const BRAND = '#0B6B4D';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node tools/generate-favicon.cjs <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const D = readMarkPath();
assertComponentInSync(D);

(async () => {
  const files = [];
  for (const size of [16, 24, 32, 48]) {
    // Ink-centred, the same shift the app applies — see tools/brand-mark.cjs.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<g transform="scale(${size / CANVAS})">` +
      `<g transform="translate(0 ${-INK_SHIFT})"><path fill="${BRAND}" fill-rule="evenodd" d="${D}"/></g>` +
      `</g></svg>`;
    const file = path.join(outDir, `favicon-${size}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    files.push(file);
  }
  console.log(files.join('\n'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
