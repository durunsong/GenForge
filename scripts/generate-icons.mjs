import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source =
  [
    path.join(root, 'build', 'icon-source.png'),
    path.join(root, 'build', 'icon.png'),
  ].find((p) => fs.existsSync(p)) ?? '';

if (!source) {
  console.error('Missing build/icon-source.png');
  process.exit(1);
}

const rendererAssets = path.join(root, 'src', 'renderer', 'assets');
fs.mkdirSync(rendererAssets, { recursive: true });
fs.mkdirSync(path.join(root, 'build'), { recursive: true });

const outPng = path.join(root, 'build', 'icon.png');
// macOS / Linux packaging prefers a larger master icon
await sharp(source).resize(1024, 1024, { fit: 'cover' }).png().toFile(outPng);
await sharp(source).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(rendererAssets, 'icon.png'));
await sharp(source).resize(32, 32, { fit: 'cover' }).png().toFile(path.join(rendererAssets, 'favicon-32.png'));
await sharp(source).resize(16, 16, { fit: 'cover' }).png().toFile(path.join(rendererAssets, 'favicon-16.png'));
await sharp(source).resize(180, 180, { fit: 'cover' }).png().toFile(path.join(rendererAssets, 'apple-touch-icon.png'));
await sharp(source).resize(192, 192, { fit: 'cover' }).png().toFile(path.join(rendererAssets, 'icon-192.png'));

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPngs = await Promise.all(
  icoSizes.map((size) => sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer()),
);
const ico = await pngToIco(icoPngs);
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico);
fs.writeFileSync(path.join(rendererAssets, 'favicon.ico'), ico);

// Linux icon theme sizes (electron-builder also accepts build/icon.png)
const linuxIconRoot = path.join(root, 'build', 'icons');
fs.mkdirSync(linuxIconRoot, { recursive: true });
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(path.join(linuxIconRoot, `${size}x${size}.png`));
}

console.log('Icons generated from', path.basename(source));
console.log(' - build/icon.png (1024), build/icon.ico, build/icons/*');
console.log(' - src/renderer/assets/*');
