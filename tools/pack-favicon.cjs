// One-off: wrap the PNGs from generate-favicon.cjs into a multi-size .ico.
// The ICO container is written here so no extra package is needed:
//   ICONDIR (6 bytes) + ICONDIRENTRY per image (16 bytes) + PNG payloads.
// PNG payloads are valid ICO image data since Windows Vista.
// Run: node tools/pack-favicon.cjs <pngDir> <outFile>
const fs = require('fs');
const path = require('path');

const [pngDir, outFile] = process.argv.slice(2);
if (!pngDir || !outFile) {
  console.error('usage: node tools/pack-favicon.cjs <pngDir> <outFile>');
  process.exit(1);
}

const sizes = [16, 24, 32, 48];
const images = sizes.map((size) => {
  const file = path.join(pngDir, `favicon-${size}.png`);
  const data = fs.readFileSync(file);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== size || height !== size) {
    throw new Error(`${file}: expected ${size}x${size}, got ${width}x${height}`);
  }
  return { size, data };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);

const entries = [];
let offset = 6 + images.length * 16;
for (const { size, data } of images) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // colour palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += data.length;
}

const out = Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
fs.writeFileSync(outFile, out);
console.log(`${outFile}: ${out.length} bytes, ${images.length} sizes (${sizes.join('/')})`);
