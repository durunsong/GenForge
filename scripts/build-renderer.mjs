import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src', 'renderer');
const outDir = path.join(root, 'dist', 'renderer');

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

const entry = path.join(srcDir, 'app.ts');
const source = readFileSync(entry, 'utf8');
const result = await esbuild.transform(source, {
  loader: 'ts',
  target: 'chrome120',
  sourcemap: 'external',
  sourcefile: 'app.ts',
  logLevel: 'info',
});

writeFileSync(path.join(outDir, 'app.js'), result.code);
if (result.map) {
  writeFileSync(path.join(outDir, 'app.js.map'), result.map);
  writeFileSync(
    path.join(outDir, 'app.js'),
    `${result.code}\n//# sourceMappingURL=app.js.map\n`,
  );
}

for (const file of ['index.html', 'style.css', 'update.css']) {
  cpSync(path.join(srcDir, file), path.join(outDir, file));
}

cpSync(path.join(srcDir, 'vendor'), path.join(outDir, 'vendor'), { recursive: true });

const assetsDir = path.join(srcDir, 'assets');
if (existsSync(assetsDir)) {
  cpSync(assetsDir, path.join(outDir, 'assets'), { recursive: true });
}

console.log('Renderer build complete -> dist/renderer');
