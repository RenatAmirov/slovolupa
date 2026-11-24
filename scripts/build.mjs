import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, cp } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
await mkdir('extension/icons', { recursive: true });
await build({ entryPoints: { content: 'src/content.js', popup: 'src/popup.js', background: 'src/background.js' }, outdir: 'extension', bundle: true, minify: true, target: 'chrome111', legalComments: 'eof', loader: { '.woff2': 'binary' } });
for (const file of ['explain-server.mjs', 'Start-Explanation.ps1']) await copyFile(`scripts/${file}`, `extension/${file}`);
await copyFile('node_modules/@fontsource-variable/manrope/LICENSE', 'extension/Manrope-LICENSE.txt');
await copyFile('src/popup.html', 'extension/popup.html');
await mkdir('extension/pdfjs', { recursive: true });
for (const file of ['pdf.html', 'pdf-reader.mjs', 'djvu-reader.mjs']) await copyFile(`src/${file}`, `extension/${file}`);
await build({
  entryPoints: ['src/djvu-worker.mjs'], outfile: 'extension/djvu-worker.js',
  bundle: true, minify: true, target: 'chrome111', legalComments: 'eof',
});

// Keep the decoder's corresponding source and notices with the installable bundle.
const djvuSource = 'extension/djvu-source';
await cp('node_modules/djvujs-dist/library/src', `${djvuSource}/djvujs-dist/library/src`, { recursive: true });
for (const notice of ['LICENSE.md', 'GNU_GPL_v2']) {
  await copyFile(`node_modules/djvujs-dist/${notice}`, `${djvuSource}/djvujs-dist/${notice}`);
}
await cp('node_modules/pngjs/lib', `${djvuSource}/pngjs/lib`, { recursive: true });
for (const file of ['browser.js', 'LICENSE']) await copyFile(`node_modules/pngjs/${file}`, `${djvuSource}/pngjs/${file}`);
await copyFile('src/djvu-worker.mjs', `${djvuSource}/djvu-worker.mjs`);
await writeFile(`${djvuSource}/README.txt`, [
  'DjVu decoder source for Slovolupa',
  'Upstream DjVu.js 0.5.4: https://github.com/RussCoder/djvujs/tree/d068f46a6935e7bef57206e26396f988774d4be6',
  'Upstream PNGJS 5.0.0: https://github.com/pngjs/pngjs/tree/v5.0.0',
  'From this directory, rebuild the bundled worker with:',
  'npx esbuild@0.25.12 djvu-worker.mjs --bundle --minify --target=chrome111 --legal-comments=eof --alias:djvujs-dist=./djvujs-dist --alias:pngjs/browser=./pngjs/browser.js --outfile=../djvu-worker.js',
  '',
].join('\n'));
for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) await copyFile(`node_modules/pdfjs-dist/legacy/build/${file}`, `extension/pdfjs/${file}`);
await copyFile('node_modules/pdfjs-dist/LICENSE', 'extension/pdfjs/LICENSE');
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(`node_modules/pdfjs-dist/${directory}`, `extension/pdfjs/${directory}`, { recursive: true });
}
await copyFile('THIRD_PARTY_NOTICES.txt', 'extension/THIRD_PARTY_NOTICES.txt');

// Small native PNG icons; no image service or build-time network access.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
for (const size of [16, 48, 128]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const data = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = x / size, ny = y / size;
    const bar = (nx > .22 && nx < .35 && ny > .46 && ny < .77) ||
      (nx > .44 && nx < .57 && ny > .23 && ny < .77) ||
      (nx > .66 && nx < .79 && ny > .35 && ny < .77);
    const offset = y * (size * 4 + 1) + x * 4 + 1;
    data.set(bar ? [224, 250, 235, 255] : [18, 73, 63, 255], offset);
  }
  await writeFile(`extension/icons/${size}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]));
}
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
console.log(`Готово: extension/ · ${manifest.name} ${manifest.version}`);
