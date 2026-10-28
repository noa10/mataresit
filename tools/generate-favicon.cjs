// One-off favicon generator. Writes favicon-16/24/32/48 PNGs to a temp folder,
// then `npx png-to-ico` combines them into public/favicon.ico.
// Run from the repo root: node tools/generate-favicon.cjs <outDir>
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const D =
  'M2.4 7.05L4 5.15L5.6 7.05L7.2 5.15L8.8 7.05L10.4 5.15L12 7.05L13.6 5.15L15.2 7.05L16.8 5.15L18.4 7.05L20 5.15L21.6 7.05V21H2.4Z ' +
  'M5.2 9.4H16.8V10.9H5.2Z M5.2 12.7H20.2V14.2H5.2Z M5.2 16H13.6V17.5H5.2Z M5.2 18.8H18.4V20.3H5.2Z';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node tools/generate-favicon.cjs <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const files = [];
  for (const size of [16, 24, 32, 48]) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<g transform="scale(${size / 24})"><path fill="#0B6B4D" fill-rule="evenodd" d="${D}"/></g></svg>`;
    const file = path.join(outDir, `favicon-${size}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    files.push(file);
  }
  console.log(files.join('\n'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
